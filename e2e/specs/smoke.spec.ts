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

  test('T-336: courier autenticado en 404 retorna a su home real (/courier/feed) al pulsar Ir al inicio', async ({
    page,
    loginAsCourier,
  }) => {
    // 1. Login courier en la misma page y contexto
    await loginAsCourier();
    await page.waitForURL((url) => url.pathname === '/courier/feed', { timeout: 30000 });
    expect(new URL(page.url()).pathname).toBe('/courier/feed');

    // Registrar solo nombres, dominio y path de cookies Supabase; nunca valores
    const context = page.context();
    const cookiesAfterLogin = await context.cookies();
    const supabaseCookiesAfterLogin = cookiesAfterLogin
      .filter((c) => c.name.includes('sb-') || c.name.includes('supabase'))
      .map(({ name, domain, path }) => ({ name, domain, path }));
    console.log(
      '[T-336 Diagnostic] Cookies after login:',
      JSON.stringify(supabaseCookiesAfterLogin)
    );

    // 2. Navegar con esa misma page a la ruta inexistente 404
    await page.goto('/t336-404-session-regression');
    await expect(page.getByRole('heading', { name: /página no encontrada/i })).toBeVisible();

    const cookiesAfter404 = await context.cookies();
    const supabaseCookiesAfter404 = cookiesAfter404
      .filter((c) => c.name.includes('sb-') || c.name.includes('supabase'))
      .map(({ name, domain, path }) => ({ name, domain, path }));
    console.log('[T-336 Diagnostic] Cookies after 404:', JSON.stringify(supabaseCookiesAfter404));

    // Monitorear requests/responses hacia /login
    let loginRequestObserved = false;
    let loginResponseStatus: number | null = null;
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname === '/login') {
        loginRequestObserved = true;
      }
    });
    page.on('response', (res) => {
      const u = new URL(res.url());
      if (u.pathname === '/login') {
        loginResponseStatus = res.status();
      }
    });

    // 3. Hacer click real en «Ir al inicio»
    const irAlInicioButton = page.getByRole('link', { name: /ir al inicio/i });
    await irAlInicioButton.click();

    // 4. Registrar URL final y cookies después del click
    await page.waitForTimeout(2000);
    const urlAfterClick = page.url();
    const pathnameAfterClick = new URL(urlAfterClick).pathname;
    const cookiesAfterClick = await context.cookies();
    const supabaseCookiesAfterClick = cookiesAfterClick
      .filter((c) => c.name.includes('sb-') || c.name.includes('supabase'))
      .map(({ name, domain, path }) => ({ name, domain, path }));

    console.log('[T-336 Diagnostic] URL after click:', pathnameAfterClick);
    console.log(
      '[T-336 Diagnostic] Login request observed:',
      loginRequestObserved,
      'Response status:',
      loginResponseStatus
    );
    console.log(
      '[T-336 Diagnostic] Cookies after click:',
      JSON.stringify(supabaseCookiesAfterClick)
    );

    // Si terminó en /login, sin reloguear, probar hard navigation documental
    if (pathnameAfterClick === '/login') {
      console.log(
        '[T-336 Diagnostic] Click landed on /login. Performing document hard navigation to /login...'
      );
      await page.goto('/login');
      const urlAfterHardNav = page.url();
      const pathnameAfterHardNav = new URL(urlAfterHardNav).pathname;
      console.log('[T-336 Diagnostic] URL after hard navigation:', pathnameAfterHardNav);
    }

    // Aserción final del DoD / E2E de regresión:
    // Debe terminar en /courier/feed (será RED con el bug y GREEN con el fix)
    await page.waitForURL((url) => url.pathname === '/courier/feed', { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/courier/feed');
  });
});
