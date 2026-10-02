import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
} from '../fixtures';
import { formatArs, formatPhone } from '@/lib/format';
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
  // DoD Invariante 2: Aceptación concurrente en dos pestañas (PR160-H02)
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se aceptan dos ofertas para la misma solicitud en dos pestañas concurrentes', async ({
    context,
    stagingContext,
  }) => {
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

    // Pestañas bajo el contexto provisto por Playwright (configurado con baseURL)
    const tab1 = await context.newPage();
    const loginPage = new LoginPage(tab1);
    await loginPage.navigate();
    await loginPage.login(merchant.email, merchant.password);

    const merchantPage1 = new MerchantPage(tab1);
    await merchantPage1.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(tab1);

    // Segunda pestaña bajo el mismo contexto (mismo comercio autenticado)
    const tab2 = await context.newPage();
    const merchantPage2 = new MerchantPage(tab2);
    await merchantPage2.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(tab2);

    // Tab 1 abre modal sobre la primera oferta
    await merchantPage1.acceptOfferButton.first().click();
    await expect(merchantPage1.confirmAcceptButton).toBeVisible();

    // Tab 2 abre modal sobre la segunda oferta
    await merchantPage2.acceptOfferButton.nth(1).click();
    await expect(merchantPage2.confirmAcceptButton).toBeVisible();

    // Disparar las confirmaciones en paralelo real mediante barrera Promise.all
    await Promise.all([
      merchantPage1.confirmAcceptButton.click(),
      merchantPage2.confirmAcceptButton.click(),
    ]);

    // Al menos una pestaña debe reflejar rechazo específico por concurrencia ALREADY_MATCHED.
    // Los locators pertenecen a páginas distintas: no usar locator.or() entre frames/pages.
    const alert1 = merchantPage1.alreadyMatchedAlert;
    const alert2 = merchantPage2.alreadyMatchedAlert;
    await expect
      .poll(
        async () => (await alert1.isVisible()) || (await alert2.isVisible()),
        {
          message: 'Una de las dos pestañas debe mostrar el rechazo ALREADY_MATCHED',
          timeout: 10000,
          intervals: [250, 500, 1000],
        }
      )
      .toBe(true);

    // Oráculo de estado final: convergencia observada server-side con expect.poll
    await expect
      .poll(
        async () => {
          const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
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

    // Tras refrescar la pestaña ganadora, renderiza la vista de viaje o asignación sin duplicados
    await tab1.reload();
    await waitForNoSkeletons(tab1);
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

    // Identificar de forma inequívoca la solicitud correspondiente a la corrida actual
    const targetCard = courierPage.requestCardByNotes(stagingContext.testRunId);
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
    expect(decodedMessage).toContain(formatArs(acceptedOffer.amountArs));
    expect(decodedMessage).toContain(acceptedCourier.displayName);
    expect(decodedMessage).toMatch(/efectivo/i);

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

      // Marcar como retirado -> estado in_transit
      await expect(courierTripPage.markPickedUpButton).toBeVisible();
      await courierTripPage.markPickedUpButton.click();
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierTripPage.confirmDeliveryButton).toBeVisible();

      // Sonner queda por encima del CTA durante unos segundos; esperar a que deje de interceptar clicks.
      const pickedUpToast = courierBrowserPage.getByText(/Pedido marcado como retirado/i);
      await expect(pickedUpToast).toBeVisible({ timeout: 10000 });
      await expect(pickedUpToast).not.toBeVisible({ timeout: 10000 });

      // Confirmar entrega -> estado entregado
      await courierTripPage.confirmDeliveryButton.click();
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierTripPage.deliveredStatus).toBeVisible();
    } finally {
      await courierContext.close();
    }
  });
});
