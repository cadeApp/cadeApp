import { type APIResponse, type ConsoleMessage, type Page } from '@playwright/test';
import {
  test,
  expect,
  seedAdminUser,
  createAuthenticatedClient,
  generateTotp,
  type StagingSeedContext,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { LoginPage } from '../pages';

/**
 * T-391 (SEC-05): cabeceras de seguridad en todas las rutas.
 *
 * - Las cabeceras forzadas llegan en la respuesta original (sin seguir redirecciones) de páginas públicas, del admin
 *   (anónimo y autenticado con MFA) y de `/api`.
 * - La app no se puede embeber en un iframe de otro origen (clickjacking).
 * - La CSP forzada no rompe los flujos: el mapa real de Google carga en la nueva solicitud y no hay errores de CSP
 *   forzada; los avisos de Report-Only se registran como evidencia para T-409.
 */

const ENFORCED_CSP_DIRECTIVES = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

const ROUTES = ['/', '/login', '/admin/applicants', '/api/health'] as const;

function expectSecurityHeaders(response: APIResponse): void {
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), payment=(), usb=(), geolocation=(self)');
  expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
  for (const directive of ENFORCED_CSP_DIRECTIVES) {
    expect(headers['content-security-policy'], directive).toContain(directive);
  }
  expect(headers['content-security-policy']).not.toMatch(/script-src|default-src/);
  expect(headers['content-security-policy-report-only']).toContain("default-src 'self'");
  expect(headers['x-powered-by']).toBeUndefined();
}

interface CspConsole {
  readonly enforced: string[];
  readonly reportOnly: string[];
}

/** Separa los mensajes de CSP forzada (fallan el test) de los de Report-Only (evidencia). */
function collectCspMessages(page: Page): CspConsole {
  const result: CspConsole = { enforced: [], reportOnly: [] };
  page.on('console', (message: ConsoleMessage) => {
    const text = message.text();
    if (!/Content Security Policy/i.test(text)) return;
    if (/report[- ]only/i.test(text)) result.reportOnly.push(text);
    else if (message.type() === 'error') result.enforced.push(text);
  });
  return result;
}

/** Admin con un factor TOTP verificado (mismo patrón que `admin-courier-reinstate.spec.ts`). */
async function seedAdminWithTotp(context: StagingSeedContext): Promise<{
  credentials: UserCredentials;
  totpSecret: string;
}> {
  const credentials = await seedAdminUser(context);
  const client = await createAuthenticatedClient(credentials);
  const { data: enrolled, error: enrollErr } = await client.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollErr || !enrolled?.totp?.secret) {
    throw new Error(`[E2E MFA Error] Error al enrolar TOTP: ${enrollErr?.message}`);
  }
  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: generateTotp(enrolled.totp.secret),
  });
  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Error al verificar TOTP inicial: ${verifyErr.message}`);
  }
  return { credentials, totpSecret: enrolled.totp.secret };
}

async function loginAdminWithMfa(page: Page, credentials: UserCredentials, totpSecret: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await waitForFormHydration(loginPage.submitButton);
  await loginPage.emailInput.fill(credentials.email);
  await loginPage.passwordInput.fill(credentials.password);
  await loginPage.submitButton.click();
  await page.waitForURL(/\/login\/mfa/);

  const codeInput = page.getByLabel(/código de seguridad/i);
  await waitForFormHydration(codeInput);
  await codeInput.fill(generateTotp(totpSecret));
  await page.getByRole('button', { name: /verificar/i }).click();
  await page.waitForURL(/\/admin/);
}

test.describe('T-391 — Cabeceras de seguridad (SEC-05)', () => {
  for (const route of ROUTES) {
    test(`${route} envía las cabeceras de seguridad en su respuesta original`, async ({ request }) => {
      // Sin seguir redirecciones: /admin/applicants anónimo responde 307 desde el middleware y también debe llevarlas.
      const response = await request.get(route, { maxRedirects: 0 });
      expectSecurityHeaders(response);
    });
  }

  test('una respuesta del admin autenticado con MFA envía las cabeceras', async ({ page, stagingContext }) => {
    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);

    const response = await page.request.get('/admin/applicants', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response);
  });

  test('la app no se renderiza dentro de un iframe de otro origen', async ({ page, baseURL }) => {
    await page.setContent(`<iframe id="embed" src="${baseURL}/login" width="400" height="400"></iframe>`);
    const frameElement = await page.waitForSelector('#embed');
    const frame = await frameElement.contentFrame();

    // Chromium bloquea el documento por X-Frame-Options y frame-ancestors, y deja el frame en su página de error.
    await expect
      .poll(async () => frame?.url() ?? '', { timeout: 15000 })
      .toMatch(/^chrome-error:\/\//);
  });

  test('feed del repartidor y nueva solicitud con el mapa real cargado, sin errores de CSP forzada', async ({
    browser,
    baseURL,
    loginAsCourier,
    loginAsMerchant,
  }, testInfo) => {
    const courierContext = await browser.newContext({ baseURL });
    const merchantContext = await browser.newContext({ baseURL });
    try {
      const courierPage = await courierContext.newPage();
      const courierCsp = collectCspMessages(courierPage);
      const { courierPage: courier } = await loginAsCourier(0, courierPage);
      await courier.gotoFeed();
      await waitForNoSkeletons(courierPage);

      const merchantPage = await merchantContext.newPage();
      const merchantCsp = collectCspMessages(merchantPage);
      const { merchantPage: merchant } = await loginAsMerchant(merchantPage);
      const mapsResponse = merchantPage.waitForResponse(
        (response) => /maps\.googleapis\.com/.test(response.url()) && response.ok(),
        { timeout: 30000 }
      );
      await merchant.gotoNewRequest();
      await waitForNoSkeletons(merchantPage);

      // El mapa real de Google cargó: respondió su API y el mapa interactivo quedó en el DOM.
      await mapsResponse;
      await expect(merchantPage.getByRole('region', { name: 'Map' }).first()).toBeVisible({ timeout: 30000 });

      expect(courierCsp.enforced).toEqual([]);
      expect(merchantCsp.enforced).toEqual([]);

      await testInfo.attach('csp-report-only.json', {
        body: JSON.stringify(
          { courier: courierCsp.reportOnly, merchant: merchantCsp.reportOnly },
          null,
          2
        ),
        contentType: 'application/json',
      });
    } finally {
      await courierContext.close();
      await merchantContext.close();
    }
  });
});
