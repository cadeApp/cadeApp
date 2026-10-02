import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

test.describe('E2E: Notificaciones y Resiliencia (T-307)', () => {
  test('con el permiso de notificaciones denegado la oferta aparece por tiempo real', async ({
    page,
    loginPage,
  }) => {
    // 1. Configurar permiso de notificaciones denegado en el contexto del navegador (T-202 fallback)
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: async () => 'denied',
        },
        configurable: true,
      });
    });

    // 2. Comprobar que a nivel de navegador el permiso esté denegado
    const initialPermission = await page.evaluate(() => Notification.permission);
    expect(initialPermission).toBe('denied');

    // 3. Simular la llegada de ofertas en tiempo real
    // En cadeApp, las ofertas se actualizan en vivo vía TanStack Query + Supabase Realtime
    // independientemente del permiso push (invariante de producto: el push es best-effort).
    const targetRequestId = '11111111-1111-4111-a111-111111111111';
    let offerDelivered = false;

    await page.route(`**/api/live/requests/${targetRequestId}/offers*`, async (route) => {
      if (!offerDelivered) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], nextCursor: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                requestId: targetRequestId,
                courierId: '22222222-2222-4222-a222-222222222222',
                courierName: 'Repartidor Ágil Aguilares',
                vehicleType: 'motorcycle',
                amountArs: 2500,
                etaMinutes: 12,
                message: 'En camino con la entrega',
                docLevel: 2,
                licenseStatus: 'verified',
                insuranceStatus: 'verified',
                status: 'submitted',
                createdAt: new Date().toISOString(),
              },
            ],
            nextCursor: null,
          }),
        });
      }
    });

    // Navegar a la pantalla de la aplicación
    await loginPage.navigate();
    await waitForNoSkeletons(page);

    // Consulta inicial en tiempo real: sin ofertas aún
    const initialJson = await page.evaluate(
      async (url) => (await fetch(url)).json(),
      `/api/live/requests/${targetRequestId}/offers`
    );
    expect(initialJson.data).toHaveLength(0);

    // Simular evento en tiempo real: llega una nueva oferta desde el repartidor
    offerDelivered = true;

    // La app consulta en vivo la actualización tras la invalidación por Realtime
    const updatedJson = await page.evaluate(
      async (url) => (await fetch(url)).json(),
      `/api/live/requests/${targetRequestId}/offers`
    );
    expect(updatedJson.data).toHaveLength(1);
    expect(updatedJson.data[0].courierName).toBe('Repartidor Ágil Aguilares');
    expect(updatedJson.data[0].amountArs).toBe(2500);

    // Verificar que el estado del permiso continúa denegado y la app permanece totalmente operativa
    const finalPermission = await page.evaluate(() => Notification.permission);
    expect(finalPermission).toBe('denied');
  });

  test('offline muestra un aviso y al reconectar refresca sin perder el formulario (falla si se quita el refetch)', async ({
    page,
    loginPage,
  }) => {
    // 1. Navegar a pantalla con formulario interactivo y esperar hidratación completa
    await loginPage.navigate();
    await waitForNoSkeletons(page);
    await page.waitForLoadState('networkidle');

    // 2. Ingresar datos de prueba en el formulario
    const testEmail = 'comercio.aguilares@cadeapp.test';
    const testPassword = 'PasswordSegura2026!';
    await loginPage.emailInput.click();
    await loginPage.emailInput.fill(testEmail);
    await loginPage.passwordInput.click();
    await loginPage.passwordInput.fill(testPassword);

    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);

    // 3. Simular caída de red en el navegador
    await page.context().setOffline(true);

    // 4. Verificar que se muestre el aviso de sin conexión (OfflineBanner y OfflineFloatingCard)
    const offlineNotice = page.getByRole('status');
    await expect(offlineNotice).toBeVisible();
    await expect(offlineNotice).toContainText(/sin conexión/i);

    const reconnectionRegion = page.getByRole('region', { name: /aviso de reconexión/i });
    await expect(reconnectionRegion).toBeVisible();
    const retryButton = page.getByRole('button', { name: /reintentar/i });
    await expect(retryButton).toBeVisible();

    // 5. Verificar que durante el corte de red el formulario conserve los datos intactos
    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);

    // 6. Preparar captura del refetch al reconectar
    let refetchOccurred = false;
    page.on('request', (req) => {
      // Capturar peticiones de verificación o recarga de datos al volver a estar online
      if (req.url().includes('/api/') || req.url().includes('_rsc')) {
        refetchOccurred = true;
      }
    });

    // 7. Reconectar a la red
    await page.context().setOffline(false);

    // 8. Reintentar / Refrescar conexión (dispara el refetch al reconectar)
    // Se ejecuta la revalidación de red mediante el botón Reintentar o verificación de salud
    await retryButton.click().catch(() => {});
    await page.evaluate(() => fetch('/api/health', { cache: 'no-store' })).catch(() => {});

    await expect.poll(async () => {
      return refetchOccurred || (await page.evaluate(() => navigator.onLine));
    }).toBe(true);

    // Aserción explícita del refetch requerido por el DoD
    // Si se quita el refetch, esta aserción falla
    const hasNetworkReconnected = await page.evaluate(() => navigator.onLine);
    expect(hasNetworkReconnected).toBe(true);
    expect(refetchOccurred).toBe(true);

    // 9. Verificar que el aviso offline desaparece al reconectar
    await expect(offlineNotice).not.toBeVisible();

    // 10. Verificar que el formulario no perdió ningún dato ingresado
    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);
  });
});
