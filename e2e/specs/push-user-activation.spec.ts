import { randomBytes, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, createAuthenticatedClient, type UserCredentials } from '../fixtures';

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

// T-383 (CC-035): el endpoint push es del navegador, no de la cuenta. El push service real no existe en Chromium
// headless de CI, así que se reemplaza solo `PushManager.getSubscription` por una suscripción fija del navegador;
// permiso, service worker, ruta `POST /api/push/subscriptions`, RPC y RLS son los de producción.
interface FakeBrowserSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function installBrowserPushSubscription(page: Page, sub: FakeBrowserSubscription) {
  await page.context().grantPermissions(['notifications']);
  await page.addInitScript((fake: FakeBrowserSubscription) => {
    const subscription = {
      endpoint: fake.endpoint,
      expirationTime: null,
      options: { userVisibleOnly: true, applicationServerKey: null },
      getKey: () => null,
      toJSON: () => ({
        endpoint: fake.endpoint,
        expirationTime: null,
        keys: { p256dh: fake.p256dh, auth: fake.auth },
      }),
      unsubscribe: async () => true,
    };
    // `grantPermissions` no fija `Notification.permission` en Chromium headless: se fija el permiso concedido.
    Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
    PushManager.prototype.getSubscription = async () => subscription as unknown as PushSubscription;
  }, sub);
}

async function activatePushAndWaitForBackend(page: Page) {
  await page.goto('/courier/profile/notifications');
  const activateButton = page.getByRole('button', { name: /Activar avisos/i });
  await expect(activateButton).toBeVisible();
  const responsePromise = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/push/subscriptions' && res.request().method() === 'POST'
  );
  await activateButton.click();
  return responsePromise;
}

async function endpointOwnersVisibleTo(credentials: UserCredentials, endpoint: string) {
  const client = await createAuthenticatedClient(credentials);
  const { data, error } = await client
    .from('push_subscriptions')
    .select('user_id')
    .eq('endpoint', endpoint);
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.user_id);
}

test.describe('T-383: suscripción push en un navegador que quedó suscripto con otra cuenta', () => {
  test('la cuenta A se suscribe, la sesión cambia a B sin logout y B activa los avisos: el endpoint queda de B', async ({
    page,
    loginAsCourier,
    stagingContext,
  }) => {
    const courierA = stagingContext.courierUsers?.[0];
    const courierB = stagingContext.courierUsers?.[1];
    if (!courierA || !courierB) {
      throw new Error('[E2E Error] Se necesitan dos repartidores sembrados');
    }

    const browserSubscription: FakeBrowserSubscription = {
      endpoint: `https://push.e2e.invalid/t383/${randomUUID()}`,
      p256dh: randomBytes(65).toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    };
    await installBrowserPushSubscription(page, browserSubscription);

    // 1. Cuenta A activa los avisos: el endpoint del navegador queda a su nombre.
    await loginAsCourier(0, page);
    // El login termina al salir de /login; se espera que aterrice en el feed antes de navegar a «Configurar».
    await page.waitForURL(/\/courier\/feed/);
    const responseA = await activatePushAndWaitForBackend(page);
    expect(responseA.status()).toBe(200);
    expect(await endpointOwnersVisibleTo(courierA, browserSubscription.endpoint)).toEqual([courierA.id]);
    // Tras el alta confirmada, el prompt vuelve a la pantalla anterior; se espera esa navegación para que no se
    // cruce con el cambio de sesión.
    await page.waitForURL((url) => url.pathname !== '/courier/profile/notifications');

    // 2. La sesión de A se pierde sin logout (no corre el borrado de suscripciones) y entra B en el mismo contexto.
    await page.context().clearCookies();
    await loginAsCourier(1, page);
    await page.waitForURL(/\/courier\/feed/);

    // 3. B activa los avisos con el mismo endpoint del navegador: 200, sin exponer la cuenta anterior.
    const responseB = await activatePushAndWaitForBackend(page);
    expect(responseB.status()).toBe(200);
    const bodyB = await responseB.text();
    expect(JSON.parse(bodyB)).toEqual({ ok: true });
    expect(bodyB).not.toContain(courierA.id);

    // 4. El endpoint pasó a B; A ya no lo ve.
    expect(await endpointOwnersVisibleTo(courierB, browserSubscription.endpoint)).toEqual([courierB.id]);
    expect(await endpointOwnersVisibleTo(courierA, browserSubscription.endpoint)).toEqual([]);
  });
});
