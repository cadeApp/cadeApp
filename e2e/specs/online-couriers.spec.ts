import { test, expect, assertAllowedE2EEnvironment } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-415 (CC-041): repartidores conectados ahora.
 *
 * - El repartidor entra a su feed con «Disponible» prendido y la app manda la señal de presencia (`courier_heartbeat`).
 * - El comercio ve en su inicio y en «Nueva solicitud» al menos 1 repartidor conectado.
 *
 * La base de develop es compartida: puede haber otros repartidores conectados, así que se exige «al menos 1».
 */

const ONLINE_TEXT = /(\d+) repartidore?s? conectados? ahora/;

test.describe('T-415 — Repartidores conectados ahora', () => {
  test('con un repartidor conectado, el comercio lo ve antes de publicar', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    assertAllowedE2EEnvironment();
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] Se requiere un repartidor en stagingContext');
    const admin = createAdminClient();
    const startedAt = Date.now();

    // Repartidor: feed con «Disponible» prendido; la señal la manda la app sola.
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);
    const toggle = page.getByRole('switch', { name: 'Cambiar estado de disponibilidad' });
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute('aria-checked')) !== 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    }

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('courier_presence')
            .select('last_seen_at')
            .eq('courier_id', courier.id)
            .maybeSingle();
          return data ? Date.parse(data.last_seen_at) : 0;
        },
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(startedAt - 5_000);

    // Comercio: indicador en su inicio y en «Nueva solicitud».
    const merchantContext = await browser.newContext();
    try {
      const merchantPage = await merchantContext.newPage();
      await loginAsMerchant(merchantPage);

      await merchantPage.goto('/merchant/dashboard');
      await waitForNoSkeletons(merchantPage);
      const homeStatus = merchantPage.getByRole('status').filter({ hasText: ONLINE_TEXT });
      await expect(homeStatus).toBeVisible();
      const homeCount = Number(ONLINE_TEXT.exec((await homeStatus.textContent()) ?? '')?.[1] ?? '0');
      expect(homeCount).toBeGreaterThanOrEqual(1);

      await merchantPage.goto('/merchant/requests/new');
      await waitForNoSkeletons(merchantPage);
      await expect(merchantPage.getByRole('status').filter({ hasText: ONLINE_TEXT })).toBeVisible();
    } finally {
      await merchantContext.close();
    }
  });
});
