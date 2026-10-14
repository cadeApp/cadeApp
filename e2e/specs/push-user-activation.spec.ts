import { test, expect } from '../fixtures';

test.describe('PR295-H11: Activación de Push bajo User Activation nativo en navegador real', () => {
  test('al hacer clic en «Activar avisos» en /courier/profile/notifications, Notification.requestPermission se ejecuta bajo navigator.userActivation.isActive = true', async ({
    page,
    loginAsCourier,
  }) => {
    // 1. Instrumentar Notification.requestPermission únicamente para capturar el estado real
    // de navigator.userActivation.isActive sin generar diálogo nativo ni alterar el objeto de activación.
    await page.addInitScript(() => {
      (window as unknown as { __capturedActivation: boolean | null }).__capturedActivation = null;
      (window as unknown as { __requestCallCount: number }).__requestCallCount = 0;

      if (typeof window !== 'undefined' && 'Notification' in window) {
        window.Notification.requestPermission = async () => {
          (window as unknown as { __requestCallCount: number }).__requestCallCount += 1;
          const isActive =
            typeof navigator !== 'undefined' && 'userActivation' in navigator
              ? navigator.userActivation?.isActive ?? false
              : null;
          (window as unknown as { __capturedActivation: boolean | null }).__capturedActivation =
            isActive;
          return 'denied';
        };
      }
    });

    // 2. Iniciar sesión como courier auténtico usando la fixture permitida
    await loginAsCourier(0, page);

    // 3. Navegar a la pantalla productiva de gestión de notificaciones
    await page.goto('/courier/profile/notifications');

    // 4. Control negativo: antes del clic del usuario, la API no fue invocada
    const callCountBefore = await page.evaluate(
      () => (window as unknown as { __requestCallCount: number }).__requestCallCount
    );
    expect(callCountBefore).toBe(0);

    const activateButton = page.getByRole('button', { name: /Activar avisos/i });
    await expect(activateButton).toBeVisible();

    // 5. Gesto real de usuario ejecutado por Playwright (sin mocks sobre navigator.userActivation)
    await activateButton.click();

    // 6. Verificar que la solicitud ocurrió bajo activación transitoria activa (transient user activation)
    await expect
      .poll(async () => {
        return await page.evaluate(
          () => (window as unknown as { __capturedActivation: boolean | null }).__capturedActivation
        );
      })
      .toBe(true);

    const callCountAfter = await page.evaluate(
      () => (window as unknown as { __requestCallCount: number }).__requestCallCount
    );
    expect(callCountAfter).toBe(1);

    // 7. La UI maneja la respuesta denegada de forma no bloqueante con el copy real (PUSH_COPY.prompt.statusDenied)
    await expect(page.getByText(/Avisos bloqueados en el navegador/i)).toBeVisible();
    await expect(page.getByText(/Avisos activados con éxito/i)).not.toBeVisible();
  });
});
