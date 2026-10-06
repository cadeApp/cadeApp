import {
  test,
  expect,
  getRequestInspectionData,
  trackEntityForCleanup,
  seedAdminUser,
  createAuthenticatedClient,
  elevateAdminToAal2,
  generateTotp,
  seedDeliveryRequestInState,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { LoginPage } from '../pages';
import { createAdminClient } from '@/server/supabase/admin';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { canReportIncident } from '@/features/incidents/report-window';

/**
 * T-308: Suite E2E de Incidentes y Suspensión Cautelar
 *
 * DoD:
 * 1. El reporte llega a la bandeja de administración (/admin/incidents).
 * 2. El suspendido no oferta (en UI del feed ni por RPC submit_offer).
 * 3. El suspendido no puede ser aceptado por un comercio (accept_offer falla con COURIER_SUSPENDED).
 * 4. Falla si accept_offer no revalida el estado del repartidor.
 */
test.describe('T-308 — E2E de incidentes y suspensión cautelar', () => {
  // ---------------------------------------------------------------------------
  // DoD 1: El reporte llega a la bandeja
  // ---------------------------------------------------------------------------
  test('DoD 1: El reporte llega a la bandeja de administración', async ({
    page,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] No courier user in stagingContext');

    // 1. Configurar solicitud emparejada (matched trip) con el helper canónico (PR224-H02)
    const matched = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const targetRequestId = matched.requestId;

    // 2. Comercio inicia sesión y navega a la vista del viaje
    await loginAsMerchant(page);
    await page.goto(`/trips/${targetRequestId}`);
    await waitForNoSkeletons(page);

    // 3. Abrir modal de reporte de incidente desde el botón accesible
    const reportButton = page.getByRole('button', { name: /reportar un problema/i });
    await expect(reportButton).toBeVisible();
    await reportButton.click();

    // 4. Completar formulario de reporte
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const kindRadio = page.getByRole('radio', { name: /otro/i });
    await expect(kindRadio).toBeVisible();
    await kindRadio.click();

    const descInput = page.getByLabel(/¿qué pasó\?/i);
    const safeRunMarker = stagingContext.testRunId.replace(/[^a-z]/gi, '');
    const incidentDescription = `Incidente E2E ${safeRunMarker}: El repartidor tuvo un problema con el cobro acordado.`;
    await descInput.fill(incidentDescription);

    const submitBtn = page.getByRole('button', { name: /enviar reporte/i });
    await submitBtn.click();

    // 5. Confirmación en pantalla
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/recibimos tu reporte/i);

    // 6. Administrador E2E con AAL2 verificado vía helper canónico (PR224-H01)
    const adminCredentials = await seedAdminUser(stagingContext);
    const adminClient = await createAuthenticatedClient(adminCredentials);
    const { data: enrollData, error: enrollErr } = await adminClient.auth.mfa.enroll({
      factorType: 'totp',
    });
    if (enrollErr || !enrollData?.totp?.secret) {
      throw new Error(`[E2E MFA Error] Error al enrolar TOTP: ${enrollErr?.message}`);
    }
    const totpSecret = enrollData.totp.secret;
    const verifyCode = generateTotp(totpSecret);
    const { error: verifyErr } = await adminClient.auth.mfa.challengeAndVerify({
      factorId: enrollData.id,
      code: verifyCode,
    });
    if (verifyErr) {
      throw new Error(`[E2E MFA Error] Error al verificar TOTP inicial: ${verifyErr.message}`);
    }

    // 7. Navegación manual en browser sin LoginPage.login (PR224-H03)
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear()).catch(() => undefined);
    const adminPage = await page.context().newPage();
    const loginPage = new LoginPage(adminPage);
    await loginPage.navigate();
    await waitForFormHydration(loginPage.submitButton);
    await loginPage.emailInput.fill(adminCredentials.email);
    await loginPage.passwordInput.fill(adminCredentials.password);
    await loginPage.submitButton.click();
    await adminPage.waitForURL(/\/login\/mfa/);

    const currentTotp = generateTotp(totpSecret);
    await adminPage.getByLabel(/código de seguridad/i).fill(currentTotp);
    await adminPage.getByRole('button', { name: /verificar/i }).click();
    await adminPage.waitForURL(/\/admin/);

    // Navegar a la bandeja de incidentes
    await adminPage.goto('/admin/incidents');
    await waitForNoSkeletons(adminPage);

    // Localizar tarjeta del incidente y comprobar el tipo exacto (H07)
    const incidentCard = adminPage
      .getByRole('listitem')
      .filter({ hasText: incidentDescription });
    await expect(incidentCard).toBeVisible();
    await expect(
      incidentCard.getByText(/^problema con el cobro$/i)
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // DoD 2: El suspendido no oferta
  // ---------------------------------------------------------------------------
  test('DoD 2: El suspendido no oferta en el feed ni por RPC', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] No courier user in stagingContext');

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) throw new Error('[E2E Error] No request ID in stagingContext');

    // 1. Administrador suspende cautelarmente al repartidor vía sesión AAL2 canónica (PR224-H01)
    const adminCredentials = await seedAdminUser(stagingContext);
    const adminClient = await createAuthenticatedClient(adminCredentials);
    await elevateAdminToAal2(adminClient, adminCredentials);
    const { error: suspendErr } = await adminClient.rpc('admin_suspend_courier', {
      p_courier_id: courier.id,
      p_reason: `Suspensión preventiva E2E ${stagingContext.testRunId}`,
    });

    if (suspendErr) {
      throw new Error(`[E2E Admin Error] Falló admin_suspend_courier: ${suspendErr.message}`);
    }

    // 2. Repartidor suspendido inicia sesión y accede al feed
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    // En la UI ve el aviso de cuenta suspendida y no ve botones para ofertar
    await expect(
      page.getByRole('heading', { name: /cuenta suspendida temporalmente/i })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^ofertar$/i })).not.toBeVisible();

    // 3. Forzar invocación directa a submit_offer con cliente autenticado
    const courierClient = await createAuthenticatedClient(courier);
    const { data: offerData, error: submitErr } = await courierClient.rpc('submit_offer', {
      p_request_id: targetRequestId,
      p_amount_ars: 1500,
      p_eta_minutes: 15,
    });

    expect(offerData).toBeNull();
    expect(submitErr).not.toBeNull();
    expect(submitErr?.message).toContain('COURIER_SUSPENDED');
  });

  // ---------------------------------------------------------------------------
  // DoD 3: Ni puede ser aceptado
  // ---------------------------------------------------------------------------
  test('DoD 3: El repartidor suspendido no puede ser aceptado por un comercio', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] No courier user in stagingContext');

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) throw new Error('[E2E Error] No request ID in stagingContext');

    const admin = createAdminClient();

    // 1. Crear oferta en estado pending para el repartidor mientras está approved
    const { data: offerData, error: offerErr } = await admin
      .from('offers')
      .insert({
        request_id: targetRequestId,
        courier_id: courier.id,
        amount_ars: 1600,
        eta_minutes: 25,
        status: 'pending',
      })
      .select('id')
      .single();

    if (offerErr || !offerData) {
      throw new Error(`[E2E Setup Error] Falló creación de oferta: ${offerErr?.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerData.id);

    // 2. Administrador suspende al repartidor con helpers canónicos (PR224-H01)
    const adminCredentials = await seedAdminUser(stagingContext);
    const adminClient = await createAuthenticatedClient(adminCredentials);
    await elevateAdminToAal2(adminClient, adminCredentials);
    const { error: suspendErr } = await adminClient.rpc('admin_suspend_courier', {
      p_courier_id: courier.id,
      p_reason: `Suspensión para prueba de no aceptación E2E ${stagingContext.testRunId}`,
    });
    if (suspendErr) {
      throw new Error(`[E2E Admin Error] Falló suspensión: ${suspendErr.message}`);
    }

    // 3. Forzar que la oferta permanezca en pending para probar la revalidación estricta de accept_offer
    await admin.from('offers').update({ status: 'pending' }).eq('id', offerData.id);

    // 4. Comercio autenticado intenta aceptar la oferta
    const merchantClient = await createAuthenticatedClient(merchant);
    const { data: acceptData, error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerData.id,
    });

    // Invariante de seguridad: accept_offer rechaza incondicionalmente
    expect(acceptData).toBeNull();
    expect(acceptErr).not.toBeNull();
    expect(acceptErr?.message).toContain('COURIER_SUSPENDED');

    // Comprobar que en la base de datos la solicitud no transicionó a matched
    const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
    expect(inspection.requestStatus).toBe('published');
    const checkedOffer = inspection.offers.find((o) => o.id === offerData.id);
    expect(checkedOffer?.status).not.toBe('accepted');
  });

  // ---------------------------------------------------------------------------
  // DoD 4: Falla si accept_offer no revalida
  // ---------------------------------------------------------------------------
  test('DoD 4: Falla si accept_offer no revalida el estado del repartidor', async ({
    stagingContext,
  }) => {
    // 1. Guardas de ruta de dominio: acceso a la bandeja de incidentes restringido exclusivamente a admin
    const courierSession = {
      userId: 'test-courier-4',
      email: 'courier4@test.local',
      role: 'courier' as const,
      aal: 'aal1' as const,
      consentStatus: 'active' as const,
    };
    const merchantSession = {
      userId: 'test-merchant-4',
      email: 'merchant4@test.local',
      role: 'merchant' as const,
      aal: 'aal1' as const,
      consentStatus: 'active' as const,
    };

    expect(evaluateRouteGuard('/admin/incidents', courierSession)).toEqual({
      action: 'redirect',
      redirectTo: '/courier/feed',
    });
    expect(evaluateRouteGuard('/admin/incidents', merchantSession)).toEqual({
      action: 'redirect',
      redirectTo: '/merchant/dashboard',
    });

    // 2. Invariante canReportIncident: admin nunca puede reportar desde el viaje (D05-A)
    expect(
      canReportIncident(
        { actorRole: 'admin', tripStatus: 'matched', deliveredAt: null },
        Date.now()
      )
    ).toBe(false);

    // 3. Oráculo de base de datos: verificación de la revalidación activa de accept_offer
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] No courier user in stagingContext');

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) throw new Error('[E2E Error] No request ID in stagingContext');

    const admin = createAdminClient();

    // Crear oferta pending y suspender al repartidor
    const { data: offerData, error: offerErr } = await admin
      .from('offers')
      .insert({
        request_id: targetRequestId,
        courier_id: courier.id,
        amount_ars: 1750,
        eta_minutes: 30,
        status: 'pending',
      })
      .select('id')
      .single();

    if (offerErr || !offerData) {
      throw new Error(
        `[E2E Setup Error] Falló creación de oferta para DoD 4: ${offerErr?.message}`
      );
    }
    trackEntityForCleanup(stagingContext, 'offer', offerData.id);

    // Forzar estado suspended directamente en el perfil del repartidor
    const { error: suspendCourierErr } = await admin
      .from('couriers')
      .update({ status: 'suspended', available: false })
      .eq('profile_id', courier.id);

    if (suspendCourierErr) {
      throw new Error(
        `[E2E Setup Error] Falló seteo de status suspended: ${suspendCourierErr.message}`
      );
    }

    // Asegurar que la oferta permanece en pending (para simular concurrencia / bypass)
    await admin.from('offers').update({ status: 'pending' }).eq('id', offerData.id);

    // Invocación a accept_offer debe fallar en el paso 8 de elegibilidad
    const merchantClient = await createAuthenticatedClient(merchant);
    const { data: acceptData, error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerData.id,
    });

    // Falla si accept_offer no revalida: la RPC debe arrojar COURIER_SUSPENDED
    expect(acceptData).toBeNull();
    expect(acceptErr).not.toBeNull();
    expect(acceptErr?.message).toContain('COURIER_SUSPENDED');

    // Confirmar que la oferta nunca quedó en accepted ni la solicitud en matched
    const inspection = await getRequestInspectionData(stagingContext, targetRequestId);
    expect(inspection.requestStatus).toBe('published');
    const checkedOffer = inspection.offers.find((o) => o.id === offerData.id);
    expect(checkedOffer?.status).toBe('pending');
  });
});
