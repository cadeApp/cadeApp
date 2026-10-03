import {
  test,
  expect,
  getRequestInspectionData,
  trackEntityForCleanup,
  type StagingSeedContext,
} from '../fixtures';
import { createHmac, randomUUID } from 'node:crypto';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { LoginPage } from '../pages';
import { createAdminClient } from '@/server/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { canReportIncident } from '@/features/incidents/report-window';

/**
 * Decodifica una cadena Base32 (RFC 4648) a Buffer sin dependencias externas.
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/[=\s]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) {
      throw new Error(`[TOTP Error] Carácter base32 inválido: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Genera el código TOTP de 6 dígitos (RFC 6238) para un secret en Base32.
 * Utiliza HMAC-SHA1 con ventana temporal estándar de 30 segundos.
 */
function generateTotp(secret: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(timestampSeconds / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(epoch));

  const hmac = createHmac('sha1', key).update(timeBuffer).digest();
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) {
    throw new Error('[TOTP Error] Digest HMAC vacío');
  }
  const offset = lastByte & 0x0f;
  const codeInt = hmac.readUInt32BE(offset) & 0x7fffffff;

  const otp = codeInt % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/**
 * Crea un usuario administrador transitorio con AAL2 verificado vía TOTP para la corrida.
 */
async function createAdminWithAal2Session(stagingContext: StagingSeedContext) {
  const admin = createAdminClient();
  const adminEmail = `e2e_${stagingContext.testRunId}_admin@cadeapp-staging.test`;
  const adminPassword = `P@ssword_${randomUUID()}!`;

  const { data: adminAuthData, error: adminAuthErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      role: 'admin',
      display_name: `E2E Admin ${stagingContext.testRunId}`,
    },
  });

  if (adminAuthErr || !adminAuthData?.user?.id) {
    throw new Error(
      `[E2E Admin Error] No se pudo crear usuario admin transitorio: ${adminAuthErr?.message || 'Sin usuario retornado'}`
    );
  }

  const adminUserId = adminAuthData.user.id;
  trackEntityForCleanup(stagingContext, 'user', adminUserId);

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: adminUserId,
    role: 'admin',
    consent_status: 'active',
  });
  if (profileErr) {
    throw new Error(`[E2E Admin Error] Falló upsert de profile admin: ${profileErr.message}`);
  }

  const adminSessionClient = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: signInErr } = await adminSessionClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (signInErr) {
    throw new Error(`[E2E Admin Error] Falló autenticación de admin: ${signInErr.message}`);
  }

  const { data: enrollData, error: enrollErr } = await adminSessionClient.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (enrollErr || !enrollData?.id || !enrollData?.totp?.secret) {
    throw new Error(
      `[E2E MFA Error] Falló enrolamiento TOTP: ${enrollErr?.message || 'Sin secret retornado'}`
    );
  }

  const totpCode = generateTotp(enrollData.totp.secret);

  const { error: verifyErr } = await adminSessionClient.auth.mfa.challengeAndVerify({
    factorId: enrollData.id,
    code: totpCode,
  });
  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Falló challengeAndVerify de MFA: ${verifyErr.message}`);
  }

  const { data: aalData, error: aalErr } =
    await adminSessionClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) {
    throw new Error(`[E2E MFA Error] Falló getAuthenticatorAssuranceLevel: ${aalErr.message}`);
  }
  expect(aalData.currentLevel).toBe('aal2');

  return { adminClient: adminSessionClient, adminUserId, adminEmail, adminPassword, totpCode };
}

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

    const targetRequestId = stagingContext.createdRequestIds[0];
    if (!targetRequestId) throw new Error('[E2E Error] No request ID in stagingContext');

    const admin = createAdminClient();

    // 1. Configurar solicitud emparejada (matched trip) con el repartidor asignado
    const { data: offerData, error: offerErr } = await admin
      .from('offers')
      .insert({
        request_id: targetRequestId,
        courier_id: courier.id,
        amount_ars: 1500,
        eta_minutes: 20,
        status: 'accepted',
        decided_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (offerErr || !offerData) {
      throw new Error(`[E2E Setup Error] Falló creación de oferta aceptada: ${offerErr?.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerData.id);

    const { error: requestUpdateErr } = await admin
      .from('delivery_requests')
      .update({
        status: 'matched',
        matched_at: new Date().toISOString(),
      })
      .eq('id', targetRequestId);

    if (requestUpdateErr) {
      throw new Error(
        `[E2E Setup Error] Falló actualización a matched: ${requestUpdateErr.message}`
      );
    }

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

    const kindRadio = page.getByRole('radio', { name: /problema con el pago/i });
    await expect(kindRadio).toBeVisible();
    await kindRadio.click();

    const descInput = page.getByLabel(/¿qué sucedió\?/i);
    const incidentDescription = `Incidente E2E ${stagingContext.testRunId}: El repartidor tuvo un problema con el pago acordado.`;
    await descInput.fill(incidentDescription);

    const submitBtn = page.getByRole('button', { name: /enviar reporte/i });
    await submitBtn.click();

    // 5. Confirmación en pantalla
    await expect(page.getByText(/reporte enviado/i)).toBeVisible();

    // 6. Administrador E2E con AAL2 verifica la llegada del reporte a la bandeja
    const { adminEmail, adminPassword, totpCode } =
      await createAdminWithAal2Session(stagingContext);

    const adminPage = await page.context().newPage();
    const loginPage = new LoginPage(adminPage);
    await loginPage.navigate();
    await loginPage.login(adminEmail, adminPassword);

    // Esperar redirección al flujo MFA
    await adminPage.waitForURL(/\/login\/mfa/, { timeout: 10000 });
    const otpInput = adminPage.locator('#totp-code');
    await otpInput.fill(totpCode);
    await adminPage.getByRole('button', { name: /verificar/i }).click();

    // Navegar a la bandeja de incidentes
    await adminPage.goto('/admin/incidents');
    await waitForNoSkeletons(adminPage);

    // Verificar presencia del incidente en la bandeja
    await expect(adminPage.getByText(/problema con el pago/i)).toBeVisible();
    await expect(adminPage.getByText(incidentDescription)).toBeVisible();
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

    // 1. Administrador suspende cautelarmente al repartidor vía sesión AAL2
    const { adminClient } = await createAdminWithAal2Session(stagingContext);
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
    const courierClient = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: signInErr } = await courierClient.auth.signInWithPassword({
      email: courier.email,
      password: courier.password,
    });
    if (signInErr) {
      throw new Error(`[E2E Auth Error] Falló login de courier: ${signInErr.message}`);
    }

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

    // 1. Crear oferta en estado pending para el repartidor
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

    // 2. Administrador suspende al repartidor
    const { adminClient } = await createAdminWithAal2Session(stagingContext);
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
    const merchantClient = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: merchSignInErr } = await merchantClient.auth.signInWithPassword({
      email: merchant.email,
      password: merchant.password,
    });
    if (merchSignInErr) {
      throw new Error(`[E2E Auth Error] Falló login de comercio: ${merchSignInErr.message}`);
    }

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
    const merchantClient = createClient<Database>(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await merchantClient.auth.signInWithPassword({
      email: merchant.email,
      password: merchant.password,
    });

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
