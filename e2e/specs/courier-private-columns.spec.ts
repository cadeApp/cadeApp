import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';

/**
 * T-345 / CC-023: `notes` y `cash_change_amount` de `delivery_requests` no se leen por API con el token de un
 * repartidor (PostgREST ni Realtime). El comercio dueño los sigue viendo por `get_merchant_request_private_fields`
 * y el viaje por `get_trip_details`.
 *
 * DoD:
 * - el repartidor aprobado no lee `notes` ni `cash_change_amount` por PostgREST, y sí las columnas públicas;
 * - un suscriptor Realtime autenticado como repartidor recibe un UPDATE sin los dos campos;
 * - el comercio dueño sigue viendo «Paga con $ …» en el detalle;
 * - después de `accept_offer`, `/trips/:id` sigue mostrando las indicaciones y el monto.
 *
 * La solicitud sembrada ya trae indicaciones (`notes`, marcador de la corrida). El spec le agrega efectivo con
 * cambio y monto con el cliente de administración del fixture.
 */

const CHANGE_AMOUNT = 5000;
const UPDATED_CHANGE_AMOUNT = 6000;
const PRIVATE_COLUMNS = ['notes', 'cash_change_amount'] as const;

test.describe('T-345 — columnas privadas de delivery_requests cerradas por API', () => {
  test('DoD: el repartidor no lee indicaciones ni monto por PostgREST ni Realtime; comercio y viaje siguen viéndolos', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    test.setTimeout(90_000);

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    const requestId = stagingContext.createdRequestIds[0];
    if (!merchant || !courier || !requestId) {
      throw new Error('[E2E Precondition Error] Se requieren merchant, courier 0 y una solicitud sembrada');
    }

    // 1. Precondición: efectivo + necesita cambio + monto exacto, con las indicaciones sembradas
    const admin = createAdminClient();
    const { data: seeded, error: seedErr } = await admin
      .from('delivery_requests')
      .update({ recipient_payment_method: 'cash', needs_change: true })
      .eq('id', requestId)
      .select('id, status, notes, cash_change_amount, updated_at')
      .single();
    expect(seedErr).toBeNull();
    expect(seeded).toMatchObject({
      id: requestId,
      status: 'published',
      notes: null,
      cash_change_amount: null,
    });
    if (!seeded?.updated_at) {
      throw new Error('[E2E Seed Error] Falta updated_at del request publicado');
    }
    const previousUpdatedAt = seeded.updated_at;

    const { data: seededDrop, error: seededDropErr } = await admin
      .from('delivery_request_drops')
      .select('id')
      .eq('request_id', requestId)
      .eq('position', 1)
      .single();
    expect(seededDropErr).toBeNull();
    if (!seededDrop?.id) {
      throw new Error('[E2E Seed Error] Falta el drop 1 de la solicitud publicada');
    }

    const { error: dropUpdateErr } = await admin
      .from('delivery_request_drops')
      .update({ recipient_payment_method: 'cash', needs_change: true })
      .eq('id', seededDrop.id);
    expect(dropUpdateErr).toBeNull();

    const { data: privateData, error: privateUpdateErr } = await admin
      .from('delivery_request_drop_contacts')
      .update({ cash_change_amount: CHANGE_AMOUNT })
      .eq('drop_id', seededDrop.id)
      .select('notes, cash_change_amount')
      .single();
    expect(privateUpdateErr).toBeNull();
    if (typeof privateData?.notes !== 'string' || !privateData.notes.trim()) {
      throw new Error('[E2E Seed Error] Falta notes en drop_contacts del drop 1');
    }
    const notes = privateData.notes;
    expect(privateData.cash_change_amount).toBe(CHANGE_AMOUNT);

    // 2. PostgREST con el token del repartidor aprobado: columnas privadas → 42501, públicas → la fila
    const courierClient = await createAuthenticatedClient(courier);

    for (const column of [...PRIVATE_COLUMNS, '*']) {
      const { data, error } = await courierClient.from('delivery_requests').select(column).eq('id', requestId);
      expect(error?.code, `select ${column} tiene que fallar por privilegio de columna`).toBe('42501');
      expect(data).toBeNull();
    }

    const { data: publicRow, error: publicErr } = await courierClient
      .from('delivery_requests')
      .select('id, status, recipient_payment_method, needs_change')
      .eq('id', requestId)
      .single();
    expect(publicErr).toBeNull();
    expect(publicRow).toEqual({
      id: requestId,
      status: 'published',
      recipient_payment_method: 'cash',
      needs_change: true,
    });

    // 3. Realtime autenticado como repartidor: el UPDATE llega sin los dos campos
    const {
      data: { session },
    } = await courierClient.auth.getSession();
    if (!session) {
      throw new Error('[E2E Precondition Error] El cliente del repartidor no tiene sesión');
    }
    await courierClient.realtime.setAuth(session.access_token);

    const received: Array<Record<string, unknown>> = [];
    const channel = courierClient.channel(`t345-private-columns-${requestId}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout esperando SUBSCRIBED del repartidor')), 15_000);
      channel
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'delivery_requests', filter: `id=eq.${requestId}` },
          (payload) => {
            received.push(payload.new as Record<string, unknown>);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error(`Canal del repartidor falló: ${status} ${JSON.stringify(err)}`));
          }
        });
    });

    try {
      // UPDATE público real: nunca reintroducir monto o notes legacy.
      // PostgreSQL asigna updated_at mediante public.set_updated_at.
      const { data: touched, error: updateErr } = await admin
        .from('delivery_requests')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select('id, status, updated_at, notes, cash_change_amount')
        .single();
      expect(updateErr).toBeNull();
      expect(touched).toMatchObject({
        id: requestId,
        status: 'published',
        notes: null,
        cash_change_amount: null,
      });
      if (!touched?.updated_at) {
        throw new Error('[E2E Seed Error] No se obtuvo updated_at del UPDATE');
      }
      expect(touched.updated_at).not.toBe(previousUpdatedAt);
      const emittedAt = Date.parse(touched.updated_at);
      expect(Number.isFinite(emittedAt)).toBe(true);

      const { data: privateAfter, error: privateAmountErr } = await admin
        .from('delivery_request_drop_contacts')
        .update({ cash_change_amount: UPDATED_CHANGE_AMOUNT })
        .eq('drop_id', seededDrop.id)
        .select('notes, cash_change_amount')
        .single();
      expect(privateAmountErr).toBeNull();
      expect(privateAfter?.notes).toBe(notes);
      expect(privateAfter?.cash_change_amount).toBe(UPDATED_CHANGE_AMOUNT);

      const matches = (row: Record<string, unknown>) =>
        row.id === requestId && Date.parse(String(row.updated_at)) === emittedAt;
      await expect.poll(
        () => received.some(matches),
        { timeout: 25_000 }
      ).toBe(true);
      const record = received.find(matches);
      expect(record).toBeDefined();
      expect(record?.status).toBe('published');
      for (const column of PRIVATE_COLUMNS) {
        expect(Object.keys(record ?? {}), 'Realtime no expone ' + column).not.toContain(column);
      }
      expect(JSON.stringify(record)).not.toContain(notes);
      expect(JSON.stringify(record)).not.toContain(String(UPDATED_CHANGE_AMOUNT));
    } finally {
      await courierClient.removeChannel(channel);
    }

    const amountLabel = formatArs(UPDATED_CHANGE_AMOUNT);

    // 4. El comercio dueño sigue viendo «Paga con $ …» en el detalle (get_merchant_request_private_fields)
    const merchantContext = await browser.newContext();
    try {
      const merchantBrowserPage = await merchantContext.newPage();
      await loginAsMerchant(merchantBrowserPage);
      await merchantBrowserPage.goto(`/merchant/requests/${requestId}`);
      await waitForNoSkeletons(merchantBrowserPage);
      await expect(merchantBrowserPage.getByText(`(Paga con ${amountLabel})`)).toBeVisible();
    } finally {
      await merchantContext.close();
    }

    // 5. El comercio acepta la oferta del courier 0 (RPC real con sesión del comercio)
    await seedOffersForFirstRequest(stagingContext);
    const before = await getRequestInspectionData(stagingContext, requestId);
    const courierOffer = before.offers.find((o) => o.courierId === courier.id && o.status === 'pending');
    if (!courierOffer) {
      throw new Error('[E2E Precondition Error] No hay oferta pending del courier 0');
    }
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: courierOffer.id });
    expect(acceptErr).toBeNull();

    // 6. Después del match, el repartidor aceptado tampoco lee las columnas por tabla, pero el viaje
    // (get_trip_details) sigue mostrando los dos datos
    const { error: matchedErr } = await courierClient
      .from('delivery_requests')
      .select('notes, cash_change_amount')
      .eq('id', requestId);
    expect(matchedErr?.code).toBe('42501');

    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText(notes)).toBeVisible();
    await expect(page.getByText(`necesita cambio de ${amountLabel}`)).toBeVisible();
  });
});
