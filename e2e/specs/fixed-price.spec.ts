import {
  test,
  expect,
  seedDeliveryRequestInState,
  getRequestInspectionData,
  createAuthenticatedClient,
  getPlatformSettingNumber,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { LoginPage, MerchantPage, CourierPage } from '../pages';
import { formatArs } from '@/lib/format';

/**
 * T-339: E2E de precio de envío opcional en la solicitud y toma directa.
 *
 * Flujos cubiertos:
 * 1. Publicación con precio y switch «asignar al primero» activo:
 *    - El repartidor ve «Tomar a $X» en lugar de «Ofertar».
 *    - Al confirmar, queda asignado (matched) de forma atómica e instantánea.
 *    - Oráculo en PostgreSQL valida estado matched, accepted_offer_id y monto exacto.
 *    - Vista de viaje refleja el monto acordado.
 *
 * 2. Publicación con precio y switch «asignar al primero» inactivo:
 *    - El repartidor toma a $X; la solicitud sigue published y crea oferta pending.
 *    - El comercio visualiza la oferta de $X y la acepta con accept_offer.
 *    - La solicitud pasa a matched.
 *
 * 3. Solicitud sin precio fijo conserva el flujo habitual de oferta abierta y subasta:
 *    - El repartidor ve «Ofertar», campo de monto numérico, piso dinámico y chips.
 */

test.describe('T-339 — Precio de envío opcional y toma directa', () => {
  // ---------------------------------------------------------------------------
  // 1. Con precio y switch activo: asignación atómica al primer repartidor
  // ---------------------------------------------------------------------------
  test('DoD: solicitud con precio y switch activo asigna al primer repartidor atómicamente', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
    const fixedPrice = Math.max(minOfferArs, 1500) + 500;

    // 1. Sembrar solicitud en estado published con precio fijo y auto_assign = true
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
      fixedPriceArs: fixedPrice,
      autoAssign: true,
    });
    const requestId = seedResult.requestId;

    // 2. Courier 0 inicia sesión y navega al feed
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const courierPage = new CourierPage(page);
    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    // 3. Verifica que la tarjeta muestre «Tomar a $X» y no el botón genérico «Ofertar»
    const takeButton = card.getByRole('button', {
      name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
    });
    await expect(takeButton).toBeVisible();
    await expect(card.getByRole('button', { name: /^ofertar$/i })).toHaveCount(0);

    // 4. Repartidor abre la hoja para tomar la solicitud
    await takeButton.click();

    // 5. La hoja muestra título de toma, banner de precio y sin input de monto ni chips
    await expect(page.getByText(/tomar solicitud/i)).toBeVisible();
    await expect(page.getByText(/precio fijado por el comercio/i)).toBeVisible();
    await expect(page.getByText(/asignación inmediata/i)).toBeVisible();
    await expect(page.getByLabel(/monto de la oferta/i)).toHaveCount(0);

    // 6. Confirma la toma de la solicitud
    const confirmButton = page.getByRole('button', {
      name: new RegExp(`tomar a \\${formatArs(fixedPrice)}`, 'i'),
    });
    await confirmButton.click();

    // 7. Oráculo server-side en PostgreSQL: la solicitud quedó matched de inmediato
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('matched');
    expect(inspection.acceptedOfferId).not.toBeNull();
    expect(inspection.fixedPriceArs).toBe(fixedPrice);
    expect(inspection.autoAssign).toBe(true);

    const acceptedOffer = inspection.offers.find((o) => o.id === inspection.acceptedOfferId);
    expect(acceptedOffer).toBeDefined();
    expect(acceptedOffer?.courierId).toBe(courier.id);
    expect(acceptedOffer?.amountArs).toBe(fixedPrice);
    expect(acceptedOffer?.status).toBe('accepted');

    // 8. El repartidor accede a la vista de viaje y verifica el monto acordado
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText(/cobrás al entregar/i)).toBeVisible();
    await expect(page.getByText(formatArs(fixedPrice))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2. Con precio y switch inactivo: genera oferta pendiente y el comercio elige
  // ---------------------------------------------------------------------------
  test('DoD: solicitud con precio y switch inactivo crea oferta pendiente y el comercio elige', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
    const fixedPrice = Math.max(minOfferArs, 1500) + 300;

    // 1. Sembrar solicitud en estado published con precio fijo y auto_assign = false
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
      fixedPriceArs: fixedPrice,
      autoAssign: false,
    });
    const requestId = seedResult.requestId;

    // 2. Courier 0 inicia sesión y navega al feed
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const courierPage = new CourierPage(page);
    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    // 3. Repartidor toma la solicitud a $X
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

    // 4. Oráculo intermedio: la solicitud sigue en estado published con una oferta pending por el precio fijo
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

    // 5. El comercio acepta la oferta creada
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerId,
    });
    expect(acceptErr).toBeNull();

    // 6. Oráculo final: la solicitud quedó matched con la oferta aceptada
    const finalInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(finalInspection.requestStatus).toBe('matched');
    expect(finalInspection.acceptedOfferId).toBe(offerId);
  });

  // ---------------------------------------------------------------------------
  // 3. Sin precio fijo: conserva el flujo de ofertas y subasta
  // ---------------------------------------------------------------------------
  test('DoD: solicitud sin precio fijo conserva el botón de ofertar y flujo abierto', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) {
      throw new Error('[E2E Error] Se requiere merchant en stagingContext');
    }

    // 1. Sembrar solicitud sin precio fijo (fixedPriceArs: null)
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
      fixedPriceArs: null,
      autoAssign: false,
    });
    const requestId = seedResult.requestId;

    // 2. Courier 0 inicia sesión y navega al feed
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
