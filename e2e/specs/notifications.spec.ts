import { test, expect, trackEntityForCleanup } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';
import { randomUUID } from 'node:crypto';

test.describe('E2E: Notificaciones y Resiliencia (T-307)', () => {
  test('con el permiso de notificaciones denegado la oferta aparece por tiempo real', async ({
    page,
    loginAsMerchant,
    stagingContext,
  }) => {
    // 1. Configurar permiso de notificaciones denegado antes de cargar la app (T-202 fallback)
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: async () => 'denied',
        },
        configurable: true,
      });
    });

    // 2. Obtener solicitud y repartidor real creados por la fixture
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No se encontró courier en stagingContext');
    }
    const offerMarker = `T307 realtime ${stagingContext.testRunId}`;

    // 3. Instalar control exacto de peticiones y respuesta inicial antes de navegar al detalle
    const expectedPath = `/api/live/requests/${requestId}/offers`;
    let offersRequestCount = 0;
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (request.method() === 'GET' && url.pathname === expectedPath) {
          offersRequestCount += 1;
        }
      } catch {
        // Ignorar URLs no parseables
      }
    });

    const initialOffersResponse = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return (
          response.request().method() === 'GET' &&
          url.pathname === expectedPath &&
          response.ok()
        );
      } catch {
        return false;
      }
    });

    // 4. Iniciar sesión como comercio por UI. Esta navegación aplica el addInitScript.
    await loginAsMerchant(page);

    // 5. Verificar el permiso en un documento donde el init script ya fue ejecutado.
    const initialPermission = await page.evaluate(() => Notification.permission);
    expect(initialPermission).toBe('denied');

    // 6. Navegar al detalle de la solicitud y esperar respuesta inicial completa
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);
    await initialOffersResponse;

    const baseline = offersRequestCount;

    // 7. Verificar que el marcador único de esta oferta todavía no sea visible.
    // No usar el nombre real del courier: #200 afecta esa proyección y es ajeno a T-307.
    await expect(page.getByText(offerMarker)).not.toBeVisible();

    // 8. Insertar una oferta real en offers
    const admin = createAdminClient();
    const offerId = randomUUID();
    const { error: offerError } = await admin.from('offers').insert({
      id: offerId,
      request_id: requestId,
      courier_id: courier.id,
      amount_ars: 2500,
      eta_minutes: 12,
      message: offerMarker,
      status: 'pending',
    });
    if (offerError) {
      throw new Error(`[E2E Error] Falló insert offers: ${offerError.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    // 9. Exigir nueva petición posterior al INSERT y renderizado en UI dentro de 15 s (< 30 s de polling)
    await expect.poll(() => offersRequestCount, { timeout: 15_000 }).toBeGreaterThan(baseline);
    await expect(page.getByText(offerMarker)).toBeVisible({ timeout: 15_000 });
    const formattedAmount = formatArs(2500);
    await expect(page.getByText(formattedAmount)).toBeVisible({ timeout: 15_000 });

    // 10. El permiso de notificaciones debe seguir denegado
    const currentPermission = await page.evaluate(() => Notification.permission);
    expect(currentPermission).toBe('denied');
  });

  test('offline muestra un aviso y conserva los datos del formulario al reconectar', async ({
    page,
    loginPage,
  }) => {
    // 1. Navegar a pantalla con formulario interactivo y esperar hidratación completa
    await loginPage.navigate();
    await waitForNoSkeletons(page);
    await page.waitForLoadState('networkidle');

    // 2. Ingresar datos de prueba en el formulario
    const testEmail = 'comercio.aguilares@cadeapp.test';
    const testPassword = 'PasswordSegura2026!';
    await loginPage.emailInput.fill(testEmail);
    await loginPage.passwordInput.fill(testPassword);

    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);

    // 3. Simular caída de red en el navegador
    await page.context().setOffline(true);

    // 4. Verificar que se muestre el aviso de sin conexión (OfflineBanner y OfflineFloatingCard)
    const offlineNotice = page.getByRole('status');
    await expect(offlineNotice).toBeVisible();
    await expect(offlineNotice).toContainText(/sin conexión/i);

    const reconnectionRegion = page.getByRole('region', { name: /aviso de reconexión/i });
    await expect(reconnectionRegion).toBeVisible();

    // 5. Verificar que durante el corte de red el formulario conserve los datos intactos
    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);

    // 6. Reconectar a la red
    await page.context().setOffline(false);

    // 7. Verificar que el aviso offline desaparece al reconectar y los valores siguen intactos
    await expect(offlineNotice).not.toBeVisible();
    await expect(loginPage.emailInput).toHaveValue(testEmail);
    await expect(loginPage.passwordInput).toHaveValue(testPassword);
  });

  test('reconectar a la red dispara refetch automático de la query activa de ofertas', async ({
    page,
    loginAsMerchant,
    stagingContext,
  }) => {
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }

    // 1. Autenticar como comercio
    await loginAsMerchant(page);

    // 2. Instalar listener exacto del endpoint y esperar respuesta 2xx inicial antes de fijar baseline
    let count = 0;
    const expectedPath = `/api/live/requests/${requestId}/offers`;
    page.on('request', (request) => {
      try {
        const url = new URL(request.url());
        if (request.method() === 'GET' && url.pathname === expectedPath) {
          count += 1;
        }
      } catch {
        // Ignorar URLs no parseables
      }
    });

    const initialOffersResponse = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return (
          response.request().method() === 'GET' &&
          url.pathname === expectedPath &&
          response.ok()
        );
      } catch {
        return false;
      }
    });

    // 3. Navegar a la pantalla de detalle de solicitud que monta useRequestOffers
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);
    await initialOffersResponse;

    const baseline = count;

    // 4. Simular corte de red
    await page.context().setOffline(true);
    const offlineNotice = page.getByRole('status');
    await expect(offlineNotice).toBeVisible();

    // 5. Reconectar a la red
    await page.context().setOffline(false);

    // 6. Exigir con expect.poll que count > baseline sin click en Reintentar,
    // sin fetch('/api/health'), sin router.refresh() y sin fallback a navigator.onLine
    await expect.poll(() => count, { timeout: 15_000 }).toBeGreaterThan(baseline);
  });

  test('diagnóstico H10: subscriber autenticado directo recibe INSERT de oferta por Postgres Changes', async ({
    stagingContext,
  }) => {
    test.setTimeout(45_000);

    // 1. Obtener solicitud y credenciales de comercio y repartidor
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[Diagnóstico H10] No se encontró requestId en stagingContext');
    }
    const merchant = stagingContext.merchantUser;
    if (!merchant) {
      throw new Error('[Diagnóstico H10] No se encontró merchantUser en stagingContext');
    }
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[Diagnóstico H10] No se encontró courier en stagingContext');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('[Diagnóstico H10] Faltan variables públicas de Supabase en el entorno');
    }

    // 2. Autenticar cliente directo Supabase en Node como el merchant
    const { createClient } = await import('@supabase/supabase-js');
    const nodeClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await nodeClient.auth.signInWithPassword({
      email: merchant.email,
      password: merchant.password,
    });
    if (authError || !authData.session) {
      throw new Error(`[Diagnóstico H10] Error autenticando merchant en Node: ${authError?.message}`);
    }
    await nodeClient.realtime.setAuth(authData.session.access_token);

    // 3. Suscribirse a { event: 'INSERT', schema: 'public', table: 'offers', filter: request_id=eq.${requestId} }
    let nodeSubscribed = false;
    let nodeChannelStatus = 'INIT';
    let nodeChannelError: unknown = null;
    let nodeEventReceived = false;
    let nodeEventTimestamp = 0;
    let nodePayload: unknown = null;

    const nodeChannel = nodeClient.channel(`diag-node-offers-${requestId}`);

    const nodeSubscribePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout esperando SUBSCRIBED en Node (status: ${nodeChannelStatus})`));
      }, 15_000);

      nodeChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'offers',
            filter: `request_id=eq.${requestId}`,
          },
          (payload) => {
            nodeEventReceived = true;
            nodeEventTimestamp = Date.now();
            nodePayload = payload;
            console.log('[Diagnóstico H10 - Node] Evento recibido:', JSON.stringify(payload));
          }
        )
        .subscribe((status, err) => {
          nodeChannelStatus = status;
          nodeChannelError = err;
          console.log(`[Diagnóstico H10 - Node] Channel status: ${status}`, err ? `Error: ${JSON.stringify(err)}` : '');
          if (status === 'SUBSCRIBED') {
            nodeSubscribed = true;
            clearTimeout(timer);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error(`Node channel falló: ${status} error: ${JSON.stringify(err)}`));
          }
        });
    });

    await nodeSubscribePromise;

    // 4. Insertar una oferta real mediante el admin de la fixture
    const admin = createAdminClient();
    const offerId = randomUUID();
    const offerMarker = `T307 diag ${stagingContext.testRunId}`;
    const insertStartTime = Date.now();

    const { error: offerError } = await admin.from('offers').insert({
      id: offerId,
      request_id: requestId,
      courier_id: courier.id,
      amount_ars: 2500,
      eta_minutes: 12,
      message: offerMarker,
      status: 'pending',
    });
    if (offerError) {
      throw new Error(`[Diagnóstico H10] Error insertando oferta: ${offerError.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);
    console.log(`[Diagnóstico H10] Oferta insertada correctamente (id: ${offerId})`);

    // 5. Esperar hasta 25 s la llegada del evento al subscriber
    const maxWait = 25_000;
    const pollStart = Date.now();

    while (Date.now() - pollStart < maxWait && !nodeEventReceived) {
      await new Promise((r) => setTimeout(r, 500));
    }

    const nodeLatency = nodeEventReceived ? nodeEventTimestamp - insertStartTime : null;

    const diagnosticReport = {
      SUBSCRIBED: nodeSubscribed,
      channel_status: nodeChannelStatus,
      channel_error: nodeChannelError,
      INSERT_real: true,
      evento_recibido: nodeEventReceived,
      latencia_ms: nodeLatency,
      payload: nodePayload,
    };

    console.log('========================================');
    console.log('=== [DIAGNÓSTICO H10 REPORTE FINAL] ===');
    console.log(JSON.stringify(diagnosticReport, null, 2));
    console.log('========================================');

    await nodeClient.removeChannel(nodeChannel);

    expect(
      nodeEventReceived,
      `[Diagnóstico H10] Evento Postgres Changes INSERT recibido por el subscriber directo autenticado: ${nodeEventReceived}`
    ).toBe(true);
  });
});

/**
 * T-382: errores claros al activar avisos y estado real en «Configurar».
 * La API de push del navegador se simula en el contexto de prueba con `addInitScript` (sin ramas de test en la app):
 * el permiso queda concedido y `PushManager` devuelve una suscripción guardada en localStorage, como haría el
 * navegador. El alta (`POST /api/push/subscriptions`) y la consulta de estado son reales contra Supabase Develop.
 */
test.describe('T-382 — avisos push en «Configurar»', () => {
  type FakePushMode = 'ok' | 'fail';

  async function installFakePush(page: import('@playwright/test').Page, endpoint: string, mode: FakePushMode) {
    await page.addInitScript(
      ({ endpoint: fakeEndpoint, mode: fakeMode }) => {
        const storageKey = '__t382_fake_push_endpoint';
        const fakeSubscription = (value: string) => ({
          endpoint: value,
          toJSON: () => ({ endpoint: value, keys: { p256dh: 'BT382FakeP256dhKey', auth: 'T382FakeAuth' } }),
          unsubscribe: async () => {
            localStorage.removeItem(storageKey);
            return true;
          },
        });
        Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
        PushManager.prototype.getSubscription = async function getSubscription() {
          const stored = localStorage.getItem(storageKey);
          return (stored ? fakeSubscription(stored) : null) as unknown as PushSubscription;
        };
        PushManager.prototype.subscribe = async function subscribe() {
          if (fakeMode === 'fail') {
            throw new DOMException('Registration failed - push service error', 'AbortError');
          }
          localStorage.setItem(storageKey, fakeEndpoint);
          return fakeSubscription(fakeEndpoint) as unknown as PushSubscription;
        };
      },
      { endpoint, mode }
    );
  }

  /** El login termina al salir de /login; se espera a que aterrice en el feed antes de navegar a «Configurar». */
  async function loginCourierAndOpenSettings(
    page: import('@playwright/test').Page,
    login: (index: number, page: import('@playwright/test').Page) => Promise<unknown>,
    index: number
  ) {
    await login(index, page);
    await page.waitForURL(/\/courier\/feed/);
    await page.goto('/courier/profile/notifications');
    await expect(page.getByRole('heading', { name: '¿Te avisamos al instante?' })).toBeVisible();
  }

  function fakeEndpointFor(runId: string) {
    return `https://fcm.googleapis.com/fcm/send/t382-${runId.replace(/[^a-z0-9]/gi, '')}`;
  }

  async function deleteSubscription(endpoint: string) {
    const { error } = await createAdminClient().from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw new Error(`[E2E Cleanup Error] push_subscriptions: ${error.message}`);
  }

  test('el perfil ya no tiene el switch falso y conserva «Notificaciones y avisos»', async ({ page, loginAsCourier }) => {
    await loginAsCourier(0, page);
    await page.goto('/courier/profile');
    await waitForNoSkeletons(page);

    await expect(page.getByRole('link', { name: /Notificaciones y avisos/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Alternar notificaciones' })).toHaveCount(0);
  });

  test('si el navegador no tiene servicio push, «Activar avisos» lo explica en vez de culpar al servidor', async ({
    page,
    loginAsCourier,
    stagingContext,
  }) => {
    const endpoint = fakeEndpointFor(stagingContext.testRunId);
    await installFakePush(page, endpoint, 'fail');
    let subscriptionPosts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/push/subscriptions') {
        subscriptionPosts += 1;
      }
    });

    await loginCourierAndOpenSettings(page, loginAsCourier, 0);
    const activate = page.getByRole('button', { name: /^Activar avisos$/i });
    await expect(activate).toBeVisible();
    await activate.click();

    // Next agrega su propio `alert` (anunciador de rutas): se filtra por el texto del mensaje.
    const alert = page.getByRole('alert').filter({ hasText: 'Usar los servicios de Google para mensajes push' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Chrome');
    await expect(page.getByText(/No se pudo confirmar la suscripción con el servidor/i)).toHaveCount(0);
    await expect(page.getByText(/Avisos activados/i)).toHaveCount(0);
    expect(subscriptionPosts).toBe(0);
  });

  test('la cuenta A ve sus avisos activos; la cuenta B en el mismo navegador no; un error de red no muestra «activados»', async ({
    page,
    loginAsCourier,
    stagingContext,
  }) => {
    const endpoint = fakeEndpointFor(stagingContext.testRunId);
    await installFakePush(page, endpoint, 'ok');

    try {
      // 1. Cuenta A activa los avisos con el gesto del usuario: alta real en el servidor.
      await loginCourierAndOpenSettings(page, loginAsCourier, 0);
      await page.getByRole('button', { name: /^Activar avisos$/i }).click();
      await expect(page.getByText(/¡Avisos activados con éxito!/i)).toBeVisible();
      // Tras el éxito, el prompt vuelve a la pantalla anterior (el feed): se espera antes de navegar.
      await page.waitForURL(/\/courier\/feed/);

      // 2. Al volver a «Configurar», el estado viene del servidor para la cuenta A.
      await page.goto('/courier/profile/notifications');
      await expect(page.getByText('Avisos activados en este navegador')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Desactivar avisos$/i })).toBeVisible();

      // 3. Falla de red en la consulta de estado: nunca «activados», aunque el navegador y el storage digan que sí.
      await page.route('**/api/push/subscriptions/status', (route) => route.abort('internetdisconnected'));
      await page.goto('/courier/profile/notifications');
      await expect(page.getByText(/No se pudo comprobar el estado/)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Reintentar$/i })).toBeVisible();
      await expect(page.getByText('Avisos activados en este navegador')).toHaveCount(0);
      await page.unroute('**/api/push/subscriptions/status');

      // 4. La sesión cambia a la cuenta B sin logout: mismo navegador, misma suscripción y mismo storage.
      expect(await page.evaluate(() => localStorage.getItem('cadeapp_push_enabled'))).toBe('true');
      await page.context().clearCookies();
      await loginAsCourier(1, page);
      await page.waitForURL(/\/courier\/feed/);
      const statusResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/push/subscriptions/status'
      );
      await page.goto('/courier/profile/notifications');
      expect(await (await statusResponse).json()).toEqual({ active: false });
      await expect(page.getByRole('button', { name: /^Activar avisos$/i })).toBeVisible();
      await expect(page.getByText(/Avisos activados/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Desactivar avisos$/i })).toHaveCount(0);
    } finally {
      await deleteSubscription(endpoint);
    }
  });
  test('PR459-H05: la baja pendiente de A no la ve ni la consume B en el mismo navegador; A la completa al volver', async ({
    page,
    loginAsCourier,
    stagingContext,
  }) => {
    const courierA = stagingContext.courierUsers?.[0];
    if (!courierA) throw new Error('[E2E Error] Se necesita el repartidor A sembrado');
    const endpoint = fakeEndpointFor(`${stagingContext.testRunId}h05`);
    await installFakePush(page, endpoint, 'ok');
    const admin = createAdminClient();
    async function ownersOf(target: string) {
      const { data, error } = await admin.from('push_subscriptions').select('user_id').eq('endpoint', target);
      if (error) throw new Error(`[E2E Inspect Error] push_subscriptions: ${error.message}`);
      return (data ?? []).map((row) => row.user_id);
    }

    try {
      // 1. A activa los avisos (alta real) y después los desactiva con el DELETE caído: queda la baja pendiente.
      await loginCourierAndOpenSettings(page, loginAsCourier, 0);
      await page.getByRole('button', { name: /^Activar avisos$/i }).click();
      await expect(page.getByText(/¡Avisos activados con éxito!/i)).toBeVisible();
      await page.waitForURL(/\/courier\/feed/);
      await page.goto('/courier/profile/notifications');
      await page.route('**/api/push/subscriptions', (route) =>
        route.request().method() === 'DELETE' ? route.abort('internetdisconnected') : route.continue()
      );
      await page.getByRole('button', { name: /^Desactivar avisos$/i }).click();
      await expect(page.getByRole('button', { name: 'Reintentar baja' })).toBeVisible();
      expect(await ownersOf(endpoint)).toEqual([courierA.id]);

      // 2. La sesión cambia a B sin logout ni limpiar el storage: B no ve la baja de A ni avisos activos.
      await page.context().clearCookies();
      await loginCourierAndOpenSettings(page, loginAsCourier, 1);
      await expect(page.getByRole('button', { name: /^Activar avisos$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reintentar baja' })).toHaveCount(0);
      await expect(page.getByText(/Avisos activados/i)).toHaveCount(0);
      expect(await ownersOf(endpoint)).toEqual([courierA.id]);

      // 3. Vuelve A: sigue su baja pendiente y la completa contra el servidor real.
      await page.unroute('**/api/push/subscriptions');
      await page.context().clearCookies();
      await loginCourierAndOpenSettings(page, loginAsCourier, 0);
      await page.getByRole('button', { name: 'Reintentar baja' }).click();
      await expect(page.getByText('Avisos desactivados en este navegador.')).toBeVisible();
      expect(await ownersOf(endpoint)).toEqual([]);
    } finally {
      await deleteSubscription(endpoint);
    }
  });
});
