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
    page,
    stagingContext,
    loginAsMerchant,
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

    // 4. Autenticar también en navegador vía loginAsMerchant y suscribir cliente de browser para comparar
    await loginAsMerchant(page);
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);

    const browserDiag = await page.evaluate(
      async ({ reqId }) => {
        const win = window as any;
        const { createClient: createBrowserClient } = await import('@/lib/supabase/browser');
        const browserClient = createBrowserClient();
        win.__diagBrowserReceived = false;
        win.__diagBrowserPayload = null;
        win.__diagBrowserStatus = 'INIT';

        const chan = browserClient.channel(`diag-browser-offers-${reqId}`);
        chan
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'offers',
              filter: `request_id=eq.${reqId}`,
            },
            (payload: unknown) => {
              win.__diagBrowserReceived = true;
              win.__diagBrowserPayload = payload;
            }
          )
          .subscribe((status: string, err: unknown) => {
            win.__diagBrowserStatus = status;
            win.__diagBrowserError = err;
          });

        const start = Date.now();
        while (win.__diagBrowserStatus !== 'SUBSCRIBED' && Date.now() - start < 10_000) {
          await new Promise((r) => setTimeout(r, 200));
        }
        return {
          status: win.__diagBrowserStatus,
          error: win.__diagBrowserError ?? null,
        };
      },
      { reqId: requestId }
    );
    console.log('[Diagnóstico H10 - Browser] Status:', browserDiag);

    // 5. Insertar una oferta real mediante el admin de la fixture
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

    // 6. Esperar hasta 25 s (< 30 s de polling) la llegada del evento a los subscribers
    const maxWait = 25_000;
    const pollStart = Date.now();
    let browserReceived = false;

    while (Date.now() - pollStart < maxWait) {
      if (!browserReceived) {
        browserReceived = await page.evaluate(() => Boolean((window as any).__diagBrowserReceived));
      }
      if (nodeEventReceived && browserReceived) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!browserReceived) {
      browserReceived = await page.evaluate(() => Boolean((window as any).__diagBrowserReceived));
    }

    const nodeLatency = nodeEventReceived ? nodeEventTimestamp - insertStartTime : null;

    const diagnosticReport = {
      SUBSCRIBED_node: nodeSubscribed,
      channel_status_node: nodeChannelStatus,
      channel_error_node: nodeChannelError,
      SUBSCRIBED_browser: browserDiag.status === 'SUBSCRIBED',
      channel_status_browser: browserDiag.status,
      INSERT_real: true,
      evento_recibido_node: nodeEventReceived,
      latencia_ms_node: nodeLatency,
      evento_recibido_browser: browserReceived,
    };

    console.log('=== [DIAGNÓSTICO H10 REPORTE FINAL] ===');
    console.log(JSON.stringify(diagnosticReport, null, 2));
    console.log('========================================');

    await nodeClient.removeChannel(nodeChannel);

    expect(
      nodeEventReceived || browserReceived,
      `[Diagnóstico H10] Evento Postgres Changes INSERT recibido por al menos un subscriber directo (Node: ${nodeEventReceived}, Browser: ${browserReceived})`
    ).toBe(true);
  });
});
