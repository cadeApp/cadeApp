import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
} from '../fixtures';
import { formatArs, formatPhone } from '@/lib/format';
import { extractValidArgentineTenDigits } from '@/lib/whatsapp';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { LoginPage, MerchantPage, TripPage } from '../pages';

/**
 * T-303: Suite E2E del flujo principal de cadeApp
 *
 * Flujo completo con backend y UI reales (sin mocks de páginas HTML ni de RPCs de aceptación):
 * 1. Revelación progresiva: el repartidor no aceptado NO ve el teléfono del destinatario.
 * 2. Aceptación concurrente en dos pestañas: exclusión mutua backend (ALREADY_MATCHED) con oráculo de estado final.
 * 3. Publicación real de solicitud (efectivo con cambio y transferencia).
 * 4. Repartidor oferta respetando el piso mínimo dinámico (min_offer_ars).
 * 5. Repartidor retira oferta pendiente desde "Mis ofertas" con modal de confirmación.
 * 6. Comercio visualiza ofertas y alterna ordenamiento entre Documentación y Precio.
 * 7. Vista de viaje: enlace WhatsApp "Avisar a mi cliente", medio de pago y avance de viaje (retirado -> entregado).
 */

test.describe('T-303 — Flujo principal y reglas de negocio', () => {
  // ---------------------------------------------------------------------------
  // DoD Invariante 1: Revelación progresiva de datos de contacto (PR160-H01 / PR160-H11)
  // ---------------------------------------------------------------------------
  test('DoD: Falla si el repartidor no aceptado ve el teléfono del destinatario', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    // Precrear ofertas para que Courier 1 posea una oferta activa y se verifique
    // la exclusión de teléfono tanto en el feed general como en "Mis ofertas"
    await seedOffersForFirstRequest(stagingContext);

    const sentinelPhone = stagingContext.sentinelPhone ?? '+5493865123456';
    const rawSentinelDigits = sentinelPhone.replace(/\D/g, '');
    const formattedSentinelPhone = formatPhone(sentinelPhone);
    const nationalDigits = formattedSentinelPhone.replace(/\D/g, '');

    // Autenticarse como repartidor no asignado (Courier 1)
    await loginAsCourier(1, page);

    const assertNoSentinelPhoneLeak = async (targetPage: typeof page) => {
      // Verificar exhaustivamente que el teléfono sentinel NO aparezca en DOM, texto ni enlaces
      const pageContent = await targetPage.content();
      expect(pageContent).not.toContain(sentinelPhone);
      expect(pageContent).not.toContain(rawSentinelDigits);
      expect(pageContent).not.toContain(formattedSentinelPhone);

      await expect(targetPage.getByText(sentinelPhone)).not.toBeVisible();
      await expect(targetPage.getByText(rawSentinelDigits)).not.toBeVisible();
      await expect(
        targetPage.getByText(formattedSentinelPhone, { exact: false })
      ).not.toBeVisible();

      // Comprobar que ninguna línea visible contenga los 10 dígitos nacionales
      const visibleLines = (await targetPage.locator('body').innerText()).split(/\r?\n/);
      for (const line of visibleLines) {
        expect(line.replace(/\D/g, '')).not.toContain(nationalDigits);
      }

      // Comprobar que ningún href del DOM contenga los 10 dígitos nacionales
      const hrefs = await targetPage.locator('a[href]').evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? '')
      );
      for (const href of hrefs) {
        expect(href.replace(/\D/g, '')).not.toContain(nationalDigits);
      }
    };

    // 1. Explorar el feed de solicitudes disponibles
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);
    await assertNoSentinelPhoneLeak(page);

    // 2. Explorar la vista de ofertas del repartidor
    await page.goto('/courier/offers');
    await waitForNoSkeletons(page);
    await assertNoSentinelPhoneLeak(page);
  });

  // ---------------------------------------------------------------------------
  // DoD Invariante 2: Aceptación concurrente en dos sesiones independientes (PR360-H05 / R01 / PR160-H02)
  // ---------------------------------------------------------------------------
  test('DoD: Aceptación concurrente en dos sesiones independientes navega a /trips/[id] y converge', async ({
    browser,
    stagingContext,
  }, testInfo) => {
    // Precrear explícitamente las dos ofertas que competirán en concurrencia
    await seedOffersForFirstRequest(stagingContext);

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }
    const merchant = stagingContext.merchantUser;
    if (!merchant) {
      throw new Error('[E2E Error] No merchant user seeded in stagingContext');
    }

    const context1 = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const context2 = await browser.newContext({ baseURL: testInfo.project.use.baseURL });

    try {
      // Sesión 1: Comercio autenticado en contexto 1
      const page1 = await context1.newPage();
      const loginPage1 = new LoginPage(page1);
      await loginPage1.navigate();
      await loginPage1.login(merchant.email, merchant.password);

      // Sesión 2: Mismo comercio autenticado en contexto 2 independiente
      const page2 = await context2.newPage();
      const loginPage2 = new LoginPage(page2);
      await loginPage2.navigate();
      await loginPage2.login(merchant.email, merchant.password);

      const merchantPage1 = new MerchantPage(page1);
      await merchantPage1.gotoRequestDetail(targetRequestId);
      await waitForNoSkeletons(page1);

      const merchantPage2 = new MerchantPage(page2);
      await merchantPage2.gotoRequestDetail(targetRequestId);
      await waitForNoSkeletons(page2);

      // Sesión 1 abre modal sobre la primera oferta
      await merchantPage1.acceptOfferButton.first().click();
      await expect(merchantPage1.confirmAcceptButton).toBeVisible();

      // Sesión 2 abre modal sobre la segunda oferta
      await merchantPage2.acceptOfferButton.nth(1).click();
      await expect(merchantPage2.confirmAcceptButton).toBeVisible();

      // Disparar las confirmaciones en paralelo real mediante barrera Promise.all
      await Promise.all([
        merchantPage1.confirmAcceptButton.click(),
        merchantPage2.confirmAcceptButton.click(),
      ]);

      // Al menos una sesión debe reflejar rechazo específico por concurrencia ALREADY_MATCHED
      const alert1 = merchantPage1.alreadyMatchedAlert;
      const alert2 = merchantPage2.alreadyMatchedAlert;
      let loserIndex: 1 | 2 | null = null;
      await expect
        .poll(
          async () => {
            const is1 = await alert1.isVisible().catch(() => false);
            if (is1) {
              loserIndex = 1;
              return true;
            }
            const is2 = await alert2.isVisible().catch(() => false);
            if (is2) {
              loserIndex = 2;
              return true;
            }
            return false;
          },
          {
            message: 'Una de las dos sesiones debe mostrar el rechazo ALREADY_MATCHED',
            timeout: 10000,
            intervals: [250, 500, 1000],
          }
        )
        .toBe(true);

      expect(loserIndex).not.toBeNull();
      const winnerPage = loserIndex === 1 ? page2 : page1;
      const loserPage = loserIndex === 1 ? page1 : page2;
      const loserMerchantPage = loserIndex === 1 ? merchantPage1 : merchantPage2;

      // PR360-H02 / H05: En el actor perdedor, verificar alerta ALREADY_MATCHED y 0 botones Aceptar antes de forzar navegación
      await expect(loserMerchantPage.alreadyMatchedAlert).toBeVisible();
      await expect(loserPage.getByRole('button', { name: /^aceptar$/i })).toHaveCount(0);

      // PR360-R01: Esperar explícitamente a que la sesión ganadora complete la navegación a /trips/[id]
      await expect(winnerPage).toHaveURL(new RegExp(`/trips/${targetRequestId}`), {
        timeout: 15000,
      });
      await waitForNoSkeletons(winnerPage);

      // Oráculo de estado final en DB: exactamente 1 oferta accepted y request en matched
      let finalInspection: Awaited<ReturnType<typeof getRequestInspectionData>> | null = null;
      await expect
        .poll(
          async () => {
            const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
            finalInspection = inspection;
            const acceptedOffers = inspection.offers.filter((o) => o.status === 'accepted');
            const nonAcceptedOffers = inspection.offers.filter((o) => o.status !== 'accepted');
            return {
              requestStatus: inspection.requestStatus,
              acceptedOfferId: inspection.acceptedOfferId,
              acceptedCount: acceptedOffers.length,
              nonAcceptedCount: nonAcceptedOffers.length,
              matchedWinner: acceptedOffers[0]?.id === inspection.acceptedOfferId,
            };
          },
          {
            message:
              'Debe haber exactamente 1 oferta accepted, la otra no accepted, request en matched y accepted_offer_id coincidente',
            timeout: 10000,
            intervals: [250, 500, 1000],
          }
        )
        .toEqual({
          requestStatus: 'matched',
          acceptedOfferId: expect.any(String),
          acceptedCount: 1,
          nonAcceptedCount: 1,
          matchedWinner: true,
        });

      // PR360-H05: Oráculos completos y no condicionales (sin envoltorios que oculten fallas)
      const inspectionData =
        finalInspection ?? (await getRequestInspectionData(stagingContext, targetRequestId));
      const acceptedOffer = inspectionData.offers.find(
        (o) => o.id === inspectionData.acceptedOfferId
      );
      expect(acceptedOffer).toBeDefined();
      if (!acceptedOffer) {
        throw new Error('acceptedOffer no encontrada en inspectionData');
      }

      // Resolver courier asignado a partir del stagingContext
      const courier = stagingContext.courierUsers?.find(
        (c) => c.id === acceptedOffer.courierId
      );
      expect(courier).toBeDefined();
      if (!courier) {
        throw new Error(
          `courier con id ${acceptedOffer.courierId} no encontrado en stagingContext.courierUsers`
        );
      }

      // H05: En la sesión ganadora, verificar la vista del viaje con datos auténticos
      const tripPageWinner = new TripPage(winnerPage);
      await expect(tripPageWinner.assignedStatus).toBeVisible();
      await expect(
        winnerPage.getByRole('heading', { level: 2, name: /repartidor asignado/i })
      ).toBeVisible();
      await expect(
        winnerPage.getByRole('heading', { level: 3, name: courier.displayName })
      ).toBeVisible();
      const courierCard = winnerPage
        .getByRole('heading', { level: 2, name: /repartidor asignado/i })
        .locator('..')
        .locator('..');
      const acceptedAmount = courierCard.getByText(formatArs(acceptedOffer.amountArs), {
        exact: true,
      });
      await expect(acceptedAmount).toHaveCount(1);
      await expect(acceptedAmount).toBeVisible();
      const paymentLabel = courierCard.getByText(/Medio de pago:\s*Efectivo/i);
      await expect(paymentLabel).toHaveCount(1);
      await expect(paymentLabel).toBeVisible();

      // Contacto de repartidor habilitado post-match con enlace real WhatsApp
      const waLink = winnerPage.getByRole('link', { name: /^whatsapp$/i });
      await expect(waLink).toBeVisible();
      expect(courier.phone).toBeDefined();
      if (courier.phone) {
        const rawTenDigits = extractValidArgentineTenDigits(courier.phone);
        await expect(waLink).toHaveAttribute('href', new RegExp(`wa\\.me/549${rawTenDigits}`));
      }

      // PR360-R02 - A) En la sesión ganadora, ejecutar reload() mientras sigue en /trips/[id]
      await winnerPage.reload();
      await waitForNoSkeletons(winnerPage);
      await expect(winnerPage).toHaveURL(new RegExp(`/trips/${targetRequestId}`));
      await expect(tripPageWinner.assignedStatus).toBeVisible();
      await expect(
        winnerPage.getByRole('heading', { level: 3, name: courier.displayName })
      ).toBeVisible();
      await expect(acceptedAmount).toHaveCount(1);
      await expect(acceptedAmount).toBeVisible();
      await expect(paymentLabel).toHaveCount(1);
      await expect(paymentLabel).toBeVisible();
      await expect(winnerPage.getByRole('button', { name: /^aceptar$/i })).toHaveCount(0);

      // PR360-R02 - B) Back en el historial del navegador: replace sustituyó la entrada actual.
      // Esperar a que la navegación termine; en cualquier destino jamás mostrar selector ni botones Aceptar.
      await winnerPage.goBack();
      await waitForNoSkeletons(winnerPage);
      if (winnerPage.url().includes(`/merchant/requests/${targetRequestId}`)) {
        await expect(winnerPage).toHaveURL(new RegExp(`/trips/${targetRequestId}`));
      }
      await expect(winnerPage.getByRole('button', { name: /^aceptar$/i })).toHaveCount(0);

      // PR360-R02 - C) Independientemente de dónde terminó Back, navegar directamente a /merchant/requests/[id]
      // debe redirigir server-side canónicamente al viaje y no mostrar botones Aceptar
      await winnerPage.goto(`/merchant/requests/${targetRequestId}`);
      await waitForNoSkeletons(winnerPage);
      await expect(winnerPage).toHaveURL(new RegExp(`/trips/${targetRequestId}`));
      await expect(winnerPage.getByRole('button', { name: /^aceptar$/i })).toHaveCount(0);

      // H05: La sesión perdedora, al navegar directamente a /merchant/requests/[id], es redirigida al viaje
      await loserPage.goto(`/merchant/requests/${targetRequestId}`);
      await waitForNoSkeletons(loserPage);
      await expect(loserPage).toHaveURL(new RegExp(`/trips/${targetRequestId}`));
      await expect(loserPage.getByRole('button', { name: /^aceptar$/i })).toHaveCount(0);

      // En el dashboard del comercio, "Ver detalle" vincula a /trips/[id]
      const merchantDashPage = new MerchantPage(winnerPage);
      await merchantDashPage.navigate();
      await waitForNoSkeletons(winnerPage);
      const detailLink = winnerPage.getByRole('link', { name: /ver detalle/i }).first();
      await expect(detailLink).toHaveAttribute('href', `/trips/${targetRequestId}`);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Flujo 1: Publicación de solicitud con efectivo y cambio (PR160-H03 / PR160-H08)
  // ---------------------------------------------------------------------------
  test('Flujo 1: Publicación de solicitud con datos de entrega, paquete y medio de pago', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    // Completar dirección de retiro si no está precargada
    const pickupVal = await merchantPage.pickupAddressInput.inputValue();
    if (!pickupVal.trim()) {
      await merchantPage.pickupAddressInput.fill('San Martín 150');
    }

    // Datos de entrega
    await merchantPage.dropoffAddressInput.fill('Av. Mitre 450');
    await merchantPage.recipientNameInput.fill('María Elena Walsh');
    await merchantPage.recipientPhoneInput.fill('3865123456');

    // Consentimiento del destinatario obligatorio
    await merchantPage.consentCheckbox.check();

    // Tamaño del paquete
    await merchantPage.packageChicoButton.click();

    // Medio de pago: efectivo con cambio
    await merchantPage.paymentCashButton.click();
    await merchantPage.needsChangeYesButton.click();
    await merchantPage.changePresetButton(5000).click();

    // Completar indicaciones con marcador unívoco de la corrida
    const notesMarker = `E2E cash ${stagingContext.testRunId}`;
    await merchantPage.notesInput.fill(notesMarker);

    // Publicar solicitud con el botón real de UI
    await merchantPage.submitRequestButton.click();

    // Esperar navegación fuera del formulario de alta
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Resolver el ID exacto de la solicitud creada mediante el helper server-side
    const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);

    // Navegar directamente a la vista de detalle de esa solicitud específica
    await merchantPage.gotoRequestDetail(createdRequestId);
    await waitForNoSkeletons(page);

    // Verificar en el detalle específico: Paquete chico, Efectivo, cambio y monto real formatArs(5000)
    await expect(page.getByText(/paquete chico/i)).toBeVisible();
    await expect(page.getByText(/efectivo/i)).toBeVisible();
    await expect(page.getByText(/paga con/i)).toBeVisible();
    await expect(page.getByText(formatArs(5000))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 1b: Publicación de solicitud con transferencia (PR160-H03 / PR160-H08)
  // ---------------------------------------------------------------------------
  test('Flujo 1b: Publicación de solicitud con medio de pago transferencia', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const pickupVal = await merchantPage.pickupAddressInput.inputValue();
    if (!pickupVal.trim()) {
      await merchantPage.pickupAddressInput.fill('San Martín 150');
    }

    await merchantPage.dropoffAddressInput.fill('Belgrano 800');
    await merchantPage.recipientNameInput.fill('Juan Bautista Alberdi');
    await merchantPage.recipientPhoneInput.fill('3865654321');
    await merchantPage.consentCheckbox.check();

    await merchantPage.packageChicoButton.click();

    // Medio de pago: transferencia (sin cambio)
    await merchantPage.paymentTransferButton.click();

    // Completar indicaciones con marcador unívoco de la corrida
    const notesMarker = `E2E transfer ${stagingContext.testRunId}`;
    await merchantPage.notesInput.fill(notesMarker);

    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Resolver el ID exacto de la solicitud creada mediante el helper server-side
    const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);

    // Navegar directamente a la vista de detalle de esa solicitud específica
    await merchantPage.gotoRequestDetail(createdRequestId);
    await waitForNoSkeletons(page);

    // Verificar en el detalle específico: Paquete chico, Transferencia y ausencia de datos de cambio
    await expect(page.getByText(/paquete chico/i)).toBeVisible();
    await expect(page.getByText(/transferencia/i)).toBeVisible();
    await expect(page.getByText(/paga con|cambio/i)).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 2: Repartidor oferta respetando el piso mínimo dinámico (PR160-H03)
  // ---------------------------------------------------------------------------
  test('Flujo 2: Repartidor oferta respetando el piso mínimo de la plataforma', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
  }) => {
    await loginAsCourier(0, page);
    await courierPage.gotoFeed();
    await waitForNoSkeletons(page);

    // Identificar de forma inequívoca la solicitud sembrada en la corrida actual
    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }
    const targetCard = courierPage.requestCardById(targetRequestId);
    await expect(targetCard).toBeVisible();

    // Abrir la solicitud
    await targetCard.getByRole('button', { name: /^ofertar$/i }).click();

    // Leer el piso mínimo dinámico configurado en la UI (platform_settings.min_offer_ars)
    const floorText = (await courierPage.minFloorText.textContent()) || '';
    const rawNumber = floorText.replace(/\D/g, '');
    const minOfferArs = parseInt(rawNumber, 10);
    expect(minOfferArs).toBeGreaterThan(0);

    // 1. Intentar ofertar por debajo del piso: minOfferArs - 1
    const invalidAmount = minOfferArs - 1;
    await courierPage.offerAmountInput.fill(String(invalidAmount));
    await courierPage.submitOfferButton.click();

    // Debe mostrar rechazo visible en alert y no enviar la oferta
    await expect(courierPage.offerErrorAlert).toBeVisible();

    // 2. Ofertar con monto válido respetando el piso
    const validAmount = minOfferArs + 500;
    await courierPage.offerAmountInput.fill(String(validAmount));
    await courierPage.submitOfferButton.click();

    // Esperar el resultado real de la Server Action antes de abandonar el sheet.
    await expect(page.getByText(/¡Oferta enviada con éxito!/i)).toBeVisible({ timeout: 10000 });

    // Ir a "Mis ofertas" y verificar que la oferta aparezca con formato ARS real
    await courierPage.gotoOffers();
    await waitForNoSkeletons(page);
    await expect(page.getByText(formatArs(validAmount))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 3: Retiro de oferta pendiente con confirmación (PR160-H03)
  // ---------------------------------------------------------------------------
  test('Flujo 3: Repartidor puede retirar una oferta pendiente', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
  }) => {
    // Precrear las ofertas para que Courier 0 posea una oferta activa para retirar
    await seedOffersForFirstRequest(stagingContext);

    await loginAsCourier(0, page);
    await courierPage.gotoOffers();
    await waitForNoSkeletons(page);

    // Debe existir al menos una oferta en estado pendiente
    await expect(courierPage.withdrawOfferButton.first()).toBeVisible();
    await courierPage.withdrawOfferButton.first().click();

    // Diálogo de confirmación accesible
    await expect(courierPage.confirmWithdrawButton).toBeVisible();
    await courierPage.confirmWithdrawButton.click();

    // Cambiar a la pestaña "Otras" y verificar que figure como retirada
    await courierPage.otherTab.click();
    await expect(page.getByText(/retirada/i).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 4: Ordenamiento de ofertas por documentación y precio (PR160-H03 / PR160-H09)
  // ---------------------------------------------------------------------------
  test('Flujo 4: Ordenamiento de ofertas recibidas por documentación y precio', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    // Precrear las ofertas con niveles de doc y montos cruzados para probar ordenamiento
    await seedOffersForFirstRequest(stagingContext);

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }

    const couriers = stagingContext.courierUsers;
    if (!couriers || couriers.length < 2) {
      throw new Error('[E2E Error] Se requieren al menos 2 couriers en stagingContext.courierUsers');
    }
    const courier0 = couriers[0];
    const courier1 = couriers[1];
    if (!courier0?.displayName || !courier1?.displayName) {
      throw new Error('[E2E Error] Faltan los nombres displayName de los couriers seeded');
    }
    const courier0Name = courier0.displayName;
    const courier1Name = courier1.displayName;

    await loginAsMerchant(page);
    await merchantPage.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(page);

    // Por defecto el ordenamiento activo es por documentación (doc_level)
    // Courier 0: documentación nivel 2, monto $2000 -> debe encabezar la lista
    // Courier 1: documentación nivel 0, monto $1500 -> debe figurar en segundo lugar
    await expect(merchantPage.docSortButton).toHaveAttribute('aria-pressed', 'true');
    const orderDoc = await merchantPage.offerCourierHeadings.allTextContents();
    expect(orderDoc.length).toBeGreaterThanOrEqual(2);
    expect(orderDoc[0]).toContain(courier0Name);
    expect(orderDoc[1]).toContain(courier1Name);

    // Cambiar a ordenamiento por precio
    // Courier 1 ($1500) debe figurar primero y Courier 0 ($2000) segundo
    await merchantPage.priceSortButton.click();
    await expect(merchantPage.priceSortButton).toHaveAttribute('aria-pressed', 'true');
    await expect(merchantPage.docSortButton).toHaveAttribute('aria-pressed', 'false');

    const orderPrice = await merchantPage.offerCourierHeadings.allTextContents();
    expect(orderPrice.length).toBeGreaterThanOrEqual(2);
    expect(orderPrice[0]).toContain(courier1Name);
    expect(orderPrice[1]).toContain(courier0Name);
  });

  // ---------------------------------------------------------------------------
  // Flujo 5: Vista de viaje, WhatsApp y avance del estado (PR160-H03 / PR160-H10)
  // ---------------------------------------------------------------------------
  test('Flujo 5: Vista de viaje refleja medio de pago y botón accesible Avisar a mi cliente', async (
    {
      browser,
      page,
      tripPage,
      merchantPage,
      stagingContext,
      loginAsMerchant,
      loginAsCourier,
    },
    testInfo
  ) => {
    // Precrear las ofertas para que el comercio pueda aceptar la de Courier 0
    await seedOffersForFirstRequest(stagingContext);
    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }
    const sentinelPhone = stagingContext.sentinelPhone ?? '+5493865123456';
    const rawSentinelDigits = sentinelPhone.replace(/\D/g, '');

    // 1. Comercio acepta la oferta de Courier 0 para generar el viaje (trip)
    await loginAsMerchant(page);
    await merchantPage.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(page);

    await merchantPage.acceptOfferButton.first().click();
    await merchantPage.confirmAcceptButton.click();
    await waitForNoSkeletons(page);

    // Obtener la oferta realmente aceptada y el repartidor para verificar el mensaje de WhatsApp
    const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
    const acceptedOffer = inspection.offers.find((o) => o.id === inspection.acceptedOfferId);
    if (!acceptedOffer) {
      throw new Error('[E2E Error] No se encontró la oferta aceptada en la inspección de la solicitud');
    }

    const couriers = stagingContext.courierUsers;
    const acceptedCourier = couriers?.find((c) => c.id === acceptedOffer.courierId);
    if (!acceptedCourier?.displayName) {
      throw new Error('[E2E Error] No se encontró el repartidor aceptado en courierUsers');
    }

    // Navegar a la vista del viaje como comercio
    await tripPage.navigate(targetRequestId);
    await waitForNoSkeletons(page);

    // Verificar botón accesible "Avisar a mi cliente" con link https://wa.me/
    await expect(tripPage.notifyCustomerLink).toBeVisible();
    const customerHref = await tripPage.notifyCustomerLink.getAttribute('href');
    if (!customerHref) {
      throw new Error('[E2E Error] No se encontró el atributo href en notifyCustomerLink');
    }

    const parsedUrl = new URL(customerHref);
    expect(parsedUrl.protocol).toBe('https:');
    expect(parsedUrl.hostname).toBe('wa.me');
    expect(parsedUrl.pathname).toContain(rawSentinelDigits);

    const messageText = parsedUrl.searchParams.get('text');
    expect(messageText).toBeTruthy();
    const decodedMessage = messageText ?? '';
    expect(decodedMessage).toContain(acceptedCourier.displayName);
    expect(decodedMessage.toLowerCase()).not.toContain('estoy en camino');
    expect(decodedMessage).toContain(`${acceptedCourier.displayName} es el repartidor asignado`);
    expect(decodedMessage).not.toContain(`Soy ${acceptedCourier.displayName}`);
    expect(decodedMessage).not.toMatch(/REQ-[A-Z0-9]+/i);
    expect(decodedMessage).not.toContain(targetRequestId);
    expect(decodedMessage).not.toContain(formatArs(acceptedOffer.amountArs));
    expect(decodedMessage).not.toMatch(/efectivo|transferencia/i);

    // 2. Repartidor asignado (Courier 0) accede al viaje en un contexto de navegador separado
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) {
      throw new Error('[E2E Error] Falta baseURL para crear el contexto aislado del courier');
    }
    const courierContext = await browser.newContext({ baseURL });
    try {
      const courierBrowserPage = await courierContext.newPage();
      await loginAsCourier(0, courierBrowserPage);
      const courierTripPage = new TripPage(courierBrowserPage);
      await courierTripPage.navigate(targetRequestId);
      await waitForNoSkeletons(courierBrowserPage);

      // Verificar medio de pago visible
      await expect(courierBrowserPage.getByText(/cobrás al entregar/i)).toBeVisible();

      // Verificar enlace de WhatsApp al cliente desde el repartidor (pre-retiro: primera persona, sin falsa promesa)
      await expect(courierTripPage.notifyCustomerLink).toBeVisible();
      const courierPreHref = await courierTripPage.notifyCustomerLink.getAttribute('href');
      if (!courierPreHref) {
        throw new Error('[E2E Error] No se encontró el atributo href en notifyCustomerLink del courier');
      }
      const courierPreUrl = new URL(courierPreHref);
      expect(courierPreUrl.protocol).toBe('https:');
      expect(courierPreUrl.hostname).toBe('wa.me');
      expect(courierPreUrl.pathname).toContain(rawSentinelDigits);
      const courierPreMsg = courierPreUrl.searchParams.get('text') ?? '';
      expect(courierPreMsg).toContain(`Soy ${acceptedCourier.displayName}`);
      expect(courierPreMsg.toLowerCase()).not.toContain('estoy en camino');
      expect(courierPreMsg).not.toMatch(/REQ-[A-Z0-9]+/i);
      expect(courierPreMsg).not.toContain(targetRequestId);
      expect(courierPreMsg).not.toContain(formatArs(acceptedOffer.amountArs));
      expect(courierPreMsg).not.toMatch(/efectivo|transferencia/i);

      // T-389: con la barra fija de «Marcar como retirado», «Reportar un problema» queda debajo de «No puedo hacer este
      // viaje» y nada lo tapa: al final de la página, el elemento en su centro es el propio botón.
      const reportButton = courierBrowserPage.getByRole('button', { name: /reportar un problema/i });
      const cannotDoTrip = courierBrowserPage.getByRole('button', { name: /no puedo hacer este viaje/i });
      await reportButton.scrollIntoViewIfNeeded();
      await courierBrowserPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(reportButton).toBeVisible();
      const [cancelBox, reportBox] = await Promise.all([cannotDoTrip.boundingBox(), reportButton.boundingBox()]);
      if (!cancelBox || !reportBox) {
        throw new Error('[E2E Error] No se pudo medir «No puedo hacer este viaje» o «Reportar un problema»');
      }
      expect(reportBox.y).toBeGreaterThan(cancelBox.y);
      const reportOnTop = await reportButton.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top !== null && (top === el || el.contains(top));
      });
      expect(reportOnTop).toBe(true);
      await courierBrowserPage.evaluate(() => window.scrollTo(0, 0));

      // Marcar como retirado -> estado in_transit
      await expect(courierTripPage.markPickedUpButton).toBeVisible();
      await courierTripPage.markPickedUpButton.click();
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierTripPage.confirmDeliveryButton).toBeVisible();

      // Sonner queda por encima del CTA durante unos segundos; esperar a que deje de interceptar clicks.
      const pickedUpToast = courierBrowserPage.getByText(/Pedido marcado como retirado/i);
      await expect(pickedUpToast).toBeVisible({ timeout: 10000 });

      // Sonner pausa el auto-dismiss mientras el puntero queda sobre el toast.
      // Moverlo a una zona neutra permite que expire sin forzar clicks ni sleeps.
      await courierBrowserPage.mouse.move(0, 0);
      await expect(pickedUpToast).not.toBeVisible({ timeout: 10000 });

      // Esperar estado real in_transit y verificar enlace de WhatsApp con texto en reparto
      await expect(courierTripPage.inTransitStatus).toBeVisible();
      const courierPostHref = await courierTripPage.notifyCustomerLink.getAttribute('href');
      if (!courierPostHref) {
        throw new Error('[E2E Error] No se encontró el atributo href en notifyCustomerLink del courier tras retiro');
      }
      const courierPostUrl = new URL(courierPostHref);
      expect(courierPostUrl.protocol).toBe('https:');
      expect(courierPostUrl.hostname).toBe('wa.me');
      expect(courierPostUrl.pathname).toContain(rawSentinelDigits);
      const courierPostMsg = courierPostUrl.searchParams.get('text') ?? '';
      expect(courierPostMsg).toContain(`Soy ${acceptedCourier.displayName}`);
      expect(courierPostMsg.toLowerCase()).toMatch(/recorrido|reparto/);
      expect(courierPostMsg).not.toMatch(/REQ-[A-Z0-9]+/i);
      expect(courierPostMsg).not.toContain(targetRequestId);
      expect(courierPostMsg).not.toContain(formatArs(acceptedOffer.amountArs));
      expect(courierPostMsg).not.toMatch(/efectivo|transferencia/i);

      // Confirmar entrega -> estado entregado
      await courierTripPage.confirmDeliveryButton.click();
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierTripPage.deliveredStatus).toBeVisible();

      // T-379: el viaje entregado se titula «Viaje finalizado», sale de «Aceptadas» y queda en «Otras» como «Entregado».
      await expect(courierBrowserPage.getByRole('heading', { level: 1, name: 'Viaje finalizado' })).toBeVisible();
      await courierBrowserPage.goto('/courier/offers');
      await waitForNoSkeletons(courierBrowserPage);
      // Los repartidores de la fixture son de esta corrida: su única oferta aceptada es la de este viaje.
      await expect(courierBrowserPage.getByRole('button', { name: 'Aceptadas (0)' })).toBeVisible();
      await courierBrowserPage.getByRole('button', { name: /^Otras \(/ }).click();
      const deliveredTripLink = courierBrowserPage.locator(`a[href="/trips/${targetRequestId}"]`);
      await expect(deliveredTripLink).toHaveText('Ver viaje');
      await expect(
        courierBrowserPage.getByRole('listitem').filter({ has: deliveredTripLink }).getByText('Entregado', { exact: true })
      ).toBeVisible();
    } finally {
      await courierContext.close();
    }
  });

  // ---------------------------------------------------------------------------
  // T-360: Resumen de viajes activos del repartidor en el feed
  // ---------------------------------------------------------------------------
  test('T-360: El feed del repartidor muestra viajes activos encima de Solicitudes abiertas y los oculta tras entrega', async (
    {
      page,
      merchantPage,
      stagingContext,
      loginAsMerchant,
      loginAsCourier,
      browser,
    },
    testInfo
  ) => {
    // 1. Precrear ofertas y comprobar usuarios
    await seedOffersForFirstRequest(stagingContext);
    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }
    const targetCourier = stagingContext.courierUsers?.[0];
    if (!targetCourier) {
      throw new Error('[E2E Error] No courier user 0 found in stagingContext');
    }

    // Comercio acepta la oferta específica de Courier 0 de forma determinista
    await loginAsMerchant(page);
    await merchantPage.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(page);

    // Buscar encabezado con el nombre exacto de Courier 0
    const courierHeading = page.getByRole('heading', {
      level: 4,
      name: targetCourier.displayName,
      exact: true,
    });
    await expect(courierHeading).toHaveCount(1);

    // Localizar la tarjeta Card contenedora (div.rounded-xl.border-border.bg-card) asociada al courier
    const courierCard = page
      .locator('div.rounded-xl.border-border.bg-card')
      .filter({ has: courierHeading });
    await expect(courierCard).toHaveCount(1);

    const acceptButton = courierCard.getByRole('button', { name: /^aceptar$/i });
    await expect(acceptButton).toHaveCount(1);
    await acceptButton.click();

    await merchantPage.confirmAcceptButton.click();
    await waitForNoSkeletons(page);

    // Comprobar que en DB la solicitud quedó matched y asignada al courier 0
    const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
    expect(inspection.requestStatus).toBe('matched');
    expect(inspection.acceptedOfferId).toBeTruthy();
    const acceptedOffer = inspection.offers.find((o) => o.id === inspection.acceptedOfferId);
    expect(acceptedOffer?.courierId).toBe(targetCourier.id);

    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) {
      throw new Error('[E2E Error] Falta baseURL para crear el contexto del courier');
    }

    // 2. Courier 0 (asignado) abre /courier/feed y ve la sección de viajes activos
    const courierContext = await browser.newContext({ baseURL });
    try {
      const courierPage = await courierContext.newPage();
      await loginAsCourier(0, courierPage);
      await courierPage.goto('/courier/feed');
      await waitForNoSkeletons(courierPage);

      const activeTripsHeading = courierPage.getByRole('heading', {
        name: /mis viajes activos/i,
      });
      await expect(activeTripsHeading).toBeVisible();

      // Enlace exacto hacia el viaje
      const viewTripLink = courierPage.getByRole('link', { name: /ver viaje/i }).first();
      await expect(viewTripLink).toBeVisible();
      await expect(viewTripLink).toHaveAttribute('href', `/trips/${targetRequestId}`);

      // Estado matched => "Aceptado · Por retirar"
      await expect(courierPage.getByText(/aceptado/i).first()).toBeVisible();

      // Ausencia de datos privados de contacto en feed pre-match/público
      const sentinelPhone = stagingContext.sentinelPhone ?? '+5493865123456';
      const rawSentinel = sentinelPhone.replace(/\D/g, '');
      const feedHtml = await courierPage.content();
      expect(feedHtml).not.toContain(rawSentinel);

      // Verificación de orden DOM real mediante compareDocumentPosition:
      // switch de disponibilidad < section[aria-labelledby="active-trips-title"] < encabezado Solicitudes abiertas
      const domOrderValid = await courierPage.evaluate(() => {
        const switchEl = document.querySelector('[role="switch"]');
        const activeSection = document.querySelector('section[aria-labelledby="active-trips-title"]');
        const feedHeading = Array.from(document.querySelectorAll('h1')).find((h) =>
          /solicitudes abiertas/i.test(h.textContent ?? '')
        );
        if (!switchEl || !activeSection || !feedHeading) return false;
        const afterSwitch = Boolean(
          switchEl.compareDocumentPosition(activeSection) & Node.DOCUMENT_POSITION_FOLLOWING
        );
        const beforeFeed = Boolean(
          activeSection.compareDocumentPosition(feedHeading) & Node.DOCUMENT_POSITION_FOLLOWING
        );
        return afterSwitch && beforeFeed;
      });
      expect(domOrderValid).toBe(true);

      // Conmutar disponibilidad a NO disponible: la sección permanece visible
      const switchBtn = courierPage.getByRole('switch', {
        name: /cambiar estado de disponibilidad/i,
      });
      await switchBtn.click();
      await expect(courierPage.getByText(/no estás disponible/i)).toBeVisible();
      await expect(activeTripsHeading).toBeVisible();

      // Volver a activar disponibilidad
      await switchBtn.click();
      await expect(courierPage.getByText(/solicitudes abiertas/i)).toBeVisible();

      // 3. Mantener courierPage ABIERTA en /courier/feed (sin recargar)
      // En un segundo contexto/página, avanzar y entregar el pedido
      const tripContext = await browser.newContext({ baseURL });
      try {
        const tripActionPage = await tripContext.newPage();
        await loginAsCourier(0, tripActionPage);
        const courierTripPage = new TripPage(tripActionPage);
        await courierTripPage.navigate(targetRequestId);
        await waitForNoSkeletons(tripActionPage);

        // Retirar
        await expect(courierTripPage.markPickedUpButton).toBeVisible();
        await courierTripPage.markPickedUpButton.click();
        await waitForNoSkeletons(tripActionPage);

        // En courierPage (que sigue en /courier/feed sin recarga), el estado se actualiza a "En camino"
        await expect
          .poll(async () => courierPage.getByText(/en camino/i).first().isVisible(), {
            timeout: 35000,
          })
          .toBe(true);

        // Entregar
        await expect(courierTripPage.confirmDeliveryButton).toBeVisible();
        const pickedUpToast = tripActionPage.getByText(/Pedido marcado como retirado/i);
        if (await pickedUpToast.isVisible()) {
          await tripActionPage.mouse.move(0, 0);
          await expect(pickedUpToast).not.toBeVisible({ timeout: 10000 });
        }
        await courierTripPage.confirmDeliveryButton.click();
        await waitForNoSkeletons(tripActionPage);
        await expect(courierTripPage.deliveredStatus).toBeVisible();
      } finally {
        await tripContext.close();
      }

      // 4. En courierPage (que sigue en /courier/feed SIN recargar), el viaje desaparece en vivo
      await expect
        .poll(async () => activeTripsHeading.isVisible(), { timeout: 35000 })
        .toBe(false);
    } finally {
      await courierContext.close();
    }

    // 5. Courier 1 (no asignado) nunca ve el viaje en su feed
    const otherCourierContext = await browser.newContext({ baseURL });
    try {
      const otherCourierPage = await otherCourierContext.newPage();
      await loginAsCourier(1, otherCourierPage);
      await otherCourierPage.goto('/courier/feed');
      await waitForNoSkeletons(otherCourierPage);
      await expect(
        otherCourierPage.getByRole('heading', { name: /mis viajes activos/i })
      ).not.toBeVisible();
    } finally {
      await otherCourierContext.close();
    }
  });
});
