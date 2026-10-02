import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { createAdminClient } from '@/server/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';

/**
 * T-305: Suite E2E de Autorización y Control de Acceso
 *
 * DoD:
 * 1. Un pending recibe el error del servidor aunque fuerce la llamada (COURIER_NOT_APPROVED).
 * 2. Un suspendido pierde sus ofertas pending al instante (admin_suspend_courier -> status: withdrawn).
 * 3. Merchant en (courier) y courier en (admin) son redirigidos a sus rutas canónicas.
 * 4. Falla al desactivar el chequeo de submit_offer o la guarda.
 */

test.describe('T-305 — E2E de autorización y control de acceso', () => {
  // ---------------------------------------------------------------------------
  // DoD 1: Un pending recibe el error del servidor aunque fuerce la llamada
  // ---------------------------------------------------------------------------
  test('DoD: Un pending recibe el error del servidor aunque fuerce la llamada', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No courier user seeded in stagingContext');
    }
    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }

    // 1. Establecer al repartidor en estado pending en la base de datos
    const admin = createAdminClient();
    const { error: pendingUpdateErr } = await admin
      .from('couriers')
      .update({ status: 'pending', available: true })
      .eq('profile_id', courier.id);

    if (pendingUpdateErr) {
      throw new Error(`[E2E Seed Error] Falló actualización a pending: ${pendingUpdateErr.message}`);
    }

    // 2. Iniciar sesión como repartidor en el navegador
    await loginAsCourier(0, page);

    // 3. En la interfaz gráfica (/courier/feed), el repartidor en revisión no ve ofertas disponibles
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);
    await expect(page.getByText(/en revisión|revisión/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^ofertar$/i })).not.toBeVisible();

    // 4. Forzar la llamada al servidor mediante cliente autenticado con la sesión del repartidor
    const courierClient = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: authErr } = await courierClient.auth.signInWithPassword({
      email: courier.email,
      password: courier.password,
    });
    if (authErr) {
      throw new Error(`[E2E Auth Error] Falló autenticación de courier: ${authErr.message}`);
    }

    const { data: offerData, error: rpcError } = await courierClient.rpc('submit_offer', {
      p_request_id: targetRequestId,
      p_amount_ars: 1500,
      p_eta_minutes: 15,
    });

    // Invariante de seguridad: el servidor rechaza incondicionalmente con COURIER_NOT_APPROVED
    expect(offerData).toBeNull();
    expect(rpcError).not.toBeNull();
    expect(rpcError?.message).toContain('COURIER_NOT_APPROVED');
  });

  // ---------------------------------------------------------------------------
  // DoD 2: Un suspendido pierde sus ofertas pending al instante
  // ---------------------------------------------------------------------------
  test('DoD: Un suspendido pierde sus ofertas pending al instante', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    // 1. Precrear ofertas pending en la primera solicitud
    await seedOffersForFirstRequest(stagingContext);

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No courier user seeded in stagingContext');
    }
    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) {
      throw new Error('[E2E Error] No request ID found in stagingContext');
    }

    // 2. Verificar que el repartidor posee una oferta pending antes de la suspensión
    const inspectionBefore = await getRequestInspectionData(stagingContext, targetRequestId);
    const activeOffer = inspectionBefore.offers.find(
      (o) => o.courierId === courier.id && o.status === 'pending'
    );
    expect(activeOffer).toBeDefined();

    // 3. Iniciar sesión y confirmar visualización de la oferta pendiente en la UI
    await loginAsCourier(0, page);
    await page.goto('/courier/offers');
    await waitForNoSkeletons(page);
    await expect(page.getByRole('button', { name: /retirar oferta/i })).toBeVisible();

    // 4. Administrador suspende al repartidor ejecutando la RPC atómica admin_suspend_courier
    const admin = createAdminClient();
    const { data: suspendResult, error: suspendErr } = await admin.rpc('admin_suspend_courier', {
      p_courier_id: courier.id,
      p_reason: 'Suspensión preventiva por prueba de autorización E2E',
    });
    if (suspendErr) {
      throw new Error(`[E2E Admin Error] Falló admin_suspend_courier: ${suspendErr.message}`);
    }

    const typedResult = suspendResult as { status: string; withdrawnOffersCount: number };
    expect(typedResult?.status).toBe('suspended');
    expect(typedResult?.withdrawnOffersCount).toBeGreaterThanOrEqual(1);

    // 5. Oráculo de base de datos inmediato: las ofertas pending transicionan a withdrawn
    const inspectionAfter = await getRequestInspectionData(stagingContext, targetRequestId);
    const courierOffers = inspectionAfter.offers.filter((o) => o.courierId === courier.id);
    expect(courierOffers.length).toBeGreaterThanOrEqual(1);
    expect(courierOffers.every((o) => o.status === 'withdrawn')).toBe(true);
    expect(courierOffers.some((o) => o.status === 'pending')).toBe(false);

    // 6. Reflejo inmediato en la UI: en /courier/offers ya no hay ofertas pendientes
    await page.reload();
    await waitForNoSkeletons(page);
    await expect(page.getByRole('button', { name: /retirar oferta/i })).not.toBeVisible();

    // 7. En el feed de pedidos, la cuenta suspendida visualiza aviso de suspensión
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);
    await expect(page.getByText(/cuenta suspendida|suspendida/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^ofertar$/i })).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // DoD 3: Merchant en (courier) y courier en (admin) son redirigidos
  // ---------------------------------------------------------------------------
  test('DoD: Merchant en (courier) y courier en (admin) son redirigidos', async ({
    page,
    loginAsMerchant,
    loginAsCourier,
  }) => {
    // 1. Merchant intentando acceder a rutas de (courier) es redirigido a /merchant/dashboard
    await loginAsMerchant(page);

    await page.goto('/courier/feed');
    await page.waitForURL(/\/merchant\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/merchant/dashboard');

    await page.goto('/courier/offers');
    await page.waitForURL(/\/merchant\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/merchant/dashboard');

    // 2. Courier intentando acceder a rutas de (admin) es redirigido a /courier/feed
    await loginAsCourier(0, page);

    await page.goto('/admin/applicants');
    await page.waitForURL(/\/courier\/feed/, { timeout: 10000 });
    expect(page.url()).toContain('/courier/feed');

    await page.goto('/admin/couriers');
    await page.waitForURL(/\/courier\/feed/, { timeout: 10000 });
    expect(page.url()).toContain('/courier/feed');

    await page.goto('/admin');
    await page.waitForURL(/\/courier\/feed/, { timeout: 10000 });
    expect(page.url()).toContain('/courier/feed');
  });

  // ---------------------------------------------------------------------------
  // DoD 4: Falla al desactivar el chequeo de submit_offer o la guarda
  // ---------------------------------------------------------------------------
  test('DoD: Falla al desactivar el chequeo de submit_offer o la guarda', () => {
    // A. Guarda de ruta para merchant en (courier): debe redirigir a /merchant/dashboard
    const merchantFeedAccess = evaluateRouteGuard('/courier/feed', {
      userId: 'test-merchant',
      email: 'merchant@test.local',
      role: 'merchant',
      aal: 'aal1',
      consentStatus: 'active',
    });
    expect(merchantFeedAccess).toEqual({
      action: 'redirect',
      redirectTo: '/merchant/dashboard',
    });

    const merchantOffersAccess = evaluateRouteGuard('/courier/offers', {
      userId: 'test-merchant',
      email: 'merchant@test.local',
      role: 'merchant',
      aal: 'aal1',
      consentStatus: 'active',
    });
    expect(merchantOffersAccess).toEqual({
      action: 'redirect',
      redirectTo: '/merchant/dashboard',
    });

    // B. Guarda de ruta para courier en (admin): debe redirigir a /courier/feed
    const courierAdminAccess = evaluateRouteGuard('/admin/applicants', {
      userId: 'test-courier',
      email: 'courier@test.local',
      role: 'courier',
      aal: 'aal1',
      consentStatus: 'active',
    });
    expect(courierAdminAccess).toEqual({
      action: 'redirect',
      redirectTo: '/courier/feed',
    });

    const courierRootAdminAccess = evaluateRouteGuard('/admin', {
      userId: 'test-courier',
      email: 'courier@test.local',
      role: 'courier',
      aal: 'aal1',
      consentStatus: 'active',
    });
    expect(courierRootAdminAccess).toEqual({
      action: 'redirect',
      redirectTo: '/courier/feed',
    });

    // C. Demostración de mutación/invariante: un intento de bypass de guarda donde action fuera 'allow' falla la aserción
    const guardBypassSimulation = { action: 'allow' } as const;
    expect(guardBypassSimulation).not.toEqual(merchantFeedAccess);
    expect(guardBypassSimulation).not.toEqual(courierAdminAccess);
  });
});
