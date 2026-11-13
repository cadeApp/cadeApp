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
import { createAdminClient } from '@/server/supabase/admin';
import { COURIER_DOCS_BUCKET } from '@/features/courier-onboarding/upload-manager';

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

/** T-436: violación CSP minimizada; solo directiva, disposición y origen (sin path, query ni datos). */
interface CspViolation {
  readonly directive: string;
  readonly disposition: string;
  readonly origin: string;
}

/**
 * Registra `securitypolicyviolation` antes de que corra cualquier script de la página, en cada documento.
 * `blockedURI` se reduce al origen; los valores sin origen (`inline`, `eval`, `data:`) quedan como esquema o palabra.
 */
async function installCspViolationCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store: { directive: string; disposition: string; origin: string }[] = [];
    Object.defineProperty(window, '__t436CspViolations', { value: store, configurable: true });
    document.addEventListener('securitypolicyviolation', (event) => {
      let origin = event.blockedURI;
      try {
        const url = new URL(event.blockedURI);
        origin = url.origin === 'null' ? url.protocol : url.origin;
      } catch {
        // `inline`, `eval` u otro valor sin URL: se conserva tal cual (no trae datos).
      }
      store.push({ directive: event.effectiveDirective, disposition: event.disposition, origin });
    });
  });
}

async function readCspViolations(page: Page): Promise<CspViolation[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, '__t436CspViolations');
    return Array.isArray(value) ? (value as CspViolation[]) : [];
  });
}

const enforcedViolations = (violations: readonly CspViolation[]) =>
  violations.filter((v) => v.disposition === 'enforce');

/** Inventario acotado por stdout: el reporte de Playwright no guarda adjuntos de tests que pasan. */
function logCspInventory(flow: string, violations: readonly CspViolation[], requestOrigins: ReadonlySet<string>): void {
  for (const v of violations) {
    console.log(`[T-436 csp] flujo=${flow} disposition=${v.disposition} directiva=${v.directive} origen=${v.origin}`);
  }
  for (const origin of [...requestOrigins].sort()) {
    console.log(`[T-436 inventario] flujo=${flow} origen=${origin}`);
  }
}

function trackRequestOrigins(page: Page): Set<string> {
  const origins = new Set<string>();
  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ws:' || url.protocol === 'wss:') {
        origins.add(url.origin);
      }
    } catch {
      // URL no parseable (data:, blob:): fuera del inventario de orígenes.
    }
  });
  return origins;
}

const BYPASS_ORIGIN = 'https://csp-test.invalid';
const PROBE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Respuesta `phx_reply` con `status: ok` a un `phx_join` enviado por la página (protocolo de Realtime v1 en objeto o
 * v2 en arreglo). Devuelve el `ref` del join o del reply según `kind`.
 */
function parsePhoenixFrame(raw: string): { topic: string; event: string; ref: string | null; status?: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 5) {
      const [, ref, topic, event, payload] = parsed as [unknown, unknown, unknown, unknown, unknown];
      if (typeof topic !== 'string' || typeof event !== 'string') return null;
      const status = typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'status') : undefined;
      return { topic, event, ref: typeof ref === 'string' ? ref : null, status };
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const topic = Reflect.get(parsed, 'topic');
      const event = Reflect.get(parsed, 'event');
      const ref = Reflect.get(parsed, 'ref');
      const payload = Reflect.get(parsed, 'payload');
      if (typeof topic !== 'string' || typeof event !== 'string') return null;
      const status = typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'status') : undefined;
      return { topic, event, ref: typeof ref === 'string' ? ref : null, status };
    }
  } catch {
    // Frame binario o no JSON: no es un mensaje de control de Phoenix.
  }
  return null;
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
    await installCspViolationCapture(page);
    const adminOrigins = trackRequestOrigins(page);
    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);
    await waitForNoSkeletons(page);
    const adminViolations = await readCspViolations(page);
    logCspInventory('admin-mfa', adminViolations, adminOrigins);
    expect(enforcedViolations(adminViolations)).toEqual([]);

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
      await installCspViolationCapture(courierPage);
      const courierOrigins = trackRequestOrigins(courierPage);
      const courierCsp = collectCspMessages(courierPage);
      const { courierPage: courier } = await loginAsCourier(0, courierPage);
      await courier.gotoFeed();
      await waitForNoSkeletons(courierPage);

      const courierViolations = await readCspViolations(courierPage);

      const merchantPage = await merchantContext.newPage();
      await installCspViolationCapture(merchantPage);
      const merchantOrigins = trackRequestOrigins(merchantPage);
      const merchantCsp = collectCspMessages(merchantPage);
      const { merchantPage: merchant } = await loginAsMerchant(merchantPage);
      await merchant.gotoNewRequest();
      await waitForNoSkeletons(merchantPage);

      // El mapa se abre a pedido: se espera la respuesta real de Google y el mapa interactivo en el DOM.
      const mapsResponse = merchantPage.waitForResponse(
        (response) => /maps\.googleapis\.com/.test(response.url()) && response.ok(),
        { timeout: 30000 }
      );
      await merchantPage.getByRole('button', { name: /fijar en mapa interactivo/i }).first().click();
      await mapsResponse;
      await expect(merchantPage.getByTestId('map-container').first()).toBeVisible({ timeout: 30000 });
      await expect(merchantPage.getByRole('region', { name: 'Map' }).first()).toBeVisible({ timeout: 30000 });

      const merchantViolations = await readCspViolations(merchantPage);
      logCspInventory('courier-feed', courierViolations, courierOrigins);
      logCspInventory('merchant-map', merchantViolations, merchantOrigins);

      expect(courierCsp.enforced).toEqual([]);
      expect(merchantCsp.enforced).toEqual([]);
      expect(enforcedViolations(courierViolations)).toEqual([]);
      expect(enforcedViolations(merchantViolations)).toEqual([]);

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

  test('T-436: inventario de CSP en / y /login sin violaciones forzadas', async ({ page }) => {
    await installCspViolationCapture(page);
    for (const route of ['/', '/login'] as const) {
      const origins = trackRequestOrigins(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const violations = await readCspViolations(page);
      logCspInventory(route === '/' ? 'home' : 'login', violations, origins);
      expect(enforcedViolations(violations)).toEqual([]);
    }
  });

  test('T-436: la CSP forzada bloquea un script, un fetch y una imagen de un origen no permitido', async ({
    page,
    baseURL,
  }) => {
    await installCspViolationCapture(page);
    const reachedHandler: string[] = [];
    // Destinos controlados y válidos: un fallo no puede deberse a DNS ni a CORS, solo a la CSP.
    await page.route(`${BYPASS_ORIGIN}/**`, async (route) => {
      const { pathname } = new URL(route.request().url());
      reachedHandler.push(pathname);
      if (pathname === '/script.js') {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__t436ProbeRan = true;' });
      } else if (pathname === '/probe.png') {
        await route.fulfill({ status: 200, contentType: 'image/png', body: PROBE_PNG });
      } else if (pathname === '/probe.json') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': new URL(baseURL ?? 'http://localhost').origin },
          body: '{"ok":true}',
        });
      } else {
        await route.fulfill({ status: 404, body: '' });
      }
    });

    await page.goto('/login');
    const attempt = await page.evaluate(async (origin) => {
      const loadElement = (element: HTMLScriptElement | HTMLImageElement, attach: () => void) =>
        new Promise<'load' | 'error'>((resolve) => {
          element.onload = () => resolve('load');
          element.onerror = () => resolve('error');
          attach();
        });
      const script = document.createElement('script');
      script.src = `${origin}/script.js`;
      const scriptResult = await loadElement(script, () => document.head.appendChild(script));
      const image = document.createElement('img');
      const imageResult = await loadElement(image, () => {
        image.src = `${origin}/probe.png`;
      });
      let fetchResult: 'ok' | 'rejected';
      try {
        await fetch(`${origin}/probe.json`);
        fetchResult = 'ok';
      } catch {
        fetchResult = 'rejected';
      }
      return { scriptResult, imageResult, fetchResult, scriptRan: Reflect.get(window, '__t436ProbeRan') === true };
    }, BYPASS_ORIGIN);

    const blockedBy = async (directive: string) =>
      (await readCspViolations(page)).filter(
        (v) => v.disposition === 'enforce' && v.directive === directive && v.origin === BYPASS_ORIGIN
      ).length;
    await expect.poll(() => blockedBy('script-src-elem'), { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(() => blockedBy('img-src'), { timeout: 10000 }).toBeGreaterThan(0);
    await expect.poll(() => blockedBy('connect-src'), { timeout: 10000 }).toBeGreaterThan(0);
    expect(attempt).toEqual({ scriptResult: 'error', imageResult: 'error', fetchResult: 'rejected', scriptRan: false });
    expect(reachedHandler).toEqual([]);
  });

  test('T-436: Storage desde el navegador sube un documento con el origen HTTPS de Supabase y sin violaciones forzadas', async ({
    page,
    loginAsCourier,
  }) => {
    await installCspViolationCapture(page);
    let storagePath: string | null = null;
    try {
      await loginAsCourier(0, page);
      await page.goto('/courier/onboarding/identity');
      await waitForNoSkeletons(page);

      const upload = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && /\/storage\/v1\/object\/courier-docs\//.test(response.url()),
        { timeout: 30000 }
      );
      const dniFrontInput = page.getByLabel(/DNI frente/i);
      await expect(dniFrontInput).toBeAttached();
      await dniFrontInput.setInputFiles({ name: 'dni_front.png', mimeType: 'image/png', buffer: PROBE_PNG });
      const response = await upload;
      const match = response.url().match(/\/storage\/v1\/object\/courier-docs\/(.+?)(\?.*)?$/);
      storagePath = match?.[1] ? decodeURIComponent(match[1]) : null;

      expect(response.ok()).toBe(true);
      expect(new URL(response.url()).origin).toBe(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin);
      await expect(page.getByRole('status').filter({ hasText: 'dni_front.png' })).toBeVisible({ timeout: 15000 });
      expect(enforcedViolations(await readCspViolations(page))).toEqual([]);
    } finally {
      if (storagePath) {
        const { error } = await createAdminClient().storage.from(COURIER_DOCS_BUCKET).remove([storagePath]);
        expect(error).toBeNull();
      }
    }
  });

  test('T-436: Realtime desde el navegador une el canal del feed por el origen WSS de Supabase y sin violaciones forzadas', async ({
    page,
    loginAsCourier,
  }) => {
    await installCspViolationCapture(page);
    const realtime = { opened: false, joinRefs: new Set<string>(), joinedOk: false };
    page.on('websocket', (socket) => {
      if (!/\/realtime\/v1\/websocket/.test(socket.url())) return;
      // El socket va al host de Supabase del entorno (origen WSS de `connect-src`).
      realtime.opened = new URL(socket.url()).host === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
      socket.on('framesent', ({ payload }) => {
        const frame = typeof payload === 'string' ? parsePhoenixFrame(payload) : null;
        if (frame?.event === 'phx_join' && frame.topic !== 'phoenix' && frame.ref) realtime.joinRefs.add(frame.ref);
      });
      socket.on('framereceived', ({ payload }) => {
        const frame = typeof payload === 'string' ? parsePhoenixFrame(payload) : null;
        if (frame?.event === 'phx_reply' && frame.status === 'ok' && frame.ref && realtime.joinRefs.has(frame.ref)) {
          realtime.joinedOk = true;
        }
      });
    });

    const { courierPage } = await loginAsCourier(0, page);
    await courierPage.gotoFeed();
    await waitForNoSkeletons(page);

    await expect
      .poll(() => realtime.joinedOk, { timeout: 30000, message: 'join de Realtime confirmado (phx_reply ok)' })
      .toBe(true);
    expect(realtime.opened).toBe(true);
    expect(enforcedViolations(await readCspViolations(page))).toEqual([]);
  });
});
