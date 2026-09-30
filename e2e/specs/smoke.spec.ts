import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

test.describe('Spec de humo de staging (T-301)', () => {
  test('la aplicación en staging responde HTTP 200 en /api/health, ejecuta ciclo de seed/cleanup y renderiza el shell sin skeletons', async ({
    page,
    loginPage,
    stagingContext,
  }) => {
    // 1. Demostrar que el seed de staging ocurrió y generó una entidad con UUID válido
    expect(stagingContext.testRunId).toMatch(/^e2e_\d+_[a-z0-9]+$/);
    expect(stagingContext.createdRequestIds.length).toBeGreaterThan(0);
    const seededRequestId = stagingContext.createdRequestIds[0];
    expect(seededRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // 2. Verificar endpoint de salud de la plataforma
    const healthResponse = await page.goto('/api/health');
    expect(healthResponse).not.toBeNull();
    expect(healthResponse?.ok()).toBe(true);
    expect(healthResponse?.status()).toBe(200);

    // 3. Navegar a la pantalla de acceso
    await loginPage.navigate();

    // 4. Esperar a que todos los bloques de carga desaparezcan sin usar tiempos fijos
    await waitForNoSkeletons(page);

    // 5. Validar controles esenciales por rol accesible
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });
});
