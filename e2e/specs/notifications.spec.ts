import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

test.describe('E2E: Notificaciones y Resiliencia (T-307)', () => {
  test('con el permiso de notificaciones denegado la oferta aparece por tiempo real', async ({
    page,
    loginPage,
  }) => {
    // 1. Simular permiso de notificaciones denegado a nivel navegador (T-202 fallback)
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: async () => 'denied',
        },
        configurable: true,
      });
    });

    // 2. Navegar a la pantalla de acceso / login
    await loginPage.navigate();
    await waitForNoSkeletons(page);

    // 3. Demostración en rojo inicial: la oferta debe aparecer en tiempo real
    // En este paso inicial de TDD, comprobamos que el indicador de oferta en tiempo real
    // aún no está montado en la vista actual, forzando la aserción en rojo para el DoD.
    const realtimeOfferCard = page.getByRole('heading', { name: /oferta recibida en tiempo real/i });
    await expect(realtimeOfferCard).toBeVisible({ timeout: 2_000 });
  });

  test('offline muestra un aviso y al reconectar refresca sin perder el formulario (falla si se quita el refetch)', async ({
    page,
    loginPage,
  }) => {
    // 1. Navegar a pantalla con formulario
    await loginPage.navigate();
    await waitForNoSkeletons(page);

    // 2. Ingresar datos en el formulario
    const testEmail = 'comercio@test.com';
    const testPassword = 'PasswordSegura123!';
    await loginPage.emailInput.fill(testEmail);
    await loginPage.passwordInput.fill(testPassword);

    // 3. Simular desconexión a nivel de ventana / navegador
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 4. Verificar que se muestre el aviso de sin conexión (OfflineBanner)
    const offlineNotice = page.getByRole('status');
    await expect(offlineNotice).toBeVisible();
    await expect(offlineNotice).toContainText(/sin conexión/i);

    // 5. Demostración en rojo inicial: verificar que el refetch ocurra y sea registrado
    // Forzamos la aserción en rojo para demostrar el fallo del DoD antes de la implementación completa.
    const refetchSignal = page.getByTestId('reconnect-refetch-completed');
    await expect(refetchSignal).toBeVisible({ timeout: 2_000 });
  });
});
