import {
  test,
  expect,
  seedAdminUser,
  elevateAdminToAal2,
  createAuthenticatedClient,
  generateTotp,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { createAdminClient } from '@/server/supabase/admin';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { ADMIN_COPY } from '@/features/admin/copy';
import { COURIER_ONBOARDING_COPY } from '@/features/courier-onboarding/copy';
import { createHmac } from 'node:crypto';

/**
 * T-302: E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado
 *
 * Flujo completo y verificación de invariantes críticas:
 * 1. DoD Invariante 1: Falla si se quita el chequeo de MFA en la aprobación del repartidor.
 *    - Invocación de aprobación sin claim AAL2 es rechazada con AAL2_REQUIRED.
 *    - Guarda de ruta para admin AAL1 redirige a /login/mfa.
 *    - Con AAL2 verificado vía TOTP, admin_decide_courier aprueba al postulante y registra audit_log.
 * 2. DoD Invariante 2: Falla si se quita la deduplicación de DNI en onboarding.
 *    - El formulario UI y courierOnboardingAction rechazan con mensaje accesible ante DNI ya existente.
 *    - Unicidad garantizada en base de datos (dni_hmac text unique).
 * 3. Flujo 1 (UI): Onboarding del repartidor paso a paso (identidad -> vehículo -> estado en revisión).
 * 4. Flujo 2 (UI): Deduplicación de DNI en UI muestra mensaje accesible en role="alert".
 * 5. Flujo 3 (UI): Aprobación administrativa con MFA en navegador habilita al repartidor para operar.
 */

/**
 * Restablece al repartidor a la precondición inicial previa al onboarding (H03).
 */
async function resetCourierToPendingOnboarding(courierId: string): Promise<void> {
  const dbAdmin = createAdminClient();
  await dbAdmin.from('courier_documents').delete().eq('courier_id', courierId);
  const { error } = await dbAdmin
    .from('couriers')
    .update({
      status: 'pending',
      available: false,
      vehicle_type: null,
      vehicle_plate: null,
      dni_hmac: null,
      decided_at: null,
      decided_by: null,
    })
    .eq('profile_id', courierId);

  if (error) {
    throw new Error(
      `[E2E Reset Error] Falló restablecimiento de courier ${courierId}: ${error.message}`
    );
  }
}

/**
 * Enrola y verifica un factor TOTP para el admin conservando el secret para uso en el navegador (H04).
 */
async function enrollAdminTotpFactor(admin: UserCredentials): Promise<{ secret: string }> {
  const adminClient = await createAuthenticatedClient(admin);
  const { data: factors, error: listErr } = await adminClient.auth.mfa.listFactors();
  if (listErr) {
    throw new Error(`[E2E MFA Error] Error al listar factores: ${listErr.message}`);
  }

  const unverified =
    factors?.all?.filter((f) => f.factor_type === 'totp' && f.status === 'unverified') ?? [];
  for (const factor of unverified) {
    await adminClient.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data: enrolled, error: enrollErr } = await adminClient.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (enrollErr || !enrolled?.totp) {
    throw new Error(`[E2E MFA Error] Falló enrolamiento TOTP: ${enrollErr?.message}`);
  }

  const secret = enrolled.totp.secret;
  const code = generateTotp(secret);
  const { error: verifyErr } = await adminClient.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code,
  });
  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Falló verificación inicial de factor: ${verifyErr.message}`);
  }

  return { secret };
}

/**
 * Obtiene el secreto HMAC para DNI de forma estricta (H06).
 */
function requireDniHmacSecret(): string {
  const secret = process.env.DNI_HMAC_SECRET;
  if (!secret) {
    throw new Error('[E2E Precondition Error] DNI_HMAC_SECRET es obligatorio para T-302');
  }
  return secret;
}

test.describe('T-302 — E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado', () => {
  // ---------------------------------------------------------------------------
  // DoD Invariante 1: Falla si se quita el chequeo de MFA en aprobación
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita el chequeo de MFA en aprobación de repartidor', async ({
    stagingContext,
  }) => {
    // 1. Verificación contractual de la guarda de rutas para admin sin MFA
    const adminAal1Session = {
      userId: 'test-admin-aal1',
      email: 'admin@cadeapp-staging.test',
      role: 'admin' as const,
      aal: 'aal1' as const,
      consentStatus: 'active' as const,
    };
    const guardAal1Result = evaluateRouteGuard('/admin/applicants', adminAal1Session);
    expect(guardAal1Result).toEqual({
      action: 'redirect',
      redirectTo: '/login/mfa?redirectTo=%2Fadmin%2Fapplicants',
    });

    // Con AAL2 verificado la guarda permite el acceso a la consola administrativa
    const adminAal2Session = {
      ...adminAal1Session,
      aal: 'aal2' as const,
    };
    const guardAal2Result = evaluateRouteGuard('/admin/applicants', adminAal2Session);
    expect(guardAal2Result).toEqual({ action: 'allow' });

    // 2. Crear admin en staging y obtener sesión primaria (AAL1)
    const adminCredentials = await seedAdminUser(stagingContext);
    const unElevatedClient = await createAuthenticatedClient(adminCredentials);

    // Preparar repartidor postulante en estado pending con precondición limpia (H03)
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere al menos un courier en stagingContext');
    }

    await resetCourierToPendingOnboarding(courier.id);
    const dbAdmin = createAdminClient();

    // 3. Intento de aprobación por admin con AAL1: el backend rechaza incondicionalmente
    const { data: decideNoMfaData, error: decideNoMfaError } = await unElevatedClient.rpc(
      'admin_decide_courier',
      {
        p_courier_id: courier.id,
        p_decision: 'approved',
        p_reason: 'Intento de aprobación sin segundo factor',
      }
    );

    expect(decideNoMfaData).toBeNull();
    expect(decideNoMfaError).not.toBeNull();
    expect(decideNoMfaError?.message).toContain('AAL2_REQUIRED');

    // 4. Elevar la sesión del administrador a AAL2 mediante verificación TOTP real
    await elevateAdminToAal2(unElevatedClient, adminCredentials);

    // 5. Con AAL2 activo, la aprobación administrativa procede con éxito
    const approvalReason = `Aprobación verificada con MFA T-302 ${stagingContext.testRunId}`;
    const { data: approveData, error: approveError } = await unElevatedClient.rpc(
      'admin_decide_courier',
      {
        p_courier_id: courier.id,
        p_decision: 'approved',
        p_reason: approvalReason,
      }
    );

    expect(approveError).toBeNull();
    expect(approveData).toMatchObject({
      status: 'approved',
      courierId: courier.id,
    });

    // 6. Verificación en base de datos: estado persistido y registro en audit_log
    const { data: courierRow } = await dbAdmin
      .from('couriers')
      .select('status, decided_by, decided_at')
      .eq('profile_id', courier.id)
      .single();
    expect(courierRow?.status).toBe('approved');
    expect(courierRow?.decided_by).toBe(adminCredentials.id);
    expect(courierRow?.decided_at).not.toBeNull();

    const { data: auditLogEntry } = await dbAdmin
      .from('audit_log')
      .select('action, actor_id, target_id, after')
      .eq('target_id', courier.id)
      .eq('action', 'admin_decide_courier')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(auditLogEntry).not.toBeNull();
    expect(auditLogEntry?.actor_id).toBe(adminCredentials.id);
    expect(auditLogEntry?.action).toBe('admin_decide_courier');
  });

  // ---------------------------------------------------------------------------
  // DoD Invariante 2: Falla si se quita la deduplicación de DNI en onboarding (H01)
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita la deduplicación de DNI en onboarding', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier1 = stagingContext.courierUsers?.[0];
    const courier2 = stagingContext.courierUsers?.[1];
    if (!courier1 || !courier2) {
      throw new Error('[E2E Error] Se requieren al menos 2 couriers en stagingContext');
    }

    const testDni = '38123456';
    const dbAdmin = createAdminClient();

    // 1. Simular registro previo de DNI para courier 1 calculando dni_hmac
    const hmacSecret = requireDniHmacSecret();
    const dniHmac = createHmac('sha256', hmacSecret).update(testDni).digest('hex');

    const { error: seedDniErr } = await dbAdmin
      .from('couriers')
      .update({ dni_hmac: dniHmac, status: 'approved' })
      .eq('profile_id', courier1.id);
    if (seedDniErr) {
      throw new Error(`[E2E Seed Error] No se pudo asignar dni_hmac: ${seedDniErr.message}`);
    }

    // 2. Restablecer courier 2 a estado inicial sin onboarding completado (H03)
    await resetCourierToPendingOnboarding(courier2.id);

    // 3. Courier 2 inicia sesión en el navegador
    await loginAsCourier(1, page);

    // 4. Intentar enviar onboarding con el mismo DNI a través de la UI real (H01)
    await page.goto('/courier/onboarding/vehicle');
    await waitForNoSkeletons(page);

    await page.evaluate((dni) => {
      sessionStorage.setItem('cadeapp_onboarding_dni', dni);
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: 'e2e/fixtures/dni_front.jpg',
          dni_back: 'e2e/fixtures/dni_back.jpg',
          selfie: 'e2e/fixtures/selfie.jpg',
          avatar: 'e2e/fixtures/avatar.jpg',
        })
      );
    }, testDni);

    await page.reload();
    await waitForNoSkeletons(page);

    // Completar controles sin escapes condicionales (H02)
    const plateInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.platePlaceholder);
    await expect(plateInput).toBeVisible();
    await plateInput.fill('AA 123 BB');

    const consentTos = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentTosLink, 'i'),
    });
    await expect(consentTos).toBeVisible();
    await consentTos.check();
    await expect(consentTos).toBeChecked();

    const consentPrivacy = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentPrivacyLink, 'i'),
    });
    await expect(consentPrivacy).toBeVisible();
    await consentPrivacy.check();
    await expect(consentPrivacy).toBeChecked();

    const consentContract = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentContractText, 'i'),
    });
    await expect(consentContract).toBeVisible();
    await consentContract.check();
    await expect(consentContract).toBeChecked();

    const submitBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnSubmitForReview, 'i'),
    });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. La UI productiva despliega el error específico de DNI duplicado
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/ya está registrado|rechazado anteriormente/i);

    // Invariante de navegación: el postulante no avanza a status
    expect(page.url()).not.toContain('/courier/onboarding/status');

    // 6. Invariante en base de datos: courier 2 no persistió dni_hmac y sigue pending
    const { data: c2Row } = await dbAdmin
      .from('couriers')
      .select('status, dni_hmac, vehicle_type')
      .eq('profile_id', courier2.id)
      .single();
    expect(c2Row?.dni_hmac).toBeNull();
    expect(c2Row?.vehicle_type).toBeNull();
    expect(c2Row?.status).toBe('pending');

    // Comprobación complementaria: unicidad en PostgreSQL a nivel base de datos
    const { error: duplicateDbErr } = await dbAdmin
      .from('couriers')
      .update({ dni_hmac: dniHmac })
      .eq('profile_id', courier2.id);

    expect(duplicateDbErr).not.toBeNull();
    expect(duplicateDbErr?.message).toMatch(/duplicate key|unique constraint|couriers_dni_hmac_key/i);
  });

  // ---------------------------------------------------------------------------
  // Flujo 1: Onboarding del repartidor paso a paso en UI (H02, H03)
  // ---------------------------------------------------------------------------
  test('Flujo 1: Onboarding del repartidor paso a paso en UI (identidad -> vehículo -> estado en revisión)', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }

    // Precondición limpia: postulante sin onboarding completado (H03)
    await resetCourierToPendingOnboarding(courier.id);

    // 1. Iniciar sesión como repartidor en el navegador
    await loginAsCourier(0, page);

    // 2. Navegar al paso 1 del onboarding (/courier/onboarding/identity)
    await page.goto('/courier/onboarding/identity');
    await waitForNoSkeletons(page);

    // Validar elementos iniciales del formulario de identidad
    await expect(
      page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.securityBannerTitle })
    ).toBeVisible();

    const dniInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.dniPlaceholder);
    await expect(dniInput).toBeVisible();

    // El botón Continuar debe permanecer deshabilitado inicialmente
    const continueButton = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnContinue, 'i'),
    });
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeDisabled();

    // 3. Completar DNI numérico válido y precargar documentos en sessionStorage
    const uniqueDni = `39${Math.floor(100000 + Math.random() * 900000)}`;

    await page.evaluate(() => {
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: 'e2e/fixtures/dni_front.jpg',
          dni_back: 'e2e/fixtures/dni_back.jpg',
          selfie: 'e2e/fixtures/selfie.jpg',
          avatar: 'e2e/fixtures/avatar.jpg',
        })
      );
    });

    // Recargar para que el componente cargue los documentos simulados de sessionStorage
    await page.reload();
    await waitForNoSkeletons(page);

    const reloadedDniInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.dniPlaceholder);
    await expect(reloadedDniInput).toBeVisible();
    await reloadedDniInput.fill(uniqueDni);

    // 4. Continuar al paso 2 pulsando el botón Continuar habilitado (H02)
    const reloadedContinueBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnContinue, 'i'),
    });
    await expect(reloadedContinueBtn).toBeVisible();
    await expect(reloadedContinueBtn).toBeEnabled();
    await reloadedContinueBtn.click();

    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);

    await expect(
      page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.vehicleHeadline })
    ).toBeVisible();

    // 5. Seleccionar tipo de vehículo, patente y aceptar consentimientos legales sin omitir controles (H02)
    const motoRadio = page.getByText(COURIER_ONBOARDING_COPY.transportMoto, { exact: false });
    await expect(motoRadio).toBeVisible();
    await motoRadio.click();

    const plateInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.platePlaceholder);
    await expect(plateInput).toBeVisible();
    await plateInput.fill('AB 123 CD');

    // Aceptar los tres consentimientos obligatorios
    const consentTosCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentTosLink, 'i'),
    });
    await expect(consentTosCheckbox).toBeVisible();
    await consentTosCheckbox.check();
    await expect(consentTosCheckbox).toBeChecked();

    const consentPrivacyCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentPrivacyLink, 'i'),
    });
    await expect(consentPrivacyCheckbox).toBeVisible();
    await consentPrivacyCheckbox.check();
    await expect(consentPrivacyCheckbox).toBeChecked();

    const consentContractCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentContractText, 'i'),
    });
    await expect(consentContractCheckbox).toBeVisible();
    await consentContractCheckbox.check();
    await expect(consentContractCheckbox).toBeChecked();

    // 6. Enviar formulario mediante clic real y verificar avance a /courier/onboarding/status
    const submitBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnSubmitForReview, 'i'),
    });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/status'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);
    await expect(
      page.getByRole('heading', {
        name: new RegExp(COURIER_ONBOARDING_COPY.underReviewTitle, 'i'),
      })
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 2: Deduplicación de DNI en UI muestra mensaje de error accesible (H01, H02)
  // ---------------------------------------------------------------------------
  test('Flujo 2: Deduplicación de DNI en UI muestra mensaje de error accesible', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier1 = stagingContext.courierUsers?.[0];
    const courier2 = stagingContext.courierUsers?.[1];
    if (!courier1 || !courier2) {
      throw new Error('[E2E Error] Se requieren al menos 2 couriers en stagingContext');
    }

    // 1. Asignar DNI fijo a courier 1 en base de datos
    const existingDni = '35999888';
    const hmacSecret = requireDniHmacSecret();
    const existingHmac = createHmac('sha256', hmacSecret).update(existingDni).digest('hex');

    const dbAdmin = createAdminClient();
    const { error: seedErr } = await dbAdmin
      .from('couriers')
      .update({ dni_hmac: existingHmac, status: 'approved' })
      .eq('profile_id', courier1.id);
    if (seedErr) {
      throw new Error(`[E2E Seed Error] No se pudo asignar dni_hmac a courier 1: ${seedErr.message}`);
    }

    // Restablecer courier 2 a precondición limpia (H03)
    await resetCourierToPendingOnboarding(courier2.id);

    // 2. Iniciar sesión como courier 2 en el navegador
    await loginAsCourier(1, page);

    // 3. Navegar a /courier/onboarding/vehicle con el DNI repetido precargado en sessionStorage
    await page.goto('/courier/onboarding/vehicle');
    await waitForNoSkeletons(page);

    await page.evaluate((dni) => {
      sessionStorage.setItem('cadeapp_onboarding_dni', dni);
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: 'e2e/fixtures/dni_front.jpg',
          dni_back: 'e2e/fixtures/dni_back.jpg',
          selfie: 'e2e/fixtures/selfie.jpg',
          avatar: 'e2e/fixtures/avatar.jpg',
        })
      );
    }, existingDni);

    await page.reload();
    await waitForNoSkeletons(page);

    // Completar consentimientos y vehículo sin condicionales (H02)
    const plateInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.platePlaceholder);
    await expect(plateInput).toBeVisible();
    await plateInput.fill('AA 999 ZZ');

    const consentTos = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentTosLink, 'i'),
    });
    await expect(consentTos).toBeVisible();
    await consentTos.check();
    await expect(consentTos).toBeChecked();

    const consentPrivacy = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentPrivacyLink, 'i'),
    });
    await expect(consentPrivacy).toBeVisible();
    await consentPrivacy.check();
    await expect(consentPrivacy).toBeChecked();

    const consentContract = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentContractText, 'i'),
    });
    await expect(consentContract).toBeVisible();
    await consentContract.check();
    await expect(consentContract).toBeChecked();

    // 4. Enviar el formulario y verificar que el error en role="alert" se despliega
    const submitBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnSubmitForReview, 'i'),
    });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Debe aparecer el alert accesible notificando DNI duplicado
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/ya está registrado|rechazado anteriormente/i);

    // Invariante de navegación: el usuario no avanza al visor de estado
    expect(page.url()).not.toContain('/courier/onboarding/status');
  });

  // ---------------------------------------------------------------------------
  // Flujo 3: Admin en UI con MFA aprueba al postulante y lo habilita (H04)
  // ---------------------------------------------------------------------------
  test('Flujo 3: Admin en UI con MFA aprueba al postulante y lo habilita', async ({
    page,
    stagingContext,
  }) => {
    // 1. Crear admin y courier postulante en estado pending con reset limpio (H03)
    const admin = await seedAdminUser(stagingContext);
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }

    await resetCourierToPendingOnboarding(courier.id);
    const dbAdmin = createAdminClient();

    // 2. Enrolar y verificar factor TOTP para la cuenta del admin conservando secret (H04)
    const { secret } = await enrollAdminTotpFactor(admin);

    // 3. Admin accede a login con destino a /admin/applicants
    await page.goto('/login?redirectTo=%2Fadmin%2Fapplicants');
    await waitForNoSkeletons(page);

    const emailInput = page.getByLabel(/^email$/i);
    const passwordInput = page.getByLabel(/^contraseña$/i);
    const loginSubmitBtn = page.getByRole('button', {
      name: /iniciar sesión|ingresar|continuar/i,
    });
    await waitForFormHydration(loginSubmitBtn);
    await emailInput.fill(admin.email);
    await passwordInput.fill(admin.password);
    await loginSubmitBtn.click();

    // El sistema redirige al formulario de doble factor (/login/mfa)
    await page.waitForURL((url) => url.pathname.includes('/login/mfa'), { timeout: 15000 });
    await waitForNoSkeletons(page);
    expect(page.url()).toContain('/login/mfa');

    // 4. Completar verificación MFA en el navegador con el código TOTP generado (H04)
    const totpInput = page.locator('#totp-code');
    await expect(totpInput).toBeVisible();
    const totpCode = generateTotp(secret);
    await totpInput.fill(totpCode);

    const verifyMfaBtn = page.getByRole('button', {
      name: new RegExp(ADMIN_COPY.mfa.verifyButton, 'i'),
    });
    await expect(verifyMfaBtn).toBeVisible();
    await expect(verifyMfaBtn).toBeEnabled();
    await verifyMfaBtn.click();

    // La sesión SSR del navegador se eleva a AAL2 y navega a la cola de postulantes
    await page.waitForURL((url) => url.pathname.includes('/admin/applicants'), { timeout: 15000 });
    await waitForNoSkeletons(page);
    expect(page.url()).toContain('/admin/applicants');

    // 5. Navegar al detalle del postulante
    await page.goto(`/admin/applicants/${courier.id}`);
    await waitForNoSkeletons(page);

    // 6. Activar la acción de aprobación exclusivamente desde la UI sin fallbacks (H04)
    const approveBtn = page.getByRole('button', {
      name: new RegExp(ADMIN_COPY.detail.applicantActions.approve, 'i'),
    });
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    // Modal de decisión: ingresar motivo y confirmar
    const reasonInput = page.locator('#decision-reason');
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill(`Postulante cumple requisitos E2E ${stagingContext.testRunId}`);

    const confirmBtn = page.getByRole('button', {
      name: new RegExp(ADMIN_COPY.detail.decisionDialogConfirm, 'i'),
    });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 7. La UI confirma la transición: el botón de suspender queda visible y el de aprobar desaparece
    const suspendBtn = page.getByRole('button', {
      name: new RegExp(ADMIN_COPY.detail.applicantActions.suspend, 'i'),
    });
    await expect(suspendBtn).toBeVisible({ timeout: 10000 });
    await expect(approveBtn).not.toBeVisible();

    // 8. Verificación en base de datos: el estado transicionó a 'approved' y se registró audit_log
    const { data: approvedRow } = await dbAdmin
      .from('couriers')
      .select('status, decided_by, decided_at')
      .eq('profile_id', courier.id)
      .single();
    expect(approvedRow?.status).toBe('approved');
    expect(approvedRow?.decided_by).toBe(admin.id);
    expect(approvedRow?.decided_at).not.toBeNull();

    const { data: auditLogEntry } = await dbAdmin
      .from('audit_log')
      .select('action, actor_id, target_id')
      .eq('target_id', courier.id)
      .eq('action', 'admin_decide_courier')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(auditLogEntry).not.toBeNull();
    expect(auditLogEntry?.actor_id).toBe(admin.id);
  });
});
