import type { Page } from '@playwright/test';
import {
  test,
  expect,
  createAuthenticatedClient,
  seedDeliveryRequestInState,
  getRequestInspectionData,
  getPlatformSettingNumber,
  createStagingSeedContext,
  seedStagingData,
  cleanupStagingData,
} from '../fixtures';
import { LoginPage } from '../pages';

/**
 * T-373 / CC-032: historial de cancelaciones de asignación con dos cancelaciones reales y rematch.
 *
 * Las precondiciones (pedido publicado, ofertas y aceptaciones) usan las RPC reales con la sesión de cada actor. Las
 * cancelaciones y lo que ve cada rol se validan por la UI:
 * - A y B cancelan su asignación desde el viaje, con categorías distintas, y se quedan en «Cancelaste esta
 *   asignación» (decisión 5-A);
 * - la oferta cancelada de A no se puede volver a aceptar; A vuelve con una oferta nueva y se lo reasigna;
 * - el comercio ve exactamente dos eventos, B primero y A después (created_at DESC), con actor y categoría;
 * - A ve solo su evento, B solo el suyo y un tercer repartidor sin eventos no ve nada.
 */

async function cancelAssignmentFromTrip(page: Page, requestId: string, reason: string): Promise<void> {
  await page.goto(`/trips/${requestId}`);
  await expect(page.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /no puedo hacer este viaje/i }).click();
  await page.getByRole('radio', { name: reason }).click();
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.getByRole('button', { name: /sí, cancelar/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cancelaste esta asignación' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page).toHaveURL(new RegExp(`/trips/${requestId}`));
}

function historyItems(page: Page) {
  return page.getByRole('list', { name: 'Historial de asignaciones' }).getByRole('listitem');
}

test.describe('T-373 — historial de cancelaciones del repartidor (CC-032)', () => {
  test('dos cancelaciones reales → rematch con oferta nueva: orden B→A para el comercio y aislamiento entre repartidores', async ({
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
    const nameA = courierA.displayName;
    const nameB = courierB.displayName;
    if (!nameA || !nameB) {
      throw new Error('[E2E Precondition Error] Los repartidores de la corrida no tienen nombre público');
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

    async function offerAndAccept(client: typeof courierAClient, etaMinutes: number): Promise<string> {
      const offer = await client.rpc('submit_offer', {
        p_request_id: requestId,
        p_amount_ars: minOfferArs,
        p_eta_minutes: etaMinutes,
      });
      expect(offer.error).toBeNull();
      const offerId = (offer.data as { offerId: string }).offerId;
      const accepted = await merchantClient.rpc('accept_offer', { p_offer_id: offerId });
      expect(accepted.error).toBeNull();
      return offerId;
    }

    const courierBContext = await browser.newContext();
    const merchantContext = await browser.newContext();
    const courierCContext = await browser.newContext();
    const outsiderSeed = createStagingSeedContext();
    try {
      // 1. A es asignado y cancela por la UI con «Problema con el vehículo».
      const offerA1 = await offerAndAccept(courierAClient, 15);
      await loginAsCourier(0, page);
      await cancelAssignmentFromTrip(page, requestId, 'Problema con el vehículo');
      await expect(historyItems(page)).toHaveCount(1);

      const afterA = await getRequestInspectionData(stagingContext, requestId);
      expect(afterA.requestStatus).toBe('published');
      expect(afterA.acceptedOfferId).toBeNull();
      expect(afterA.offers.find((offer) => offer.id === offerA1)?.status).toBe('cancelled');

      // La oferta terminal de A no se puede volver a aceptar.
      const reacceptA1 = await merchantClient.rpc('accept_offer', { p_offer_id: offerA1 });
      expect(reacceptA1.error, 'la oferta cancelada no debe poder aceptarse otra vez').not.toBeNull();

      // MUTACIÓN DE PRUEBA (PR425-H01, RED): se omite la segunda cancelación (la de B). El oráculo del comercio, que
      // exige dos eventos, tiene que fallar. El commit siguiente restaura el paso.
      const courierBPage = await courierBContext.newPage();
      await loginAsCourier(1, courierBPage);

      // 3. El comercio ve exactamente dos eventos en el detalle publicado: B (más reciente) primero, A después.
      const merchantPage = await merchantContext.newPage();
      await loginAsMerchant(merchantPage);
      await merchantPage.goto(`/merchant/requests/${requestId}`);
      await expect(merchantPage).toHaveURL(new RegExp(`/merchant/requests/${requestId}`));
      await expect(historyItems(merchantPage)).toHaveCount(2, { timeout: 15000 });
      await expect(historyItems(merchantPage).nth(0)).toContainText('Emergencia');
      await expect(historyItems(merchantPage).nth(0)).toContainText(nameB);
      await expect(historyItems(merchantPage).nth(1)).toContainText('Problema con el vehículo');
      await expect(historyItems(merchantPage).nth(1)).toContainText(nameA);
      await expect(merchantPage.getByText(/Eso no cancela el pedido/)).toBeVisible();

      // 4. Rematch: A vuelve con una oferta NUEVA (no la terminal) y el comercio la acepta.
      const offerA2 = await offerAndAccept(courierAClient, 25);
      expect(offerA2).not.toBe(offerA1);
      expect((await getRequestInspectionData(stagingContext, requestId)).acceptedOfferId).toBe(offerA2);

      // El comercio, ya en el viaje del rematch, mantiene los dos eventos en el mismo orden.
      await merchantPage.goto(`/merchant/requests/${requestId}`);
      await expect(merchantPage).toHaveURL(new RegExp(`/trips/${requestId}`), { timeout: 15000 });
      await expect(merchantPage.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
      await expect(historyItems(merchantPage)).toHaveCount(2, { timeout: 15000 });
      await expect(historyItems(merchantPage).nth(0)).toContainText('Emergencia');
      await expect(historyItems(merchantPage).nth(1)).toContainText('Problema con el vehículo');

      // 5. A, reasignado, ve su viaje y en la cronología solo su propia cancelación.
      await page.goto(`/trips/${requestId}`);
      await expect(page.getByRole('heading', { name: /viaje en curso/i })).toBeVisible({ timeout: 15000 });
      await expect(historyItems(page)).toHaveCount(1);
      await expect(historyItems(page).first()).toContainText('Problema con el vehículo');
      await expect(page.getByText('Emergencia')).toHaveCount(0);

      // B, ya sin asignación, sigue viendo solo la suya y nada del viaje de A.
      await courierBPage.goto(`/trips/${requestId}`);
      await expect(courierBPage.getByRole('heading', { level: 1, name: 'Cancelaste esta asignación' })).toBeVisible({
        timeout: 15000,
      });
      await expect(historyItems(courierBPage)).toHaveCount(1);
      await expect(courierBPage.getByRole('heading', { name: /viaje en curso/i })).toHaveCount(0);

      // 6. Un repartidor sin eventos en el pedido no ve el viaje ni puede inferir cancelaciones ajenas.
      await seedStagingData(outsiderSeed, { requestsCount: 0, couriersCount: 1 });
      const courierC = outsiderSeed.courierUsers?.[0];
      if (!courierC) throw new Error('[E2E Precondition Error] No se pudo crear el tercer repartidor');
      const courierCPage = await courierCContext.newPage();
      const loginC = new LoginPage(courierCPage);
      await loginC.navigate();
      await loginC.login(courierC.email, courierC.password);
      await courierCPage.goto(`/trips/${requestId}`);
      await expect(courierCPage.getByText('Viaje no encontrado')).toBeVisible({ timeout: 15000 });
      await expect(courierCPage.getByText('Historial de asignaciones')).toHaveCount(0);
      await expect(courierCPage.getByText('Cancelado por el repartidor')).toHaveCount(0);
    } finally {
      await courierBContext.close();
      await merchantContext.close();
      await courierCContext.close();
      await cleanupStagingData(outsiderSeed);
    }
  });
});
