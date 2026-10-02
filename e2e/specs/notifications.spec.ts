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

    // 2. Verificar que el permiso a nivel de navegador esté denegado
    const initialPermission = await page.evaluate(() => Notification.permission);
    expect(initialPermission).toBe('denied');

    // 3. Obtener solicitud y repartidor real creados por la fixture
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No se encontró courier en stagingContext');
    }
    const courierName = courier.displayName ?? 'E2E Courier Doc2';

    // 4. Instalar control exacto de peticiones y respuesta inicial antes de navegar al detalle
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

    // 5. Iniciar sesión como comercio por UI
    await loginAsMerchant(page);

    // 6. Navegar al detalle de la solicitud y esperar respuesta inicial completa
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);
    await initialOffersResponse;

    const baseline = offersRequestCount;

    // 7. Verificar que el heading del repartidor todavía no sea visible
    const courierHeading = page.getByRole('heading', { level: 4, name: courierName });
    await expect(courierHeading).not.toBeVisible();

    // 8. Insertar una oferta real en offers
    const admin = createAdminClient();
    const offerId = randomUUID();
    const { error: offerError } = await admin.from('offers').insert({
      id: offerId,
      request_id: requestId,
      courier_id: courier.id,
      amount_ars: 2500,
      eta_minutes: 12,
      status: 'pending',
    });
    if (offerError) {
      throw new Error(`[E2E Error] Falló insert offers: ${offerError.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    // 9. Exigir nueva petición posterior al INSERT y renderizado en UI dentro de 15 s (< 30 s de polling)
    await expect.poll(() => offersRequestCount, { timeout: 15_000 }).toBeGreaterThan(baseline);
    await expect(courierHeading).toBeVisible({ timeout: 15_000 });
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
});
