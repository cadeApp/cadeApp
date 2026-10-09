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

    // 7. La UI maneja la respuesta denegada de forma no bloqueante
    await expect(page.getByText(/Notificaciones bloqueadas/i)).toBeVisible();
  });

  test('control discriminante / mutación RED: si la solicitud se difiere fuera de la ventana de activación transitoria, navigator.userActivation.isActive expira a false', async ({
    page,
  }) => {
    // Demuestra que la medición es verdaderamente discriminante:
    // En Chromium, transient user activation dura ~5 segundos tras un clic de usuario.
    // Si se interpone una espera asíncrona real antes de llamar a Notification.requestPermission,
    // el gesto se pierde y navigator.userActivation.isActive retorna false.
    await page.addInitScript(() => {
      (window as unknown as { __delayedActivation: boolean | null }).__delayedActivation = null;

      if (typeof window !== 'undefined' && 'Notification' in window) {
        window.Notification.requestPermission = async () => {
          const isActive =
            typeof navigator !== 'undefined' && 'userActivation' in navigator
              ? navigator.userActivation?.isActive ?? false
              : null;
          (window as unknown as { __delayedActivation: boolean | null }).__delayedActivation =
            isActive;
          return 'denied';
        };
      }
    });

    // Cargar contenido con botón y listener con espera real de 6 segundos
    await page.goto(
      'data:text/html,<!DOCTYPE html><html><body><button id="delayed-btn">Gesto diferido</button></body></html>'
    );
    await page.evaluate(() => {
      document.getElementById('delayed-btn')?.addEventListener('click', () => {
        // Retraso intencional superior a la ventana transitoria de 5 segundos de Chromium
        setTimeout(() => {
          Notification.requestPermission();
        }, 6000);
      });
    });

    await page.click('#delayed-btn');
    await page.waitForTimeout(6500);

    const delayedActivation = await page.evaluate(
      () => (window as unknown as { __delayedActivation: boolean | null }).__delayedActivation
    );
    // Demuestra que el entorno detecta fielmente la pérdida de activación
    expect(delayedActivation).toBe(false);
  });
});
