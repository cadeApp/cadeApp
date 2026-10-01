import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
} from '../fixtures';
import { formatArs } from '@/lib/format';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { LoginPage, MerchantPage } from '../pages';

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
  // DoD Invariante 1: Revelación progresiva de datos de contacto (PR160-H01)
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

    // Autenticarse como repartidor no asignado (Courier 1)
    await loginAsCourier(1, page);

    // 1. Explorar el feed de solicitudes disponibles
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    // Verificar exhaustivamente que el teléfono sentinel NO aparezca en DOM, texto ni enlaces
    const feedContent = await page.content();
    expect(feedContent).not.toContain(sentinelPhone);
    expect(feedContent).not.toContain(rawSentinelDigits);
    await expect(page.getByText(sentinelPhone)).not.toBeVisible();
    await expect(page.getByText(rawSentinelDigits)).not.toBeVisible();

    // 2. Explorar la vista de ofertas del repartidor
    await page.goto('/courier/offers');
    await waitForNoSkeletons(page);

    const offersContent = await page.content();
    expect(offersContent).not.toContain(sentinelPhone);
    expect(offersContent).not.toContain(rawSentinelDigits);
    await expect(page.getByText(sentinelPhone)).not.toBeVisible();
    await expect(page.getByText(rawSentinelDigits)).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // DoD Invariante 2: Aceptación concurrente en dos pestañas (PR160-H02)
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se aceptan dos ofertas para la misma solicitud en dos pestañas concurrentes', async ({
    browser,
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

    // Contexto de navegador compartido que conserva sesión autenticada
    const context = await browser.newContext();
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

    // Al menos una pestaña debe reflejar rechazo específico por concurrencia ALREADY_MATCHED
    const alert1 = merchantPage1.alreadyMatchedAlert;
    const alert2 = merchantPage2.alreadyMatchedAlert;
    await expect(alert1.or(alert2)).toBeVisible({ timeout: 10000 });

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
  // Flujo 1: Publicación de solicitud con efectivo y cambio (PR160-H03)
  // ---------------------------------------------------------------------------
  test('Flujo 1: Publicación de solicitud con datos de entrega, paquete y medio de pago', async ({
    page,
    merchantPage,
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

    // Publicar solicitud con el botón real de UI
    await merchantPage.submitRequestButton.click();

    // Esperar redirección al listado o detalle
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Verificar renderizado de paquete Chico y medio de pago Efectivo
    await expect(page.getByText(/paquete chico/i)).toBeVisible();
    await expect(page.getByText(/efectivo/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 1b: Publicación de solicitud con transferencia (PR160-H03)
  // ---------------------------------------------------------------------------
  test('Flujo 1b: Publicación de solicitud con medio de pago transferencia', async ({
    page,
    merchantPage,
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

    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    await expect(page.getByText(/paquete chico/i)).toBeVisible();
    await expect(page.getByText(/transferencia/i)).toBeVisible();
    await expect(page.getByText(/necesita cambio/i)).not.toBeVisible();
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
  // Flujo 4: Ordenamiento de ofertas por documentación y precio (PR160-H03)
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

    await loginAsMerchant(page);
    await merchantPage.gotoRequestDetail(targetRequestId);
    await waitForNoSkeletons(page);

    // Por defecto el ordenamiento activo es por documentación (doc_level)
    await expect(merchantPage.docSortButton).toHaveAttribute('aria-pressed', 'true');
    const orderDoc = await merchantPage.offerCourierHeadings.allTextContents();
    expect(orderDoc.length).toBeGreaterThanOrEqual(2);

    // Cambiar a ordenamiento por precio
    await merchantPage.priceSortButton.click();
    await expect(merchantPage.priceSortButton).toHaveAttribute('aria-pressed', 'true');
    await expect(merchantPage.docSortButton).toHaveAttribute('aria-pressed', 'false');

    const orderPrice = await merchantPage.offerCourierHeadings.allTextContents();
    expect(orderPrice.length).toBeGreaterThanOrEqual(2);

    // Al tener couriers con combinación cruzada (Courier 0 Doc 2 $2000 vs Courier 1 Doc 0 $1500),
    // el primer elemento visible debe diferir entre ambos modos
    expect(orderDoc[0]).not.toBe(orderPrice[0]);
  });

  // ---------------------------------------------------------------------------
  // Flujo 5: Vista de viaje, WhatsApp y avance del estado (PR160-H03)
  // ---------------------------------------------------------------------------
  test('Flujo 5: Vista de viaje refleja medio de pago y botón accesible Avisar a mi cliente', async ({
    page,
    tripPage,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
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

    // Navegar a la vista del viaje como comercio
    await tripPage.navigate(targetRequestId);
    await waitForNoSkeletons(page);

    // Verificar botón accesible "Avisar a mi cliente" con link https://wa.me/
    await expect(tripPage.notifyCustomerLink).toBeVisible();
    const customerHref = await tripPage.notifyCustomerLink.getAttribute('href');
    expect(customerHref).toMatch(/^https:\/\/wa\.me\//);
    expect(customerHref).toContain(rawSentinelDigits);

    // 2. Repartidor asignado (Courier 0) accede al viaje y avanza los estados
    await loginAsCourier(0, page);
    await tripPage.navigate(targetRequestId);
    await waitForNoSkeletons(page);

    // Verificar medio de pago visible
    await expect(page.getByText(/cobrás al entregar/i)).toBeVisible();

    // Marcar como retirado -> estado in_transit
    await expect(tripPage.markPickedUpButton).toBeVisible();
    await tripPage.markPickedUpButton.click();
    await waitForNoSkeletons(page);
    await expect(tripPage.confirmDeliveryButton).toBeVisible();

    // Confirmar entrega -> estado entregado
    await tripPage.confirmDeliveryButton.click();
    await waitForNoSkeletons(page);
    await expect(tripPage.deliveredStatus).toBeVisible();
  });
});
