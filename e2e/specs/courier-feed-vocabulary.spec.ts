import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { liveFeedResponseSchema } from '@/lib/live-contracts';

/**
 * T-343: el feed del repartidor usa el vocabulario canónico de tipo de paquete y medio de pago.
 *
 * DoD: con una solicitud sembrada `grande` + `to_agree`:
 * - el repartidor ve «A coordinar» (no «Transferencia») y la etiqueta de `grande` en el feed y en la hoja de oferta;
 * - después de un refresco en vivo sigue viendo lo mismo, sin error de validación.
 *
 * La solicitud sembrada se ajusta con el cliente de administración del fixture; no se toca `staging-seed.ts`.
 */

const LIVE_FEED_PATH = '/api/live/available-requests';

test.describe('T-343 — vocabulario canónico en el feed del repartidor', () => {
  test('DoD: grande + to_agree se ven igual en el render inicial y después del refresco en vivo', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
  }) => {
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Precondition Error] Se requiere una solicitud sembrada');
    }

    // 1. Precondición: valores reales de la base (paquete grande, pago a coordinar, sin cambio)
    const admin = createAdminClient();
    const { error: seedErr } = await admin
      .from('delivery_requests')
      .update({
        package_type: 'grande',
        recipient_payment_method: 'to_agree',
        needs_change: false,
        cash_change_amount: null,
      })
      .eq('id', requestId);
    if (seedErr) {
      throw new Error(`[E2E Seed Error] Falló la preparación de la solicitud: ${seedErr.message}`);
    }

    // 2. Render inicial del feed
    await loginAsCourier(0, page);
    await courierPage.gotoFeed();
    await waitForNoSkeletons(page);

    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();
    await expect(card.getByText('Paquete grande')).toBeVisible();
    await expect(card.getByText('A coordinar')).toBeVisible();
    await expect(card.getByText(/transferencia/i)).toHaveCount(0);

    // 3. Hoja de oferta
    await card.getByRole('button', { name: /^ofertar$/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Paquete grande')).toBeVisible();
    await expect(sheet.getByText('A coordinar')).toBeVisible();
    await expect(sheet.getByText(/transferencia/i)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // 4. Refresco en vivo real (refetchOnReconnect) y validación del payload con el contrato del cliente
    const liveResponse = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return response.request().method() === 'GET' && url.pathname === LIVE_FEED_PATH;
      } catch {
        return false;
      }
    });
    await page.context().setOffline(true);
    await page.context().setOffline(false);
    const response = await liveResponse;
    expect(response.ok()).toBe(true);

    const payload = liveFeedResponseSchema.parse(await response.json());
    const liveItem = payload.data.find((item) => item.id === requestId);
    expect(liveItem).toBeDefined();
    expect(liveItem?.packageType).toBe('grande');
    expect(liveItem?.recipientPaymentMethod).toBe('to_agree');

    // 5. Después del refresco: mismas etiquetas y sin error del feed
    await expect(page.getByText('No se pudieron actualizar los pedidos')).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card.getByText('Paquete grande')).toBeVisible();
    await expect(card.getByText('A coordinar')).toBeVisible();
    await expect(card.getByText(/transferencia/i)).toHaveCount(0);
  });
});
