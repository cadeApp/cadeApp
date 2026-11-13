import { randomUUID } from 'node:crypto';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
  createE2EClient,
  trackEntityForCleanup,
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

  // ---------------------------------------------------------------------------
  // CC-051 / T-435 (SEC-12): captura real de Realtime en Develop con usuarios sembrados.
  // Matriz D3-A: publicación real (UPDATE), UPDATE e INSERT con valor presente, borrador modificado y anon.
  // ---------------------------------------------------------------------------
  test('CC-051: notes y cash_change_amount no viajan por Realtime a actores restringidos; service role confirma el origen', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier sembrados');
    }

    type Actor = 'A' | 'M' | 'N' | 'S';
    interface Captured {
      readonly actor: Actor;
      readonly event: 'INSERT' | 'UPDATE' | 'DELETE';
      readonly id: string;
      readonly status: unknown;
      readonly updatedAt: unknown;
      readonly keys: readonly string[];
      readonly hasMarker: boolean;
      readonly hasAmount: boolean;
      readonly notesMatchesMarker: boolean;
      readonly amountMatches: boolean;
    }

    // Ventana negativa acotada y declarada: prueba la ausencia dentro de este intervalo, no para siempre.
    const NEGATIVE_WINDOW_MS = 5_000;
    const marker = `SEC12-${stagingContext.testRunId}-${randomUUID()}`;
    const amount = 43_210;
    const publishedId = randomUUID();
    const draftId = randomUUID();
    trackEntityForCleanup(stagingContext, 'request', publishedId);
    trackEntityForCleanup(stagingContext, 'request', draftId);
    const ids = new Set<string>([publishedId, draftId]);

    const admin = createAdminClient();
    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier);
    const anonClient = createE2EClient();

    const { data: zones, error: zonesErr } = await admin
      .from('zones')
      .select('id, name')
      .eq('active', true)
      .not('centroid_lat', 'is', null)
      .limit(10);
    expect(zonesErr).toBeNull();
    const stableZones = (zones ?? []).filter((z) => typeof z.name !== 'string' || !z.name.startsWith('E2E Zona '));
    const pickupZoneId = stableZones[0]?.id;
    const dropoffZoneId = stableZones[1]?.id ?? pickupZoneId;
    if (!pickupZoneId || !dropoffZoneId) {
      throw new Error('[E2E Precondition Error] Faltan zonas activas estables');
    }

    const captured: Captured[] = [];
    const channels: Array<{ client: SupabaseClient; channel: RealtimeChannel }> = [];

    async function subscribe(client: SupabaseClient, actor: Actor): Promise<void> {
      const { data } = await client.auth.getSession();
      if (data.session) {
        await client.realtime.setAuth(data.session.access_token);
      }
      const channel = client.channel(`cc051-${actor}-${stagingContext.testRunId}`);
      channels.push({ client, channel });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout esperando SUBSCRIBED de ${actor}`)), 15_000);
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests' }, (payload) => {
            const row = (payload.new ?? {}) as Record<string, unknown>;
            const id = typeof row.id === 'string' ? row.id : '';
            if (!ids.has(id)) return;
            const json = JSON.stringify(row);
            captured.push({
              actor,
              event: payload.eventType as Captured['event'],
              id,
              status: row.status,
              updatedAt: row.updated_at,
              keys: Object.keys(row).sort(),
              hasMarker: json.includes(marker),
              hasAmount: json.includes(String(amount)),
              notesMatchesMarker: row.notes === marker,
              amountMatches: row.cash_change_amount === amount,
            });
          })
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              clearTimeout(timer);
              reject(new Error(`Canal de ${actor} falló: ${status} ${err?.message ?? ''}`));
            }
          });
      });
    }

    const eventsOf = (actor: Actor, id: string, event: Captured['event'], updatedAt?: string) =>
      captured.filter(
        (e) =>
          e.actor === actor &&
          e.id === id &&
          e.event === event &&
          (updatedAt === undefined || Date.parse(String(e.updatedAt)) === Date.parse(updatedAt))
      );
    const waitFor = async (actor: Actor, id: string, event: Captured['event'], updatedAt?: string) => {
      await expect
        .poll(() => eventsOf(actor, id, event, updatedAt).length, { timeout: 25_000 })
        .toBeGreaterThan(0);
      return eventsOf(actor, id, event, updatedAt);
    };
    const expectRestricted = (events: readonly Captured[]) => {
      for (const e of events) {
        expect(e.keys, `${e.actor}/${e.event}: sin notes`).not.toContain('notes');
        expect(e.keys, `${e.actor}/${e.event}: sin cash_change_amount`).not.toContain('cash_change_amount');
        expect(e.hasMarker, `${e.actor}/${e.event}: sin el marcador`).toBe(false);
        expect(e.hasAmount, `${e.actor}/${e.event}: sin el monto`).toBe(false);
      }
    };
    // Control positivo de origen: S trae ambas claves con el valor exacto (booleanos, sin volcar valores).
    const expectSourcePositive = (events: readonly Captured[]) => {
      expect(
        events.some(
          (e) =>
            e.keys.includes('notes') &&
            e.keys.includes('cash_change_amount') &&
            e.notesMatchesMarker &&
            e.amountMatches
        ),
        `${events[0]?.event ?? '?'}: S recibe notes y cash_change_amount con el valor sembrado`
      ).toBe(true);
    };
    const negativeWindow = () => new Promise<void>((resolve) => setTimeout(resolve, NEGATIVE_WINDOW_MS));

    let bodyCompleted = false;
    try {
      // Precondición: los cuatro canales en SUBSCRIBED antes de cualquier mutación.
      // allSettled: si una falla, se espera a las demás para que todo canal creado quede registrado antes del finally.
      const subscriptions = await Promise.allSettled([
        subscribe(courierClient, 'A'),
        subscribe(merchantClient, 'M'),
        subscribe(anonClient, 'N'),
        subscribe(admin as unknown as SupabaseClient, 'S'),
      ]);
      const failedSubscription = subscriptions.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failedSubscription) throw failedSubscription.reason;

      // 1. Publicación real con la RPC del comercio (INSERT draft + UPDATE a published en request_cycle).
      const { error: publishErr } = await merchantClient.rpc('create_and_publish_multi_drop', {
        p_payload: {
          requestId: publishedId,
          pickupZoneId,
          pickupAddress: `Alberdi 150 SEC12 ${stagingContext.testRunId}`,
          pickupLat: null,
          pickupLng: null,
          fixedPriceArs: null,
          autoAssign: false,
          drops: [
            {
              dropoffZoneId,
              dropoffAddress: `Mitre 450 SEC12 ${stagingContext.testRunId}`,
              dropoffLat: null,
              dropoffLng: null,
              recipientName: 'Cliente SEC12',
              recipientPhone: '3865123456',
              recipientConsentDeclared: true,
              packageType: 'chico',
              recipientPaymentMethod: 'transfer',
              needsChange: false,
              cashChangeAmount: null,
              notes: null,
            },
          ],
        },
      });
      expect(publishErr).toBeNull();
      const { data: publishedRow, error: publishedRowErr } = await admin
        .from('delivery_requests')
        .select('status, updated_at')
        .eq('id', publishedId)
        .single();
      expect(publishedRowErr).toBeNull();
      expect(publishedRow?.status).toBe('published');
      const publishedAt = String(publishedRow?.updated_at);
      const aPublishUpdate = await waitFor('A', publishedId, 'UPDATE', publishedAt);
      expect(aPublishUpdate.some((e) => e.status === 'published')).toBe(true);
      expectRestricted(aPublishUpdate);
      // Un INSERT de la publicación que llegue al repartidor se inspecciona igual; no se exige.
      expectRestricted(eventsOf('A', publishedId, 'INSERT'));

      // Evidencia de autorización independiente de Realtime (PostgREST con el mismo token).
      const { data: aPublished, error: aPublishedErr } = await courierClient
        .from('delivery_requests')
        .select('id')
        .eq('id', publishedId);
      expect(aPublishedErr).toBeNull();
      expect(aPublished).toHaveLength(1);
      const { data: nPublished, error: nPublishedErr } = await anonClient
        .from('delivery_requests')
        .select('id')
        .eq('id', publishedId);
      expect(nPublishedErr?.code).toBe('42501');
      expect(nPublished).toBeNull();

      // 2. UPDATE con valor presente en las columnas viejas (cliente admin del arnés).
      const { data: touched, error: touchErr } = await admin
        .from('delivery_requests')
        .update({ notes: marker, cash_change_amount: amount })
        .eq('id', publishedId)
        .select('updated_at')
        .single();
      expect(touchErr).toBeNull();
      const updatedAt = String(touched?.updated_at);
      // Control positivo de origen (publicación completa): S recibe las claves y el marcador.
      const sUpdate = await waitFor('S', publishedId, 'UPDATE', updatedAt);
      expectSourcePositive(sUpdate);
      expectRestricted(await waitFor('A', publishedId, 'UPDATE', updatedAt));
      expectRestricted(await waitFor('M', publishedId, 'UPDATE', updatedAt));

      // 3. INSERT con valor presente: borrador sintético del comercio, después de los SUBSCRIBED.
      const { data: inserted, error: insertErr } = await admin
        .from('delivery_requests')
        .insert({
          id: draftId,
          merchant_id: merchant.id,
          pickup_zone_id: pickupZoneId,
          dropoff_zone_id: dropoffZoneId,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: true,
          status: 'draft',
          notes: marker,
          cash_change_amount: amount,
        })
        .select('updated_at')
        .single();
      expect(insertErr).toBeNull();
      expect(inserted?.updated_at).toBeTruthy();
      const insertedAt = String(inserted?.updated_at);
      const sInsert = await waitFor('S', draftId, 'INSERT', insertedAt);
      expectSourcePositive(sInsert);
      expectRestricted(await waitFor('M', draftId, 'INSERT', insertedAt));

      // Visibilidad del borrador por PostgREST, después de insertarlo y antes del veredicto negativo.
      const { data: mDraft, error: mDraftErr } = await merchantClient.from('delivery_requests').select('id').eq('id', draftId);
      expect(mDraftErr).toBeNull();
      expect(mDraft).toHaveLength(1);
      const { data: aDraft, error: aDraftErr } = await courierClient.from('delivery_requests').select('id').eq('id', draftId);
      expect(aDraftErr).toBeNull();
      expect(aDraft).toHaveLength(0);
      const { data: nDraft, error: nDraftErr } = await anonClient.from('delivery_requests').select('id').eq('id', draftId);
      expect(nDraftErr?.code).toBe('42501');
      expect(nDraft).toBeNull();

      // 4. Borrador modificado (UPDATE): M y S lo reciben con las mismas reglas.
      const { data: draftTouched, error: draftTouchErr } = await admin
        .from('delivery_requests')
        .update({ cash_change_amount: amount })
        .eq('id', draftId)
        .select('updated_at')
        .single();
      expect(draftTouchErr).toBeNull();
      const draftUpdatedAt = String(draftTouched?.updated_at);
      const sDraftUpdate = await waitFor('S', draftId, 'UPDATE', draftUpdatedAt);
      expectSourcePositive(sDraftUpdate);
      expectRestricted(await waitFor('M', draftId, 'UPDATE', draftUpdatedAt));

      // Negativos: después de la barrera causal (S ya recibió cada cambio), ventana acotada y conteo 0.
      await negativeWindow();
      // Todo lo que A y M recibieron en la ventana completa (INSERT/UPDATE, opcionales o tardíos).
      expectRestricted(captured.filter((e) => (e.actor === 'A' || e.actor === 'M') && ids.has(e.id)));
      expect(captured.filter((e) => e.actor === 'A' && e.id === draftId)).toHaveLength(0);
      expect(captured.filter((e) => e.actor === 'N')).toHaveLength(0);

      // Registro de la captura: nombres de claves por actor y evento, sin valores.
      for (const e of captured) {
        const which = e.id === publishedId ? 'publicada' : 'borrador';
        console.log(`[CC-051 captura] actor=${e.actor} evento=${e.event} fila=${which} claves=${e.keys.join(',')}`);
      }
      bodyCompleted = true;
    } finally {
      const cleanupErrors: string[] = [];
      try {
        const { error: resetErr } = await admin
          .from('delivery_requests')
          .update({ notes: null, cash_change_amount: null })
          .in('id', [publishedId, draftId]);
        if (resetErr) cleanupErrors.push(`reset columnas viejas: ${resetErr.code ?? 'sin código'}`);
      } catch (error) {
        cleanupErrors.push(`reset columnas viejas: ${error instanceof Error ? error.name : 'excepción'}`);
      }
      const removals = await Promise.allSettled(channels.map(({ client, channel }) => client.removeChannel(channel)));
      removals.forEach((r, i) => {
        if (r.status === 'rejected') cleanupErrors.push(`removeChannel #${i}: rechazado`);
        else if (r.value !== 'ok') cleanupErrors.push(`removeChannel #${i}: ${r.value}`);
      });
      if (cleanupErrors.length > 0) {
        const message = `[CC-051] limpieza incompleta: ${cleanupErrors.join('; ')}`;
        // No tapar el fallo original de la prueba: si el cuerpo ya falló, solo se registra.
        if (bodyCompleted) throw new Error(message);
        console.error(message);
      }
    }
  });
});
