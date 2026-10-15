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
 * T-340 Paso 2/4 y Paso 4/4: Multi-drop (CC-022 §3, §8, §10).
 *
 * Verificaciones:
 * 1. Feed y Hoja de Oferta (Lector):
 *    - Muestra resumen público sin PII de las 3 entregas (zonas, tipos de paquete, medios de pago).
 *    - Oculta nombres de destinatarios, direcciones exactas, indicaciones y montos exactos de cambio.
 * 2. Vista de Viaje del Repartidor (post-match):
 *    - Muestra desglose de las 3 entregas ordenadas por position.
 *    - Revela nombres de clientes, direcciones, indicaciones y monto exacto de cambio por entrega.
 * 3. Vista de Viaje del Comercio (post-match):
 *    - Muestra tarjetas individuales "Avisale a tu cliente" por cada entrega con sus respectivos datos.
 * 4. Formulario y Escritor multi-drop desde la UI (Paso 4/4):
 *    - Creación de solicitud con 3 entregas desde `/merchant/requests/new`.
 *    - Verificación en base de datos de estructura de tablas y aislamiento privado.
 *    - Oferta, aceptación y transiciones de estados por entrega hasta cierre de la solicitud.
 */

const DROP_1_CHANGE = 3000;

test.describe('T-340 — Lectores multi-drop: privacidad y revelación post-match', () => {
  test('DoD: solicitud de 3 entregas proyecta resumen público en feed y revela detalles en viaje post-match', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
    browser,
  }, testInfo) => {
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
    // El repartidor sigue autenticado en `page`: /login lo redirigiría a su home.
    // El comercio usa un contexto de navegador aislado, como en fixed-price (T-339).
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) {
      throw new Error('[E2E Error] Falta baseURL para crear el contexto aislado del comercio');
    }
    const merchantContext = await browser.newContext({ baseURL });
    try {
      const merchantBrowserPage = await merchantContext.newPage();
      await loginAsMerchant(merchantBrowserPage);
      await merchantBrowserPage.goto(`/trips/${requestId}`);
      await waitForNoSkeletons(merchantBrowserPage);

      // Tarjetas individuales de aviso por cliente
      await expect(
        merchantBrowserPage.getByText(/Avisale a tu cliente \(Entrega 1\)/i)
      ).toBeVisible();
      await expect(
        merchantBrowserPage.getByText(/Avisale a tu cliente \(Entrega 2\)/i)
      ).toBeVisible();
      await expect(
        merchantBrowserPage.getByText(/Avisale a tu cliente \(Entrega 3\)/i)
      ).toBeVisible();
      await expect(
        merchantBrowserPage.getByRole('link', { name: /Avisar a Destinatario Uno MD/i })
      ).toBeVisible();
      await expect(
        merchantBrowserPage.getByRole('link', { name: /Avisar a Destinatario Dos MD/i })
      ).toBeVisible();
      await expect(
        merchantBrowserPage.getByRole('link', { name: /Avisar a Destinatario Tres MD/i })
      ).toBeVisible();
    } finally {
      await merchantContext.close();
    }
  });

  test('DoD: escritor multi-drop desde la UI crea 3 entregas, valida DB y completa ciclo de viaje', async ({
    page,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
    browser,
  }, testInfo) => {
    assertAllowedE2EEnvironment();

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const admin = createAdminClient();

    // 1. Obtener al menos 3 zonas activas para las entregas
    const { data: dbZones, error: zonesErr } = await admin
      .from('zones')
      .select('id, name')
      .eq('active', true)
      .limit(3);
    expect(zonesErr).toBeNull();

    const distinctZones: Array<{ id: string; name: string }> = [...(dbZones ?? [])];
    while (distinctZones.length < 3) {
      const extraZoneId = randomUUID();
      const zoneName = `Zona E2E Writer ${distinctZones.length + 1}`;
      const { error: extraZoneErr } = await admin.from('zones').insert({
        id: extraZoneId,
        name: zoneName,
        active: true,
        centroid_lat: -27.405,
        centroid_lng: -65.605,
      });
      expect(extraZoneErr).toBeNull();
      trackEntityForCleanup(stagingContext, 'zone', extraZoneId);
      distinctZones.push({ id: extraZoneId, name: zoneName });
    }

    const [zone1, zone2, zone3] = distinctZones as [
      { id: string; name: string },
      { id: string; name: string },
      { id: string; name: string }
    ];

    // -------------------------------------------------------------------------
    // Paso 1: Comercio inicia sesión y va al formulario de nueva solicitud
    // -------------------------------------------------------------------------
    await loginAsMerchant(page);
    await page.goto('/merchant/requests/new');
    await waitForNoSkeletons(page);

    // Completar retiro si está vacío
    const pickupAddressInput = page.getByLabel(/dirección del comercio|dirección de retiro/i);
    const currentPickup = await pickupAddressInput.inputValue();
    if (!currentPickup.trim()) {
      await pickupAddressInput.fill('Av. San Martín 150');
    }

    // Inicialmente hay 1 entrega. Agregar 2 entregas más para llegar a 3
    const addDropBtn = page.getByRole('button', { name: /agregar otra entrega/i });
    await addDropBtn.click();
    await addDropBtn.click();

    const dropCards = page.getByTestId(/^drop-card-/);
    await expect(dropCards).toHaveCount(3);

    // -------------------------------------------------------------------------
    // Paso 2: Llenar las 3 entregas con datos distintos e independientes
    // -------------------------------------------------------------------------
    // Entrega 1: Chico, Efectivo con cambio ($ 2.000)
    const card0 = dropCards.nth(0);
    await card0.locator('select').selectOption(zone1.id);
    await card0.locator('input[id^="dropoff-address-"]').fill('Av. Sarmiento 101');
    await card0.locator('input[id^="recipient-name-"]').fill('Destinatario Uno Writer');
    await card0.locator('input[id^="recipient-phone-"]').fill('3865111111');
    await card0.locator('input[id^="recipient-consent-"]').check();
    await card0.getByRole('button', { name: /^chico/i }).click();
    await card0.getByRole('button', { name: /^efectivo$/i }).click();
    await card0.getByRole('button', { name: /^sí$/i }).click();
    await card0.getByRole('button', { name: /paga con: \$ 2\.000/i }).click();
    await card0.locator('textarea[id^="notes-"]').fill('Indicaciones drop 1 Writer');

    // Entrega 2: Mediano, Transferencia (sin cambio)
    const card1 = dropCards.nth(1);
    await card1.locator('select').selectOption(zone2.id);
    await card1.locator('input[id^="dropoff-address-"]').fill('San Martín 202');
    await card1.locator('input[id^="recipient-name-"]').fill('Destinatario Dos Writer');
    await card1.locator('input[id^="recipient-phone-"]').fill('3865222222');
    await card1.locator('input[id^="recipient-consent-"]').check();
    await card1.getByRole('button', { name: /^mediano/i }).click();
    await card1.getByRole('button', { name: /^transferencia$/i }).click();
    await card1.locator('textarea[id^="notes-"]').fill('Indicaciones drop 2 Writer');

    // Entrega 3: Grande, Efectivo sin cambio
    const card2 = dropCards.nth(2);
    await card2.locator('select').selectOption(zone3.id);
    await card2.locator('input[id^="dropoff-address-"]').fill('Mitre 303');
    await card2.locator('input[id^="recipient-name-"]').fill('Destinatario Tres Writer');
    await card2.locator('input[id^="recipient-phone-"]').fill('3865333333');
    await card2.locator('input[id^="recipient-consent-"]').check();
    await card2.getByRole('button', { name: /^grande/i }).click();
    await card2.getByRole('button', { name: /^efectivo$/i }).click();
    await card2.getByRole('button', { name: /^no$/i }).click();
    await card2.locator('textarea[id^="notes-"]').fill('Indicaciones drop 3 Writer');

    // -------------------------------------------------------------------------
    // Paso 3: Publicar la solicitud y verificar redirección al dashboard
    // -------------------------------------------------------------------------
    const submitBtn = page.getByRole('button', { name: /publicar solicitud/i });
    await submitBtn.click();

    await page.waitForURL(/\/merchant\/dashboard/, { timeout: 15000 });
    await waitForNoSkeletons(page);

    // -------------------------------------------------------------------------
    // Paso 4: Comprobar estructura persistida en la base de datos
    // -------------------------------------------------------------------------
    const { data: createdReqRows, error: findReqErr } = await admin
      .from('delivery_requests')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(findReqErr).toBeNull();
    expect(createdReqRows).not.toBeNull();
    expect(createdReqRows?.length).toBe(1);

    const createdReq = createdReqRows?.[0];
    if (!createdReq) {
      throw new Error('[E2E Error] No se encontró la solicitud creada');
    }
    trackEntityForCleanup(stagingContext, 'request', createdReq.id);

    // 1 fila en delivery_requests con status='published', drops_count=3, notes=null, cash_change_amount=null
    // y todas las columnas legacy de destino en NULL (H04)
    expect(createdReq.status).toBe('published');
    expect(createdReq.drops_count).toBe(3);
    expect(createdReq.notes).toBeNull();
    expect(createdReq.cash_change_amount).toBeNull();
    expect(createdReq.dropoff_zone_id).toBeNull();
    expect(createdReq.package_type).toBeNull();
    expect(createdReq.recipient_payment_method).toBeNull();

    // 1 fila en delivery_request_contacts con solo retiro; datos de destino en NULL (H04)
    const { data: contactsRow, error: contactsErr } = await admin
      .from('delivery_request_contacts')
      .select('*')
      .eq('request_id', createdReq.id)
      .single();
    expect(contactsErr).toBeNull();
    expect(contactsRow).not.toBeNull();
    if (!contactsRow) throw new Error('[E2E Error] Missing contactsRow');
    expect(contactsRow.pickup_address).toBeTruthy();
    expect(contactsRow.dropoff_address).toBeNull();
    expect(contactsRow.dropoff_lat).toBeNull();
    expect(contactsRow.dropoff_lng).toBeNull();
    expect(contactsRow.recipient_name).toBeNull();
    expect(contactsRow.recipient_phone).toBeNull();
    expect(contactsRow.recipient_consent_declared).toBeNull();

    // 3 filas en delivery_request_drops con position 1, 2, 3 en estado pending (guards explícitos H05)
    const { data: dropsRows, error: dropsErr } = await admin
      .from('delivery_request_drops')
      .select('*')
      .eq('request_id', createdReq.id)
      .order('position', { ascending: true });
    expect(dropsErr).toBeNull();
    expect(dropsRows).toHaveLength(3);
    if (!dropsRows || dropsRows.length < 3) throw new Error('[E2E Error] Expected 3 dropsRows');

    const drop0 = dropsRows[0];
    const drop1 = dropsRows[1];
    const drop2 = dropsRows[2];
    if (!drop0 || !drop1 || !drop2) throw new Error('[E2E Error] Missing dropsRows elements');

    expect(drop0.position).toBe(1);
    expect(drop0.status).toBe('pending');
    expect(drop0.package_type).toBe('chico');
    expect(drop0.recipient_payment_method).toBe('cash');
    expect(drop0.needs_change).toBe(true);

    expect(drop1.position).toBe(2);
    expect(drop1.status).toBe('pending');
    expect(drop1.package_type).toBe('mediano');
    expect(drop1.recipient_payment_method).toBe('transfer');
    expect(drop1.needs_change).toBe(false);

    expect(drop2.position).toBe(3);
    expect(drop2.status).toBe('pending');
    expect(drop2.package_type).toBe('grande');
    expect(drop2.recipient_payment_method).toBe('cash');
    expect(drop2.needs_change).toBe(false);

    // 3 filas en delivery_request_drop_contacts con sus datos privados respectivos
    const dropIds = dropsRows.map((d) => d.id);
    const { data: dropContactsRows, error: dropContactsErr } = await admin
      .from('delivery_request_drop_contacts')
      .select('*')
      .in('drop_id', dropIds);
    expect(dropContactsErr).toBeNull();
    expect(dropContactsRows).toHaveLength(3);
    if (!dropContactsRows || dropContactsRows.length < 3) throw new Error('[E2E Error] Expected 3 dropContactsRows');

    const contactsByDropId = new Map(dropContactsRows.map((c) => [c.drop_id, c]));

    const contact1 = contactsByDropId.get(drop0.id);
    expect(contact1?.recipient_name).toBe('Destinatario Uno Writer');
    expect(contact1?.dropoff_address).toBe('Av. Sarmiento 101');
    expect(contact1?.recipient_phone).toBe('3865111111');
    expect(contact1?.cash_change_amount).toBe(2000);
    expect(contact1?.notes).toBe('Indicaciones drop 1 Writer');

    const contact2 = contactsByDropId.get(drop1.id);
    expect(contact2?.recipient_name).toBe('Destinatario Dos Writer');
    expect(contact2?.dropoff_address).toBe('San Martín 202');
    expect(contact2?.cash_change_amount).toBeNull();
    expect(contact2?.notes).toBe('Indicaciones drop 2 Writer');

    const contact3 = contactsByDropId.get(drop2.id);
    expect(contact3?.recipient_name).toBe('Destinatario Tres Writer');
    expect(contact3?.dropoff_address).toBe('Mitre 303');
    expect(contact3?.cash_change_amount).toBeNull();
    expect(contact3?.notes).toBe('Indicaciones drop 3 Writer');

    // -------------------------------------------------------------------------
    // Paso 5: Feed del repartidor y privacidad pre-match en UI y HTTP fail-closed (H04)
    // -------------------------------------------------------------------------
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) {
      throw new Error('[E2E Error] Falta baseURL');
    }

    const courierContext = await browser.newContext({ baseURL });
    try {
      const courierBrowserPage = await courierContext.newPage();
      await loginAsCourier(0, courierBrowserPage);
      await courierBrowserPage.goto('/courier/feed');
      await waitForNoSkeletons(courierBrowserPage);

      // El repartidor ve el badge «3 entregas» y NO ve PII en UI
      await expect(courierBrowserPage.getByText(/3 entregas/i).first()).toBeVisible();
      await expect(courierBrowserPage.getByText('Destinatario Uno Writer')).toHaveCount(0);
      await expect(courierBrowserPage.getByText('Indicaciones drop 1 Writer')).toHaveCount(0);
      await expect(courierBrowserPage.getByText(formatArs(2000))).toHaveCount(0);

      // Verificación de HTTP live feed pre-match fail-closed: sin fugas de PII ni coordenadas privadas (H04)
      const liveRes = await courierBrowserPage.request.get('/api/live/available-requests');
      expect(liveRes.status()).toBe(200);
      const rawLiveFeed = (await liveRes.json()) as { data?: unknown[] };
      const rawItem = (rawLiveFeed?.data as Array<Record<string, unknown>> | undefined)?.find(
        (item) => item?.id === createdReq.id
      );
      expect(rawItem).toBeDefined();

      const forbiddenValues = [
        'Destinatario Uno Writer',
        'Destinatario Dos Writer',
        'Destinatario Tres Writer',
        'Indicaciones drop 1 Writer',
        'Indicaciones drop 2 Writer',
        'Indicaciones drop 3 Writer',
        '3865111111',
        '3865222222',
        '3865333333',
        'Av. Sarmiento 101',
        'San Martín 202',
        'Mitre 303',
        '2000',
      ];
      assertNoPrivateFieldsInRawPayload(rawItem, forbiddenValues);
      const rawItemString = JSON.stringify(rawItem);
      for (const val of forbiddenValues) {
        expect(rawItemString).not.toContain(val);
      }
      for (const key of FORBIDDEN_PRIVATE_KEYS) {
        expect(rawItemString).not.toContain(`"${key}"`);
      }

      // -------------------------------------------------------------------------
      // Paso 6: Oferta real con courier autenticado y aceptación por merchant (H02)
      // -------------------------------------------------------------------------
      const courierClient = await createAuthenticatedClient(courier);
      const offerAmountArs = 1500;
      const { data: submitOfferData, error: submitOfferErr } = await courierClient.rpc(
        'submit_offer',
        {
          p_request_id: createdReq.id,
          p_amount_ars: offerAmountArs,
          p_eta_minutes: 20,
          p_message: 'Oferta real E2E escritor',
        }
      );
      expect(submitOfferErr).toBeNull();
      expect(submitOfferData).not.toBeNull();

      const parsedSubmit = submitOfferData as { offerId: string; totalAmountArs: number };
      expect(parsedSubmit.offerId).toBeTruthy();
      // Afirmar totalAmountArs = amountArs * 3 (H04)
      expect(parsedSubmit.totalAmountArs).toBe(offerAmountArs * 3);
      trackEntityForCleanup(stagingContext, 'offer', parsedSubmit.offerId);

      // Comercio acepta la oferta
      const merchantClient = await createAuthenticatedClient(merchant);
      const { data: acceptOfferData, error: acceptErr } = await merchantClient.rpc('accept_offer', {
        p_offer_id: parsedSubmit.offerId,
      });
      expect(acceptErr).toBeNull();
      const parsedAccept = acceptOfferData as { idempotent: boolean; totalAmountArs: number };
      expect(parsedAccept.totalAmountArs).toBe(offerAmountArs * 3);
      expect(parsedAccept.idempotent).toBe(false);

      // Idempotencia de accept_offer (H04)
      const { data: acceptRetryData, error: acceptRetryErr } = await merchantClient.rpc(
        'accept_offer',
        {
          p_offer_id: parsedSubmit.offerId,
        }
      );
      expect(acceptRetryErr).toBeNull();
      const parsedAcceptRetry = acceptRetryData as { idempotent: boolean; totalAmountArs: number };
      expect(parsedAcceptRetry.idempotent).toBe(true);
      expect(parsedAcceptRetry.totalAmountArs).toBe(offerAmountArs * 3);

      // -------------------------------------------------------------------------
      // Paso 7: Precondición de pickup antes de marcar drops (H01 BLOQUEANTE)
      // -------------------------------------------------------------------------
      // Demostrar NEGATIVO: en estado 'matched', mark_drop_delivered DEBE fallar antes del pickup
      const { error: prematureErr } = await courierClient.rpc('mark_drop_delivered', {
        p_drop_id: drop0.id,
      });
      expect(prematureErr).not.toBeNull();
      expect(prematureErr?.message).toMatch(/INVALID_STATE_TRANSITION/i);

      // Ejecutar mark_picked_up con courier autenticado
      const { error: pickupErr } = await courierClient.rpc('mark_picked_up', {
        p_request_id: createdReq.id,
      });
      expect(pickupErr).toBeNull();

      // Comprobar solicitud en estado 'in_transit' ANTES de marcar drops (H01)
      const { data: inTransitReq, error: inTransitErr } = await admin
        .from('delivery_requests')
        .select('status, picked_up_at')
        .eq('id', createdReq.id)
        .single();
      expect(inTransitErr).toBeNull();
      expect(inTransitReq?.status).toBe('in_transit');
      expect(inTransitReq?.picked_up_at).not.toBeNull();

      // -------------------------------------------------------------------------
      // Paso 8: Vista de viaje del repartidor post-match revela los datos privados
      // -------------------------------------------------------------------------
      await courierBrowserPage.goto(`/trips/${createdReq.id}`);
      await waitForNoSkeletons(courierBrowserPage);

      await expect(courierBrowserPage.getByText('Destinatario Uno Writer')).toBeVisible();
      await expect(courierBrowserPage.getByText('Destinatario Dos Writer')).toBeVisible();
      await expect(courierBrowserPage.getByText('Destinatario Tres Writer')).toBeVisible();
      await expect(courierBrowserPage.getByText(/Indicaciones drop 1 Writer/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(/Indicaciones drop 2 Writer/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(/Indicaciones drop 3 Writer/i)).toBeVisible();

      // -------------------------------------------------------------------------
      // Paso 9: Repartidor completa 2 delivered + 1 failed con RPC e idempotencia (H04)
      // -------------------------------------------------------------------------
      // Drop 1: entregado
      const { data: mark1Data, error: mark1Err } = await courierClient.rpc('mark_drop_delivered', {
        p_drop_id: drop0.id,
      });
      expect(mark1Err).toBeNull();
      expect((mark1Data as { idempotent: boolean }).idempotent).toBe(false);

      // Idempotencia de mark_drop_delivered (Drop 1)
      const { data: mark1RetryData, error: mark1RetryErr } = await courierClient.rpc(
        'mark_drop_delivered',
        {
          p_drop_id: drop0.id,
        }
      );
      expect(mark1RetryErr).toBeNull();
      expect((mark1RetryData as { idempotent: boolean }).idempotent).toBe(true);

      // Drop 2: entregado
      const { data: mark2Data, error: mark2Err } = await courierClient.rpc('mark_drop_delivered', {
        p_drop_id: drop1.id,
      });
      expect(mark2Err).toBeNull();
      expect((mark2Data as { idempotent: boolean }).idempotent).toBe(false);

      // Drop 3: fallido
      const { data: mark3Data, error: mark3Err } = await courierClient.rpc('mark_drop_failed', {
        p_drop_id: drop2.id,
        p_reason: 'Destinatario no atendió en el domicilio',
      });
      expect(mark3Err).toBeNull();
      expect((mark3Data as { idempotent: boolean }).idempotent).toBe(false);

      // Idempotencia de mark_drop_failed (Drop 3)
      const { data: mark3RetryData, error: mark3RetryErr } = await courierClient.rpc(
        'mark_drop_failed',
        {
          p_drop_id: drop2.id,
          p_reason: 'Destinatario no atendió en el domicilio',
        }
      );
      expect(mark3RetryErr).toBeNull();
      expect((mark3RetryData as { idempotent: boolean }).idempotent).toBe(true);

      // Verificar estado de cada drop en DB
      const { data: finalDrops, error: finalDropsErr } = await admin
        .from('delivery_request_drops')
        .select('id, status')
        .eq('request_id', createdReq.id);
      expect(finalDropsErr).toBeNull();
      const deliveredCount = (finalDrops ?? []).filter((d) => d.status === 'delivered').length;
      const failedCount = (finalDrops ?? []).filter((d) => d.status === 'failed').length;
      expect(deliveredCount).toBe(2);
      expect(failedCount).toBe(1);

      // Afirmar totalAmountArs y collectibleAmountArs en la UI autenticada del courier (H04)
      await courierBrowserPage.goto(`/trips/${createdReq.id}`);
      await waitForNoSkeletons(courierBrowserPage);

      // Comprobar total cotizado ($ 4.500) en TripCourierView
      await expect(courierBrowserPage.getByText(formatArs(4500))).toBeVisible();
      // Comprobar desglose de 3 entregas y monto a cobrar derivado por el lector real ($ 3.000)
      await expect(
        courierBrowserPage.getByText(new RegExp(`A cobrar:\\s*${formatArs(3000).replace('$', '\\$')}`, 'i'))
      ).toBeVisible();
      await expect(courierBrowserPage.getByText(/3 entregas/i).first()).toBeVisible();

      // Solicitud finaliza en 'delivered' con delivered_at registrado
      const { data: finalReq, error: finalReqErr } = await admin
        .from('delivery_requests')
        .select('status, delivered_at')
        .eq('id', createdReq.id)
        .single();

      expect(finalReqErr).toBeNull();
      expect(finalReq).not.toBeNull();
      if (!finalReq) throw new Error('[E2E Error] Missing finalReq');
      expect(finalReq.status).toBe('delivered');
      expect(finalReq.delivered_at).not.toBeNull();
    } finally {
      await courierContext.close();
    }
  });

  test('DoD: solicitud multi-drop con todas las entregas fallidas finaliza en delivered con collectibleAmountArs=0', async ({
    page,
    loginAsCourier,
    stagingContext,
  }) => {
    assertAllowedE2EEnvironment();

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const admin = createAdminClient();
    const requestId = randomUUID();
    const dropAId = randomUUID();
    const dropBId = randomUUID();
    trackEntityForCleanup(stagingContext, 'request', requestId);

    // 1. Zonas activas
    const { data: zones } = await admin.from('zones').select('id').eq('active', true).limit(2);
    const zoneId = zones?.[0]?.id;
    if (!zoneId) throw new Error('[E2E Error] Se requiere al menos una zona activa');

    // 2. Insertar solicitud de prueba en estado published
    await admin.from('delivery_requests').insert({
      id: requestId,
      merchant_id: merchant.id,
      pickup_zone_id: zoneId,
      status: 'published',
      drops_count: 2,
    });
    await admin.from('delivery_request_contacts').insert({
      request_id: requestId,
      pickup_address: 'Av. Sarmiento 100',
    });
    await admin.from('delivery_request_drops').insert([
      {
        id: dropAId,
        request_id: requestId,
        position: 1,
        dropoff_zone_id: zoneId,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'pending',
      },
      {
        id: dropBId,
        request_id: requestId,
        position: 2,
        dropoff_zone_id: zoneId,
        package_type: 'chico',
        recipient_payment_method: 'transfer',
        needs_change: false,
        status: 'pending',
      },
    ]);
    await admin.from('delivery_request_drop_contacts').insert([
      {
        drop_id: dropAId,
        dropoff_address: 'Mitre 10',
        recipient_name: 'Cliente A',
        recipient_phone: '3865100000',
        recipient_consent_declared: true,
      },
      {
        drop_id: dropBId,
        dropoff_address: 'Mitre 20',
        recipient_name: 'Cliente B',
        recipient_phone: '3865200000',
        recipient_consent_declared: true,
      },
    ]);

    // 3. Oferta real y aceptación
    const courierClient = await createAuthenticatedClient(courier);
    const offerAmountArs = 1200;
    const { data: offerData, error: offerErr } = await courierClient.rpc('submit_offer', {
      p_request_id: requestId,
      p_amount_ars: offerAmountArs,
      p_eta_minutes: 15,
      p_message: 'Oferta test all failed',
    });
    expect(offerErr).toBeNull();
    const offerId = (offerData as { offerId: string })?.offerId;
    expect(offerId).toBeTruthy();
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerId,
    });
    expect(acceptErr).toBeNull();

    // 4. Pickup
    const { error: pickupErr } = await courierClient.rpc('mark_picked_up', {
      p_request_id: requestId,
    });
    expect(pickupErr).toBeNull();

    // 5. Marcar TODAS las entregas como fallidas
    const { error: fail1Err } = await courierClient.rpc('mark_drop_failed', {
      p_drop_id: dropAId,
      p_reason: 'Domicilio inexistente',
    });
    expect(fail1Err).toBeNull();

    const { error: fail2Err } = await courierClient.rpc('mark_drop_failed', {
      p_drop_id: dropBId,
      p_reason: 'Destinatario rechazó el paquete',
    });
    expect(fail2Err).toBeNull();

    // 6. Invariante CC-022 §6: solicitud cierra en 'delivered' aunque todas hayan fallado
    const { data: finalReq, error: finalReqErr } = await admin
      .from('delivery_requests')
      .select('status, delivered_at')
      .eq('id', requestId)
      .single();
    expect(finalReqErr).toBeNull();
    expect(finalReq?.status).toBe('delivered');
    expect(finalReq?.delivered_at).not.toBeNull();

    // Importe cobrable derivado para entregas entregadas es 0
    const { data: allDrops } = await admin
      .from('delivery_request_drops')
      .select('status')
      .eq('request_id', requestId);
    const deliveredCount = (allDrops ?? []).filter((d) => d.status === 'delivered').length;
    expect(deliveredCount).toBe(0);

    // 7. En el caso todas fallidas, verificar en la UI auténtica que se muestra 'A cobrar: $ 0' (H04)
    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    await expect(
      page.getByText(new RegExp(`A cobrar:\\s*${formatArs(0).replace('$', '\\$')}`, 'i'))
    ).toBeVisible();
    await expect(page.getByText(/2 entregas/i).first()).toBeVisible();
  });

  test('T-353 / PR362-H06: rechaza teléfono o destinatario inválido en el formulario de pedido y permite corregir sin perder datos', async ({
    page,
    loginAsMerchant,
  }) => {
    assertAllowedE2EEnvironment();
    await loginAsMerchant(page);
    await page.goto('/merchant/requests/new');
    await waitForNoSkeletons(page);

    const phoneInput = page.locator('input[name*="recipientPhone"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('3815551234abc');
      await phoneInput.blur();

      const submitBtn = page.getByRole('button', { name: /publicar solicitud/i });
      await submitBtn.click();
      await expect(page.getByText(/El teléfono debe ser un número argentino válido/i)).toBeVisible();

      // Corregir teléfono
      await phoneInput.fill('3815551234');
      await phoneInput.blur();
      await expect(page.getByText(/El teléfono debe ser un número argentino válido/i)).not.toBeVisible();
    }
  });
});
