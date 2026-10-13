import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
  trackEntityForCleanup,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';
import { liveFeedResponseSchema } from '@/lib/live-contracts';
import {
  assertNoPrivateFieldsInRawPayload,
  FORBIDDEN_PRIVATE_KEYS,
} from '@/server/live/privacy-checker';

/**
 * T-340 Paso 2/4: Lectores multi-drop, privacidad pre-match y revelación post-match (CC-022 §3, §8, §10).
 *
 * Verificaciones:
 * 1. Feed y Hoja de Oferta:
 *    - Muestra resumen público sin PII de las 3 entregas (zonas, tipos de paquete, medios de pago).
 *    - Oculta nombres de destinatarios, direcciones exactas, indicaciones y montos exactos de cambio.
 * 2. Vista de Viaje del Repartidor (post-match):
 *    - Muestra desglose de las 3 entregas ordenadas por position.
 *    - Revela nombres de clientes, direcciones, indicaciones y monto exacto de cambio por entrega.
 * 3. Vista de Viaje del Comercio (post-match):
 *    - Muestra tarjetas individuales "Avisale a tu cliente" por cada entrega con sus respectivos datos.
 */

const DROP_1_CHANGE = 3000;

test.describe('T-340 — Lectores multi-drop: privacidad y revelación post-match', () => {
  test('DoD: solicitud de 3 entregas proyecta resumen público en feed y revela detalles en viaje post-match', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    assertAllowedE2EEnvironment();

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    const requestId = stagingContext.createdRequestIds[0];
    // createdZoneIds solo registra zonas TRANSITORIAS para cleanup. Si el seed
    // reutiliza zonas activas existentes, el array queda vacío (caso válido).
    // Las 3 zonas para las entregas se consultan y validan contra la DB más abajo.
    if (!merchant || !courier || !requestId) {
      throw new Error(
        '[E2E Error] Se requieren merchant, courier y requestId en stagingContext'
      );
    }

    const admin = createAdminClient();
    const drop1Id = randomUUID();
    const drop2Id = randomUUID();
    const drop3Id = randomUUID();

    // -------------------------------------------------------------------------
    // Paso 1: Configurar la solicitud sembrada con 3 entregas en base de datos
    // -------------------------------------------------------------------------
    const { error: updateReqErr } = await admin
      .from('delivery_requests')
      .update({ drops_count: 3 })
      .eq('id', requestId);
    expect(updateReqErr).toBeNull();

    // Limpiar posibles drops previos del fixture legacy
    const { error: deleteDropsErr } = await admin
      .from('delivery_request_drops')
      .delete()
      .eq('request_id', requestId);
    expect(deleteDropsErr).toBeNull();

    // Obtener al menos 3 zonas activas distintas. Si la base no dispone de 3, creamos zonas de prueba rastreadas
    const { data: dbZones, error: zonesErr } = await admin
      .from('zones')
      .select('id, name')
      .eq('active', true)
      .limit(3);
    expect(zonesErr).toBeNull();

    const distinctZoneIds: string[] = (dbZones ?? []).map((z) => z.id);
    while (distinctZoneIds.length < 3) {
      const extraZoneId = randomUUID();
      const { error: extraZoneErr } = await admin.from('zones').insert({
        id: extraZoneId,
        name: `Zona Test MD ${distinctZoneIds.length + 1}`,
        active: true,
        centroid_lat: -27.405,
        centroid_lng: -65.605,
      });
      expect(extraZoneErr).toBeNull();
      trackEntityForCleanup(stagingContext, 'zone', extraZoneId);
      distinctZoneIds.push(extraZoneId);
    }

    const [zone1, zone2, zone3] = distinctZoneIds as [string, string, string];
    expect(zone1).not.toBe(zone2);
    expect(zone2).not.toBe(zone3);
    expect(zone1).not.toBe(zone3);

    // Insertar 3 drops
    const { error: dropsInsertErr } = await admin.from('delivery_request_drops').insert([
      {
        id: drop1Id,
        request_id: requestId,
        position: 1,
        dropoff_zone_id: zone1,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: true,
        status: 'pending',
      },
      {
        id: drop2Id,
        request_id: requestId,
        position: 2,
        dropoff_zone_id: zone2,
        package_type: 'mediano',
        recipient_payment_method: 'transfer',
        needs_change: false,
        status: 'pending',
      },
      {
        id: drop3Id,
        request_id: requestId,
        position: 3,
        dropoff_zone_id: zone3,
        package_type: 'grande',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'pending',
      },
    ]);
    expect(dropsInsertErr).toBeNull();

    // Insertar contactos privados por entrega
    const { error: contactsInsertErr } = await admin.from('delivery_request_drop_contacts').insert([
      {
        drop_id: drop1Id,
        dropoff_address: 'Av. Sarmiento 100',
        recipient_name: 'Destinatario Uno MD',
        recipient_phone: '3865111111',
        recipient_consent_declared: true,
        cash_change_amount: DROP_1_CHANGE,
        notes: 'Timbre blanco drop 1',
      },
      {
        drop_id: drop2Id,
        dropoff_address: 'San Martín 200',
        recipient_name: 'Destinatario Dos MD',
        recipient_phone: '3865222222',
        recipient_consent_declared: true,
        cash_change_amount: null,
        notes: 'Piso 3 drop 2',
      },
      {
        drop_id: drop3Id,
        dropoff_address: 'Mitre 300',
        recipient_name: 'Destinatario Tres MD',
        recipient_phone: '3865333333',
        recipient_consent_declared: true,
        cash_change_amount: null,
        notes: 'Dejar en guardia drop 3',
      },
    ]);
    expect(contactsInsertErr).toBeNull();

    // -------------------------------------------------------------------------
    // Paso 2: Feed del repartidor pre-match (Privacidad estricta)
    // -------------------------------------------------------------------------
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const requestCard = courierPage.requestCardById(requestId);
    await expect(requestCard).toBeVisible();

    // Verificación de badge multi-drop
    await expect(requestCard.getByText(/3 entregas/i)).toBeVisible();

    // Verificación de privacidad: NO nombres, NO notas, NO monto exacto de cambio
    await expect(requestCard.getByText('Destinatario Uno MD')).toHaveCount(0);
    await expect(requestCard.getByText('Destinatario Dos MD')).toHaveCount(0);
    await expect(requestCard.getByText('Destinatario Tres MD')).toHaveCount(0);
    await expect(requestCard.getByText('Timbre blanco drop 1')).toHaveCount(0);
    await expect(requestCard.getByText('Piso 3 drop 2')).toHaveCount(0);
    await expect(requestCard.getByText('Dejar en guardia drop 3')).toHaveCount(0);
    await expect(requestCard.getByText(formatArs(DROP_1_CHANGE))).toHaveCount(0);

    // Verificación de payload HTTP pre-match fail-closed: respuesta 200, schema válido y sin fugas de datos privados
    const liveRes = await page.request.get('/api/live/available-requests');
    expect(liveRes.status()).toBe(200);
    const rawLiveFeed = (await liveRes.json()) as { data?: unknown[] };

    // 1. Encontrar el ítem crudo antes de cualquier transformación por Zod (H12)
    const rawItem = (rawLiveFeed?.data as Array<Record<string, unknown>> | undefined)?.find(
      (item) => item?.id === requestId
    );
    expect(rawItem).toBeDefined();

    // 2. Inspección recursiva de claves y valores PII directamente sobre el JSON crudo de red
    const forbiddenValues = [
      'Destinatario Uno MD',
      'Destinatario Dos MD',
      'Destinatario Tres MD',
      'Timbre blanco drop 1',
      'Piso 3 drop 2',
      'Dejar en guardia drop 3',
      '3865111111',
      '3865222222',
      '3865333333',
      'Av. Sarmiento 100',
      'San Martín 200',
      'Mitre 300',
      String(DROP_1_CHANGE),
    ];
    assertNoPrivateFieldsInRawPayload(rawItem, forbiddenValues);

    // Comprobación textual recursiva sobre el JSON serializado crudo de red
    const rawItemString = JSON.stringify(rawItem);
    for (const val of forbiddenValues) {
      expect(rawItemString).not.toContain(val);
    }
    for (const key of FORBIDDEN_PRIVATE_KEYS) {
      expect(rawItemString).not.toContain(`"${key}"`);
    }

    // 3. Validación de contrato público con esquema Zod
    const parsedFeed = liveFeedResponseSchema.parse(rawLiveFeed);
    const ownRequestFeed = parsedFeed.data.find((item) => item.id === requestId);
    expect(ownRequestFeed).toBeDefined();
    expect(ownRequestFeed?.dropsCount).toBe(3);
    expect(ownRequestFeed?.drops).toBeDefined();
    expect(ownRequestFeed?.drops).toHaveLength(3);

    // Validación estructural de cada entrega pública
    ownRequestFeed?.drops?.forEach((drop, idx) => {
      expect(drop.position).toBe(idx + 1);
      expect(drop.dropoffZoneName).toBeTruthy();
      expect(drop.packageType).toMatch(/^(chico|mediano|grande)$/);
      expect(drop.recipientPaymentMethod).toMatch(/^(cash|transfer)$/);
    });

    // -------------------------------------------------------------------------
    // Paso 3: Hoja de oferta (Sheet) pre-match
    // -------------------------------------------------------------------------
    await requestCard.getByRole('button', { name: /^ofertar$/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    // Verifica que se lista el desglose de entregas: el badge exacto, no el
    // «Total cotizado: … (3 entregas)» que también aparece en la hoja.
    await expect(sheet.getByText(/^3 entregas$/i)).toBeVisible();
    await expect(sheet.getByText('Destinatario Uno MD')).toHaveCount(0);
    await expect(sheet.getByText('Timbre blanco drop 1')).toHaveCount(0);
    await expect(sheet.getByText(formatArs(DROP_1_CHANGE))).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // -------------------------------------------------------------------------
    // Paso 4: Match autorizado vía RPC accept_offer
    // -------------------------------------------------------------------------
    await seedOffersForFirstRequest(stagingContext);
    const beforeInspection = await getRequestInspectionData(stagingContext, requestId);
    const courierOffer = beforeInspection.offers.find(
      (o) => o.courierId === courier.id && o.status === 'pending'
    );
    if (!courierOffer) {
      throw new Error('[E2E Error] No se encontró oferta pendiente para el repartidor');
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: courierOffer.id,
    });
    expect(acceptErr).toBeNull();

    // -------------------------------------------------------------------------
    // Paso 4b: Repartidor no asignado (ajeno) no puede acceder a los detalles
    // -------------------------------------------------------------------------
    const foreignCourier = stagingContext.courierUsers?.[1];
    expect(foreignCourier).toBeDefined();
    if (foreignCourier) {
      const foreignClient = await createAuthenticatedClient(foreignCourier);
      const { data: foreignTrip, error: foreignErr } = await foreignClient.rpc('get_trip_details', {
        p_request_id: requestId,
      });
      expect(foreignTrip).toBeNull();
      expect(foreignErr).not.toBeNull();
      expect(foreignErr?.code).toBe('P0001');
      expect(foreignErr?.message).toMatch(/UNAUTHORIZED_ACTOR/i);
    }

    // -------------------------------------------------------------------------
    // Paso 5: Vista de Viaje del Repartidor post-match (Revelación autorizada)
    // -------------------------------------------------------------------------
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    // Las 3 entregas con datos privados revelados
    await expect(page.getByText('Destinatario Uno MD')).toBeVisible();
    await expect(page.getByText('Destinatario Dos MD')).toBeVisible();
    await expect(page.getByText('Destinatario Tres MD')).toBeVisible();
    await expect(page.getByText(/Timbre blanco drop 1/i)).toBeVisible();
    await expect(page.getByText(/Piso 3 drop 2/i)).toBeVisible();
    await expect(page.getByText(/Dejar en guardia drop 3/i)).toBeVisible();
    // formatArs devuelve «$ 3.000»: `$` y `.` se escapan para que el regex
    // exija literalmente el monto del drop 1.
    const drop1ChangeLabel = formatArs(DROP_1_CHANGE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(page.getByText(new RegExp(`· cambio de ${drop1ChangeLabel}`, 'i'))).toBeVisible();

    // -------------------------------------------------------------------------
    // Paso 6: Vista de Viaje del Comercio post-match (Avisale a tu cliente)
    // -------------------------------------------------------------------------
    await loginAsMerchant(page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    // Tarjetas individuales de aviso por cliente
    await expect(page.getByText(/Avisale a tu cliente \(Entrega 1\)/i)).toBeVisible();
    await expect(page.getByText(/Avisale a tu cliente \(Entrega 2\)/i)).toBeVisible();
    await expect(page.getByText(/Avisale a tu cliente \(Entrega 3\)/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Avisar a Destinatario Uno MD/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Avisar a Destinatario Dos MD/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Avisar a Destinatario Tres MD/i })).toBeVisible();
  });
});
