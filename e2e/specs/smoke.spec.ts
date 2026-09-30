import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

test.describe('Spec de humo de staging (T-301)', () => {
  test('la aplicación en staging responde HTTP 200 en /api/health y renderiza el shell sin skeletons', async ({
    page,
    loginPage,
  }) => {
    // 1. Verificar endpoint de salud de la plataforma
    const healthResponse = await page.goto('/api/health');
    expect(healthResponse).not.toBeNull();
    expect(healthResponse?.ok()).toBe(true);
    expect(healthResponse?.status()).toBe(200);

    // 2. Navegar a la pantalla de acceso
    await loginPage.navigate();

    // 3. Esperar a que todos los bloques de carga desaparezcan sin usar tiempos fijos
    await waitForNoSkeletons(page);

    // 4. Validar controles esenciales por rol accesible
    await expect(loginPage.phoneInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });
});
