import {
  test,
  expect,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
  createAuthenticatedClient,
  getPlatformSettingNumber,
  seedDeliveryRequestInState,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { CourierPage, type MerchantPage } from '../pages';
import { formatArs } from '@/lib/format';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';

/**
 * T-339: E2E de precio de envío opcional en la solicitud y toma directa.
 *
 * Flujos cubiertos a través de la UI real del comercio y repartidor:
 * 1. Formulario real de alta con precio fijado y switch «asignar al primero» activo:
 *    - El comercio ingresa precio acordado y activa el switch.
 *    - Se crea y publica la solicitud vía publish_request.
 *    - La DB refleja status=published, fixed_price_ars y auto_assign=true.
 *    - El repartidor ve «Tomar a $X» en lugar de «Ofertar».
 *    - Al confirmar, queda asignado (matched) de forma atómica e instantánea.
 *    - Oráculo en PostgreSQL valida estado matched, accepted_offer_id y monto exacto.
 *    - Vista de viaje refleja el monto acordado.
 *
 * 2. Formulario real de alta con precio y switch inactivo:
 *    - El comercio ingresa precio acordado dejando el switch inactivo.
 *    - La DB refleja status=published, fixed_price_ars y auto_assign=false.
 *    - El repartidor toma a $X; la solicitud sigue published y crea oferta pending.
 *    - El comercio visualiza la oferta de $X y la acepta con accept_offer.
 *    - La solicitud pasa a matched.
 *
 * 3. Formulario real sin precio fijo:
 *    - El comercio publica sin ingresar precio.
 *    - Conserva el flujo habitual de oferta abierta y subasta:
 *    - El repartidor ve «Ofertar», campo de monto numérico, piso dinámico y chips.
 */

async function fillBaseMerchantForm(
  merchantPage: MerchantPage,
  notesMarker: string
): Promise<void> {
  const pickupVal = await merchantPage.pickupAddressInput.inputValue();
  if (!pickupVal.trim()) {
    await merchantPage.pickupAddressInput.fill('San Martín 150');
  }
  await merchantPage.dropoffAddressInput.fill('Av. Mitre 450');
  await merchantPage.recipientNameInput.fill('María Destinataria');
  await merchantPage.recipientPhoneInput.fill('3865123456');
  await merchantPage.consentCheckbox.check();
  await merchantPage.packageChicoButton.click();
  await merchantPage.paymentCashButton.click();
  await merchantPage.notesInput.fill(notesMarker);
}

// El comercio y el repartidor usan sesiones distintas: con la cookie del comercio activa, /login redirige a
// /merchant/dashboard (307) y el login del repartidor no encuentra el formulario. Igual que main-flow.spec.ts.
async function newCourierContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== 'string' || baseURL.length === 0) {
    throw new Error('[E2E Error] Falta baseURL para crear el contexto aislado del courier');
  }
  return browser.newContext({ baseURL });
}

test.describe('T-339 — Precio de envío opcional y toma directa', () => {
  // ---------------------------------------------------------------------------
  // 1. Con precio y switch activo: publicación real por UI y asignación atómica
  // ---------------------------------------------------------------------------
  test('DoD: solicitud creada por UI con precio y switch activo asigna al primer repartidor atómicamente', async ({
    browser,
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }, testInfo) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere courier en stagingContext');
    }

    const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
    const fixedPrice = Math.max(minOfferArs, 1500) + 500;

    // 1. Comercio inicia sesión y navega al formulario real de alta
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const notesMarker = `E2E fixed auto ${stagingContext.testRunId}`;
    await fillBaseMerchantForm(merchantPage, notesMarker);

    // 2. Ingresa precio del envío acordado y activa switch de auto-asignación
    await page.getByLabel(/precio del envío acordado/i).fill(fixedPrice.toString());
    await page.getByLabel(/asignar al primer repartidor que tome/i).click();

    // 3. Envía el formulario real
    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // 4. Oráculo server-side en PostgreSQL: la solicitud fue publicada con los campos correctos
    const requestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
    const createdInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(createdInspection.requestStatus).toBe('published');
    expect(createdInspection.fixedPriceArs).toBe(fixedPrice);
    expect(createdInspection.autoAssign).toBe(true);

    // 5. Courier 0 inicia sesión en un contexto aislado y navega al feed
    const courierContext = await newCourierContext(browser, testInfo);
    try {
      const courierBrowserPage = await courierContext.newPage();
      await loginAsCourier(0, courierBrowserPage);
      await courierBrowserPage.goto('/courier/feed');
      await waitForNoSkeletons(courierBrowserPage);

      const courierPage = new CourierPage(courierBrowserPage);
      const card = courierPage.requestCardById(requestId);
      await expect(card).toBeVisible();

      // 6. Verifica que la tarjeta muestre «Tomar a $X» y no el botón genérico «Ofertar»
      const takeButton = card.getByRole('button', {
        name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
      });
      await expect(takeButton).toBeVisible();
      await expect(card.getByRole('button', { name: /^ofertar$/i })).toHaveCount(0);

      // 7. Repartidor abre la hoja para tomar la solicitud
      await takeButton.click();

      // 8. La hoja muestra título de toma, banner de precio y sin input de monto ni chips
      await expect(courierBrowserPage.getByText(/tomar solicitud/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(/precio fijado por el comercio/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(/asignación inmediata/i)).toBeVisible();
      await expect(courierBrowserPage.getByLabel(/monto de la oferta/i)).toHaveCount(0);

      // 9. Confirma la toma de la solicitud
      const confirmButton = courierBrowserPage.getByRole('button', {
        name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
      });
      await confirmButton.click();
      // La toma terminó en el servidor: la hoja se cierra y avisa el éxito. Sin esto, el oráculo leía la base
      // mientras el botón todavía decía «Tomando pedido...».
      await expect(courierBrowserPage.getByText('¡Pedido tomado con éxito!')).toBeVisible();

      // 10. Oráculo server-side en PostgreSQL: la solicitud quedó matched de inmediato
      const matchedInspection = await getRequestInspectionData(stagingContext, requestId);
      expect(matchedInspection.requestStatus).toBe('matched');
      expect(matchedInspection.acceptedOfferId).not.toBeNull();
      expect(matchedInspection.fixedPriceArs).toBe(fixedPrice);
      expect(matchedInspection.autoAssign).toBe(true);

      const acceptedOffer = matchedInspection.offers.find((o) => o.id === matchedInspection.acceptedOfferId);
      expect(acceptedOffer).toBeDefined();
      expect(acceptedOffer?.courierId).toBe(courier.id);
      expect(acceptedOffer?.amountArs).toBe(fixedPrice);
      expect(acceptedOffer?.status).toBe('accepted');

      // 11. El repartidor accede a la vista de viaje y verifica el monto acordado
      await courierBrowserPage.goto(`/trips/${requestId}`);
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierBrowserPage.getByText(/cobrás al entregar/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(formatArs(fixedPrice))).toBeVisible();
    } finally {
      await courierContext.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Con precio y switch inactivo: genera oferta pendiente y el comercio elige
  // ---------------------------------------------------------------------------
  test('DoD: solicitud creada por UI con precio y switch inactivo crea oferta pendiente y el comercio elige', async ({
    browser,
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }, testInfo) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
    const fixedPrice = Math.max(minOfferArs, 1500) + 300;

    // 1. Comercio crea solicitud con precio pero dejando el switch apagado
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const notesMarker = `E2E fixed manual ${stagingContext.testRunId}`;
    await fillBaseMerchantForm(merchantPage, notesMarker);
    await page.getByLabel(/precio del envío acordado/i).fill(fixedPrice.toString());

    // Switch se deja inactivo (no se hace click)
    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Oráculo DB: auto_assign es false
    const requestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
    const createdInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(createdInspection.requestStatus).toBe('published');
    expect(createdInspection.fixedPriceArs).toBe(fixedPrice);
    expect(createdInspection.autoAssign).toBe(false);

    // 2. Courier 0 toma la solicitud a $X desde un contexto aislado
    const courierContext = await newCourierContext(browser, testInfo);
    try {
      const courierBrowserPage = await courierContext.newPage();
      await loginAsCourier(0, courierBrowserPage);
      await courierBrowserPage.goto('/courier/feed');
      await waitForNoSkeletons(courierBrowserPage);

      const courierPage = new CourierPage(courierBrowserPage);
      const card = courierPage.requestCardById(requestId);
      await expect(card).toBeVisible();

      const takeButton = card.getByRole('button', {
        name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
      });
      await takeButton.click();

      // La hoja aclara que el comercio confirmará
      await expect(courierBrowserPage.getByText(/el comercio confirmará/i)).toBeVisible();

      const confirmButton = courierBrowserPage.getByRole('button', {
        name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
      });
      await confirmButton.click();
      // La toma terminó en el servidor: la hoja se cierra y avisa el éxito. Sin esto, el oráculo leía la base
      // mientras el botón todavía decía «Tomando pedido...».
      await expect(courierBrowserPage.getByText('¡Pedido tomado con éxito!')).toBeVisible();
    } finally {
      await courierContext.close();
    }

    // 3. Oráculo intermedio: la solicitud sigue en estado published con una oferta pending por el precio fijo
    const midwayInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(midwayInspection.requestStatus).toBe('published');
    expect(midwayInspection.acceptedOfferId).toBeNull();
    expect(midwayInspection.offers).toHaveLength(1);
    expect(midwayInspection.offers[0]?.status).toBe('pending');
    expect(midwayInspection.offers[0]?.amountArs).toBe(fixedPrice);

    const offerId = midwayInspection.offers[0]?.id;
    if (!offerId) {
      throw new Error('[E2E Error] No se encontró oferta pendiente creada');
    }

    // 4. El comercio acepta la oferta creada
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerId,
    });
    expect(acceptErr).toBeNull();

    // 5. Oráculo final: la solicitud quedó matched con la oferta aceptada
    const finalInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(finalInspection.requestStatus).toBe('matched');
    expect(finalInspection.acceptedOfferId).toBe(offerId);
  });

  // ---------------------------------------------------------------------------
  // 3. Sin precio fijo: conserva el flujo de ofertas y subasta
  // ---------------------------------------------------------------------------
  test('DoD: solicitud creada por UI sin precio fijo conserva el botón de ofertar y flujo abierto', async ({
    browser,
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }, testInfo) => {
    // 1. Comercio crea solicitud sin precio fijo
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const notesMarker = `E2E open auction ${stagingContext.testRunId}`;
    await fillBaseMerchantForm(merchantPage, notesMarker);

    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Oráculo DB: fixed_price_ars es null y auto_assign es false
    const requestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
    const createdInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(createdInspection.requestStatus).toBe('published');
    expect(createdInspection.fixedPriceArs).toBeNull();
    expect(createdInspection.autoAssign).toBe(false);

    // 2. Courier 0 navega al feed desde un contexto aislado
    const courierContext = await newCourierContext(browser, testInfo);
    try {
      const courierBrowserPage = await courierContext.newPage();
      await loginAsCourier(0, courierBrowserPage);
      await courierBrowserPage.goto('/courier/feed');
      await waitForNoSkeletons(courierBrowserPage);

      const courierPage = new CourierPage(courierBrowserPage);
      const card = courierPage.requestCardById(requestId);
      await expect(card).toBeVisible();

      // 3. Muestra botón «Ofertar» habitual
      const offerBtn = card.getByRole('button', { name: /^ofertar$/i });
      await expect(offerBtn).toBeVisible();
      await offerBtn.click();

      // 4. La hoja muestra el campo para ingresar monto y los chips
      await expect(courierBrowserPage.getByText(/tu oferta/i)).toBeVisible();
      await expect(courierBrowserPage.getByLabel(/monto de la oferta/i)).toBeVisible();
      await expect(courierBrowserPage.getByText(/mínimo/i)).toBeVisible();
      await expect(courierBrowserPage.getByRole('button', { name: /enviar oferta/i })).toBeVisible();
    } finally {
      await courierContext.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Concurrencia real multi-sesión y ausencia de deadlocks (H05)
  // ---------------------------------------------------------------------------
  test.describe('H05: Concurrencia real sobre dos sesiones independientes de red', () => {
    test('H05.1: dos couriers concurrentes con take_request en auto_assign=true compiten sin 40P01 y dejan exactamente un match', async ({
      stagingContext,
    }) => {
      const couriers = stagingContext.courierUsers;
      const courier0 = couriers?.[0];
      const courier1 = couriers?.[1];
      if (!courier0 || !courier1) {
        throw new Error('[E2E Error] Se requieren al menos dos couriers en stagingContext');
      }
      const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
      const fixedPrice = Math.max(minOfferArs, 1500);

      const seed = await seedDeliveryRequestInState(stagingContext, {
        status: 'published',
        fixedPriceArs: fixedPrice,
        autoAssign: true,
      });

      const [courier0Client, courier1Client] = await Promise.all([
        createAuthenticatedClient(courier0),
        createAuthenticatedClient(courier1),
      ]);

      // Invocación simultánea por red mediante Promise.all sobre dos clientes independientes
      const [res0, res1] = await Promise.all([
        courier0Client.rpc('take_request', {
          p_request_id: seed.requestId,
          p_eta_minutes: 10,
        }),
        courier1Client.rpc('take_request', {
          p_request_id: seed.requestId,
          p_eta_minutes: 15,
        }),
      ]);

      const responses = [res0, res1];
      for (const res of responses) {
        if (res.error) {
          expect(res.error.message).not.toMatch(/40P01|deadlock/i);
        }
      }

      const winner = responses.find((r) => !r.error);
      const loser = responses.find((r) => r.error);
      expect(winner).toBeDefined();
      expect(loser).toBeDefined();
      expect(loser?.error?.message).toMatch(/ALREADY_MATCHED/);

      // Oráculo DB tras commit: exactamente una oferta aceptada y solicitud matched
      const inspection = await getRequestInspectionData(stagingContext, seed.requestId);
      expect(inspection.requestStatus).toBe('matched');
      expect(inspection.acceptedOfferId).toBeTruthy();

      const acceptedOffers = inspection.offers.filter((o) => o.status === 'accepted');
      const pendingOffers = inspection.offers.filter((o) => o.status === 'pending');
      expect(acceptedOffers).toHaveLength(1);
      expect(pendingOffers).toHaveLength(0);
    });

    test('H05.2: dos llamadas simultáneas a accept_offer sobre distintas ofertas de la misma solicitud no generan deadlock 40P01 (H02)', async ({
      stagingContext,
    }) => {
      const couriers = stagingContext.courierUsers;
      const merchant = stagingContext.merchantUser;
      const courier0 = couriers?.[0];
      const courier1 = couriers?.[1];
      if (!courier0 || !courier1 || !merchant) {
        throw new Error('[E2E Error] Se requieren dos couriers y un merchant en stagingContext');
      }
      const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
      const fixedPrice = Math.max(minOfferArs, 1500);

      // Solicitud con precio pero auto_assign = false
      const seed = await seedDeliveryRequestInState(stagingContext, {
        status: 'published',
        fixedPriceArs: fixedPrice,
        autoAssign: false,
      });

      const [courier0Client, courier1Client] = await Promise.all([
        createAuthenticatedClient(courier0),
        createAuthenticatedClient(courier1),
      ]);

      // Ambos couriers generan ofertas pendientes de forma legítima
      const take0 = await courier0Client.rpc('take_request', {
        p_request_id: seed.requestId,
        p_eta_minutes: 10,
      });
      const take1 = await courier1Client.rpc('take_request', {
        p_request_id: seed.requestId,
        p_eta_minutes: 15,
      });
      expect(take0.error).toBeNull();
      expect(take1.error).toBeNull();

      const midInspection = await getRequestInspectionData(stagingContext, seed.requestId);
      const pendingOffers = midInspection.offers.filter((o) => o.status === 'pending');
      expect(pendingOffers).toHaveLength(2);

      const offer0Id = pendingOffers[0]?.id;
      const offer1Id = pendingOffers[1]?.id;
      if (!offer0Id || !offer1Id) {
        throw new Error('[E2E Error] Faltan las dos ofertas pendientes');
      }

      // Dos clientes independientes autenticados del mismo merchant
      const [merchantClientA, merchantClientB] = await Promise.all([
        createAuthenticatedClient(merchant),
        createAuthenticatedClient(merchant),
      ]);

      // Invocación concurrente sobre la misma solicitud (ataca específicamente deadlock H02)
      const [resA, resB] = await Promise.all([
        merchantClientA.rpc('accept_offer', { p_offer_id: offer0Id }),
        merchantClientB.rpc('accept_offer', { p_offer_id: offer1Id }),
      ]);

      const responses = [resA, resB];
      for (const res of responses) {
        if (res.error) {
          expect(res.error.message).not.toMatch(/40P01|deadlock/i);
        }
      }

      const success = responses.find((r) => !r.error);
      const failure = responses.find((r) => r.error);
      expect(success).toBeDefined();
      expect(failure).toBeDefined();
      expect(failure?.error?.message).toMatch(/ALREADY_MATCHED/);

      // Oráculo DB: una accepted, la otra rechazada, cero duplicadas
      const finalInspection = await getRequestInspectionData(stagingContext, seed.requestId);
      expect(finalInspection.requestStatus).toBe('matched');
      const accepted = finalInspection.offers.filter((o) => o.status === 'accepted');
      expect(accepted).toHaveLength(1);
    });

    test('H05.3: mismo courier ejecuta submit_offer y take_request concurrentes en solicitudes distintas sin 40P01', async ({
      stagingContext,
    }) => {
      const courier = stagingContext.courierUsers?.[0];
      if (!courier) throw new Error('[E2E Error] Se requiere courier');
      const minOfferArs = await getPlatformSettingNumber('min_offer_ars');

      // Req A sin precio fijo (admite submit_offer)
      const seedA = await seedDeliveryRequestInState(stagingContext, {
        status: 'published',
        fixedPriceArs: null,
        autoAssign: false,
      });

      // Req B con precio fijo (admite take_request)
      const seedB = await seedDeliveryRequestInState(stagingContext, {
        status: 'published',
        fixedPriceArs: Math.max(minOfferArs, 1500),
        autoAssign: false,
      });

      // Dos sesiones independientes del mismo courier
      const [session1, session2] = await Promise.all([
        createAuthenticatedClient(courier),
        createAuthenticatedClient(courier),
      ]);

      const [resSubmit, resTake] = await Promise.all([
        session1.rpc('submit_offer', {
          p_request_id: seedA.requestId,
          p_amount_ars: Math.max(minOfferArs, 1500),
          p_eta_minutes: 10,
        }),
        session2.rpc('take_request', {
          p_request_id: seedB.requestId,
          p_eta_minutes: 15,
        }),
      ]);

      if (resSubmit.error) expect(resSubmit.error.message).not.toMatch(/40P01|deadlock/i);
      if (resTake.error) expect(resTake.error.message).not.toMatch(/40P01|deadlock/i);

      expect(resSubmit.error).toBeNull();
      expect(resTake.error).toBeNull();

      const inspA = await getRequestInspectionData(stagingContext, seedA.requestId);
      const inspB = await getRequestInspectionData(stagingContext, seedB.requestId);
      expect(inspA.offers).toHaveLength(1);
      expect(inspB.offers).toHaveLength(1);
    });

    test('H05.4: toma rechazada deterministamente si el courier no está disponible (available=false)', async ({
      stagingContext,
    }) => {
      const courier = stagingContext.courierUsers?.[0];
      if (!courier) throw new Error('[E2E Error] Se requiere courier');
      const minOfferArs = await getPlatformSettingNumber('min_offer_ars');

      const seed = await seedDeliveryRequestInState(stagingContext, {
        status: 'published',
        fixedPriceArs: Math.max(minOfferArs, 1500),
        autoAssign: true,
      });

      const client = await createAuthenticatedClient(courier);

      // Marcar courier como no disponible
      const { error: availErr } = await client.rpc('set_availability', { p_available: false });
      expect(availErr).toBeNull();

      // Intento de tomar: debe ser rechazado deterministamente
      const { error } = await client.rpc('take_request', {
        p_request_id: seed.requestId,
        p_eta_minutes: 10,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/COURIER_UNAVAILABLE|UNAUTHORIZED_ACTOR/);

      // Oráculo DB: solicitud sigue published, sin match
      const inspection = await getRequestInspectionData(stagingContext, seed.requestId);
      expect(inspection.requestStatus).toBe('published');
      expect(inspection.acceptedOfferId).toBeNull();
      expect(inspection.offers).toHaveLength(0);

      // Restaurar disponibilidad
      await client.rpc('set_availability', { p_available: true });
    });
  });
});
