import { test, expect, type Request, type Route } from '@playwright/test';
import { authCopy } from '@/features/auth/copy';
import { HYDRATION_WAIT_FLAG, waitForFormHydration } from '../helpers/hydration';
import { LoginPage } from '../pages/login.page';

/**
 * T-337 — `LoginPage.login` no puede completar ni enviar el formulario antes de que React lo hidrate.
 *
 * Retiene los chunks JS para dejar el formulario tal como lo sirve el servidor y aborta el Server Action, así
 * que no llega a Supabase Auth ni usa credenciales ni datos de seed.
 */

const isLoginPath = (url: URL): boolean => url.pathname === '/login';

const isServerAction = (request: Request): boolean =>
  request.method() === 'POST' && request.headers()['next-action'] !== undefined;

test.describe('T-337 — LoginPage.login espera la hidratación del formulario', () => {
  test('no completa ni envía el formulario hasta que React lo hidrata', async ({ page }) => {
    const heldChunks: Route[] = [];
    let chunksReleased = false;
    await page.route('**/_next/static/chunks/**', async (route) => {
      if (chunksReleased) {
        await route.continue();
        return;
      }
      heldChunks.push(route);
    });

    const serverActionPosts: Request[] = [];
    await page.route(isLoginPath, async (route) => {
      if (isServerAction(route.request())) {
        serverActionPosts.push(route.request());
        await route.abort();
        return;
      }
      await route.continue();
    });

    // Un submit nativo antes de hidratar es una segunda navegación de documento a /login.
    const loginDocuments: Request[] = [];
    page.on('request', (request) => {
      if (request.isNavigationRequest() && isLoginPath(new URL(request.url()))) {
        loginDocuments.push(request);
      }
    });

    // `load` espera los chunks retenidos: alcanza con el HTML del servidor.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const loginPage = new LoginPage(page);
    const attempt = loginPage.login('t337@example.test', 't337-not-a-password').then(
      () => null,
      (error: unknown) => error
    );

    // El page object ya está esperando la hidratación y todavía no tocó el formulario.
    await page.waitForFunction((flag) => Reflect.get(window, flag) === true, HYDRATION_WAIT_FLAG, {
      timeout: 10_000,
    });
    await expect(loginPage.emailInput).toHaveValue('');
    await expect(loginPage.passwordInput).toHaveValue('');
    expect(serverActionPosts).toHaveLength(0);
    expect(loginDocuments).toHaveLength(1);

    chunksReleased = true;
    await Promise.all(heldChunks.splice(0).map((route) => route.continue()));

    // Hidratado, envía el Server Action una sola vez y, con el POST abortado, falla con el error del
    // formulario en lugar de esperar el timeout de navegación.
    const error = await attempt;
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain(authCopy.login.errorGeneric);
    expect(serverActionPosts).toHaveLength(1);
    expect(loginDocuments).toHaveLength(1);
    await expect(page).toHaveURL(/\/login$/);
  });

  // Contrato del helper (PR255-H01): React escribe las props antes del commit de la hidratación, así que un
  // `onSubmit` presente no alcanza mientras el Fiber siga en Hydrating. No reemplaza el caso real de arriba.
  test('waitForFormHydration espera a que el Fiber del formulario esté montado, no solo su onSubmit', async ({
    page,
  }) => {
    await page.setContent('<form><button type="submit">Ingresar</button></form>');

    // HostComponent (flags = Hydrating) → return → HostRoot (tag 3, flags 0), sin alternate: React 18.3.1.
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) throw new Error('[E2E Error] Falta el form del contrato');
      const hostRoot = { tag: 3, flags: 0, return: null, alternate: null };
      const target = { tag: 5, flags: 4096, return: hostRoot, alternate: null };
      Reflect.set(form, '__reactProps$test', { onSubmit() {} });
      Reflect.set(form, '__reactFiber$test', target);
    });
    const submit = page.getByRole('button', { name: 'Ingresar' });

    await expect(waitForFormHydration(submit, { timeout: 2_000 })).rejects.toThrow(
      /El formulario no se hidrató/
    );

    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) throw new Error('[E2E Error] Falta el form del contrato');
      const target: unknown = Reflect.get(form, '__reactFiber$test');
      if (typeof target !== 'object' || target === null) {
        throw new Error('[E2E Error] Falta el Fiber del contrato');
      }
      Reflect.set(target, 'flags', 0);
    });

    await expect(waitForFormHydration(submit, { timeout: 2_000 })).resolves.toBeUndefined();
  });
});
