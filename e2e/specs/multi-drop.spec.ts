import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';

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
    const zoneId = stagingContext.createdZoneIds[0];

    if (!merchant || !courier || !requestId || !zoneId) {
      throw new Error(
        '[E2E Error] Se requieren merchant, courier, requestId y zoneId en stagingContext'
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
    await admin.from('delivery_request_drops').delete().eq('request_id', requestId);

    // Obtener zonas activas distintas si están disponibles en la base
    const { data: dbZones, error: zonesErr } = await admin
      .from('zones')
      .select('id, name')
      .eq('active', true)
      .limit(3);
    expect(zonesErr).toBeNull();

    const zone1 = dbZones?.[0]?.id ?? zoneId;
    const zone2 = dbZones?.[1]?.id ?? zone1;
    const zone3 = dbZones?.[2]?.id ?? zone1;

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

    // Verificación de payload HTTP pre-match: sin fugas de datos privados en la API
    const liveRes = await page.request.get('/api/live/available-requests');
    if (liveRes.ok()) {
      const liveJson = await liveRes.text();
      expect(liveJson).not.toContain('Destinatario Uno MD');
      expect(liveJson).not.toContain('Timbre blanco drop 1');
      expect(liveJson).not.toContain('3865111111');
      expect(liveJson).not.toContain('Av. Sarmiento 100');
    }

    // -------------------------------------------------------------------------
    // Paso 3: Hoja de oferta (Sheet) pre-match
    // -------------------------------------------------------------------------
    await requestCard.getByRole('button', { name: /^ofertar$/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    // Verifica que se lista el desglose de entregas
    await expect(sheet.getByText(/3 entregas/i)).toBeVisible();
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
    if (foreignCourier) {
      const foreignClient = await createAuthenticatedClient(foreignCourier);
      const { data: foreignTrip } = await foreignClient.rpc('get_trip_details', {
        p_request_id: requestId,
      });
      expect(foreignTrip).toBeNull();
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
    await expect(
      page.getByText(new RegExp(`cambio de ${formatArs(DROP_1_CHANGE)}`, 'i'))
    ).toBeVisible();

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
