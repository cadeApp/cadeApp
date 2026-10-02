import type { Page } from '@playwright/test';
import { test, expect, trackEntityForCleanup, type StagingSeedContext } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';
import type { LoginPage } from '../pages';
import { randomUUID } from 'node:crypto';

/**
 * Autentica al merchant creado por el seed asignándole una contraseña temporal
 * y realizando el flujo completo de inicio de sesión por UI.
 */
async function authenticateMerchant(
  page: Page,
  admin: ReturnType<typeof createAdminClient>,
  stagingContext: StagingSeedContext,
  loginPage: LoginPage
): Promise<string> {
  const merchantUserId = stagingContext.createdUserIds[0];
  if (!merchantUserId) {
    throw new Error('[E2E Error] No se encontró merchantUserId en stagingContext');
  }

  const temporaryPassword = `Pass_${Date.now()}_Aa1!`;
  const { error: updateError } = await admin.auth.admin.updateUserById(merchantUserId, {
    password: temporaryPassword,
  });
  if (updateError) {
    throw new Error(`[E2E Error] Falló updateUserById para merchant: ${updateError.message}`);
  }

  const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(merchantUserId);
  if (getUserError || !userData?.user?.email) {
    throw new Error(`[E2E Error] Falló getUserById para merchant: ${getUserError?.message}`);
  }

  const email = userData.user.email;
  await loginPage.navigate();
  await waitForNoSkeletons(page);
  await page.waitForLoadState('networkidle');
  await loginPage.login(email, temporaryPassword);
  await page.waitForURL((url) => !url.pathname.includes('/login'));

  return email;
}

test.describe('E2E: Notificaciones y Resiliencia (T-307)', () => {
  test('con el permiso de notificaciones denegado la oferta aparece por tiempo real', async ({
    page,
    loginPage,
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

    // 3. Obtener el request real creado por la fixture
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }

    const admin = createAdminClient();

    // 4. Autenticar al comerciante sembrado vía UI
    await authenticateMerchant(page, admin, stagingContext, loginPage);

    // 5. Crear un repartidor transitorio en auth, profiles y couriers (approved, available, verified)
    const uniqueCourierName = `E2E Courier RT ${stagingContext.testRunId}`;
    const courierEmail = `courier_rt_${Date.now()}@cadeapp-staging.test`;
    const courierPassword = `Pass_${Date.now()}_Aa1!`;

    const { data: courierAuthData, error: courierAuthError } = await admin.auth.admin.createUser({
      email: courierEmail,
      password: courierPassword,
      email_confirm: true,
      user_metadata: {
        role: 'courier',
        display_name: uniqueCourierName,
      },
    });
    if (courierAuthError || !courierAuthData.user) {
      throw new Error(`[E2E Error] Falló createUser courier: ${courierAuthError?.message}`);
    }

    const courierUserId = courierAuthData.user.id;
    trackEntityForCleanup(stagingContext, 'user', courierUserId);

    const { error: profileError } = await admin.from('profiles').upsert({
      id: courierUserId,
      role: 'courier',
      display_name: uniqueCourierName,
      consent_status: 'active',
    });
    if (profileError) {
      throw new Error(`[E2E Error] Falló upsert profiles courier: ${profileError.message}`);
    }

    const { error: courierError } = await admin.from('couriers').upsert({
      profile_id: courierUserId,
      status: 'approved',
      available: true,
      vehicle_type: 'moto',
      license_status: 'verified',
      insurance_status: 'verified',
    });
    if (courierError) {
      throw new Error(`[E2E Error] Falló upsert couriers: ${courierError.message}`);
    }

    // 6. Navegar a /merchant/requests/<requestId> y esperar la pantalla real
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);

    // 7. Comprobar primero que el nombre único del courier no está visible
    await expect(page.getByText(uniqueCourierName)).not.toBeVisible();

    // 8. Insertar una oferta real en offers
    const offerId = randomUUID();
    const { error: offerError } = await admin.from('offers').insert({
      id: offerId,
      request_id: requestId,
      courier_id: courierUserId,
      amount_ars: 2500,
      eta_minutes: 12,
      status: 'pending',
    });
    if (offerError) {
      throw new Error(`[E2E Error] Falló insert offers: ${offerError.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    // 9. Afirmar por UI que aparece el courier y el monto de la oferta sin reload,
    // sin fetch manual y dentro de un timeout menor al polling de 30 s.
    const courierHeading = page.getByRole('heading', { level: 4, name: uniqueCourierName });
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
    loginPage,
    stagingContext,
  }) => {
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }

    const admin = createAdminClient();
    await authenticateMerchant(page, admin, stagingContext, loginPage);

    // Instalar un listener de requests que cuente solo peticiones al endpoint exacto de useRequestOffers
    let count = 0;
    const expectedPath = `/api/live/requests/${requestId}/offers`;
    page.on('request', (req) => {
      try {
        const url = new URL(req.url());
        if (url.pathname === expectedPath) {
          count++;
        }
      } catch {
        // Ignorar URLs no parseables
      }
    });

    // Navegar a la pantalla de detalle de solicitud que monta useRequestOffers
    await page.goto(`/merchant/requests/${requestId}`);
    await waitForNoSkeletons(page);

    // Esperar la petición inicial y registrar el baseline
    await expect.poll(() => count).toBeGreaterThan(0);
    const baseline = count;

    // Simular corte de red
    await page.context().setOffline(true);
    const offlineNotice = page.getByRole('status');
    await expect(offlineNotice).toBeVisible();

    // Reconectar a la red
    await page.context().setOffline(false);

    // Exigir con expect.poll que count > baseline sin click en Reintentar,
    // sin fetch('/api/health'), sin router.refresh() y sin fallback a navigator.onLine
    await expect.poll(() => count, { timeout: 15_000 }).toBeGreaterThan(baseline);
  });
});
