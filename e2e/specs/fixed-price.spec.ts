import {
  test,
  expect,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
  createAuthenticatedClient,
  getPlatformSettingNumber,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { CourierPage, type MerchantPage } from '../pages';
import { formatArs } from '@/lib/format';
import type { Page } from '@playwright/test';

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

test.describe('T-339 — Precio de envío opcional y toma directa', () => {
  // ---------------------------------------------------------------------------
  // 1. Con precio y switch activo: publicación real por UI y asignación atómica
  // ---------------------------------------------------------------------------
  test('DoD: solicitud creada por UI con precio y switch activo asigna al primer repartidor atómicamente', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
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

    // 5. Courier 0 inicia sesión y navega al feed
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const courierPage = new CourierPage(page);
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
    await expect(page.getByText(/tomar solicitud/i)).toBeVisible();
    await expect(page.getByText(/precio fijado por el comercio/i)).toBeVisible();
    await expect(page.getByText(/asignación inmediata/i)).toBeVisible();
    await expect(page.getByLabel(/monto de la oferta/i)).toHaveCount(0);

    // 9. Confirma la toma de la solicitud
    const confirmButton = page.getByRole('button', {
      name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
    });
    await confirmButton.click();

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
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText(/cobrás al entregar/i)).toBeVisible();
    await expect(page.getByText(formatArs(fixedPrice))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2. Con precio y switch inactivo: genera oferta pendiente y el comercio elige
  // ---------------------------------------------------------------------------
  test('DoD: solicitud creada por UI con precio y switch inactivo crea oferta pendiente y el comercio elige', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
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

    // 2. Courier 0 toma la solicitud a $X
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const courierPage = new CourierPage(page);
    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    const takeButton = card.getByRole('button', {
      name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
    });
    await takeButton.click();

    // La hoja aclara que el comercio confirmará
    await expect(page.getByText(/el comercio confirmará/i)).toBeVisible();

    const confirmButton = page.getByRole('button', {
      name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
    });
    await confirmButton.click();

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
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
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

    // 2. Courier 0 navega al feed
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const courierPage = new CourierPage(page);
    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    // 3. Muestra botón «Ofertar» habitual
    const offerBtn = card.getByRole('button', { name: /^ofertar$/i });
    await expect(offerBtn).toBeVisible();
    await offerBtn.click();

    // 4. La hoja muestra el campo para ingresar monto y los chips
    await expect(page.getByText(/tu oferta/i)).toBeVisible();
    await expect(page.getByLabel(/monto de la oferta/i)).toBeVisible();
    await expect(page.getByText(/mínimo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar oferta/i })).toBeVisible();
  });
});
