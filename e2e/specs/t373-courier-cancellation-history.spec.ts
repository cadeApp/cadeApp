import {
  test,
  expect,
  createAuthenticatedClient,
  seedDeliveryRequestInState,
  getRequestInspectionData,
  getPlatformSettingNumber,
} from '../fixtures';

/**
 * T-373 / CC-032: historial de cancelaciones de asignación del repartidor, con dos repartidores y rematch.
 *
 * Las precondiciones (pedido publicado, ofertas y aceptaciones) usan las RPC reales con la sesión de cada actor. Lo
 * que prueba la tarea se valida por la UI:
 * - el repartidor cancela desde su viaje y se queda viendo «Cancelaste esta asignación» (decisión 5-A);
 * - el comercio ve «Cancelado por el repartidor» en el detalle del pedido, que sigue publicado;
 * - la oferta cancelada no se puede volver a aceptar;
 * - después del rematch, el comercio sigue viendo el evento y el repartidor nuevo no ve cancelaciones ajenas.
 */
test.describe('T-373 — historial de cancelaciones del repartidor (CC-032)', () => {
  test('cancelación → oferta vieja no aceptable → historial del comercio → rematch, con la cronología de ambos roles', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courierA = stagingContext.courierUsers?.[0];
    const courierB = stagingContext.courierUsers?.[1];
    if (!merchant || !courierA || !courierB) {
      throw new Error('[E2E Precondition Error] Se requieren el comercio y dos repartidores de la corrida');
    }

    const minOfferArs = await getPlatformSettingNumber('min_offer_ars');
    const { requestId } = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
    });

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierAClient = await createAuthenticatedClient(courierA);
    const courierBClient = await createAuthenticatedClient(courierB);

    // 1. El repartidor A ofrece y el comercio acepta: matched con A.
    const offerA = await courierAClient.rpc('submit_offer', {
      p_request_id: requestId,
      p_amount_ars: minOfferArs,
      p_eta_minutes: 15,
    });
    expect(offerA.error).toBeNull();
    const offerAId = (offerA.data as { offerId: string }).offerId;
    const acceptA = await merchantClient.rpc('accept_offer', { p_offer_id: offerAId });
    expect(acceptA.error).toBeNull();

    // 2. El repartidor A cancela la asignación desde su viaje, por la UI.
    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await expect(page.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /no puedo hacer este viaje/i }).click();
    await page.getByRole('radio', { name: 'Problema con el vehículo' }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.getByRole('button', { name: /sí, cancelar/i }).click();

    // 5-A: se queda en /trips/[id] con su propia cronología y sin datos del viaje.
    await expect(page.getByRole('heading', { level: 1, name: 'Cancelaste esta asignación' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(new RegExp(`/trips/${requestId}`));
    const courierAHistory = page.getByRole('list', { name: 'Historial de asignaciones' });
    await expect(courierAHistory.getByRole('listitem')).toHaveCount(1);
    await expect(courierAHistory.getByText('Cancelado por el repartidor')).toBeVisible();
    await expect(courierAHistory.getByText('Problema con el vehículo')).toBeVisible();
    await expect(page.getByRole('heading', { name: /viaje en curso/i })).toHaveCount(0);

    // Oráculo en PostgreSQL: el pedido volvió a published (no cancelled) y la oferta de A quedó cancelada.
    const afterCancel = await getRequestInspectionData(stagingContext, requestId);
    expect(afterCancel.requestStatus).toBe('published');
    expect(afterCancel.acceptedOfferId).toBeNull();
    expect(afterCancel.offers.find((offer) => offer.id === offerAId)?.status).toBe('cancelled');

    // 3. La oferta vieja no se puede volver a aceptar.
    const reacceptOld = await merchantClient.rpc('accept_offer', { p_offer_id: offerAId });
    expect(reacceptOld.error, 'la oferta cancelada no debe poder aceptarse otra vez').not.toBeNull();
    expect((await getRequestInspectionData(stagingContext, requestId)).requestStatus).toBe('published');

    const merchantContext = await browser.newContext();
    const courierBContext = await browser.newContext();
    try {
      // 4. El comercio ve el evento en el detalle del pedido, que sigue publicado.
      const merchantPage = await merchantContext.newPage();
      await loginAsMerchant(merchantPage);
      await merchantPage.goto(`/merchant/requests/${requestId}`);
      const merchantHistory = merchantPage.getByRole('list', { name: 'Historial de asignaciones' });
      await expect(merchantHistory.getByRole('listitem')).toHaveCount(1, { timeout: 15000 });
      await expect(merchantHistory.getByText('Cancelado por el repartidor')).toBeVisible();
      await expect(merchantHistory.getByText('Problema con el vehículo')).toBeVisible();
      await expect(merchantPage.getByText(/Eso no cancela el pedido/)).toBeVisible();
      await expect(merchantPage).toHaveURL(new RegExp(`/merchant/requests/${requestId}`));

      // 5. Rematch: el repartidor B ofrece y el comercio lo acepta.
      const offerB = await courierBClient.rpc('submit_offer', {
        p_request_id: requestId,
        p_amount_ars: minOfferArs,
        p_eta_minutes: 20,
      });
      expect(offerB.error).toBeNull();
      const offerBId = (offerB.data as { offerId: string }).offerId;
      const acceptB = await merchantClient.rpc('accept_offer', { p_offer_id: offerBId });
      expect(acceptB.error).toBeNull();
      expect((await getRequestInspectionData(stagingContext, requestId)).acceptedOfferId).toBe(offerBId);

      // El comercio, ya en el viaje del rematch, sigue viendo la cancelación de A.
      await merchantPage.goto(`/merchant/requests/${requestId}`);
      await expect(merchantPage).toHaveURL(new RegExp(`/trips/${requestId}`), { timeout: 15000 });
      await expect(merchantPage.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
      await expect(
        merchantPage.getByRole('list', { name: 'Historial de asignaciones' }).getByRole('listitem')
      ).toHaveCount(1, { timeout: 15000 });

      // 6. El repartidor B ve su viaje y nada del historial de A.
      const courierBPage = await courierBContext.newPage();
      await loginAsCourier(1, courierBPage);
      await courierBPage.goto(`/trips/${requestId}`);
      await expect(courierBPage.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
      await expect(courierBPage.getByText('Historial de asignaciones')).toHaveCount(0);
      await expect(courierBPage.getByText('Cancelado por el repartidor')).toHaveCount(0);

      // 7. El repartidor A, ya sin asignación, sigue viendo solo su cancelación y nada del viaje de B.
      await page.goto(`/trips/${requestId}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Cancelaste esta asignación' })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole('list', { name: 'Historial de asignaciones' }).getByRole('listitem')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: /viaje en curso/i })).toHaveCount(0);
    } finally {
      await merchantContext.close();
      await courierBContext.close();
    }
  });
});
