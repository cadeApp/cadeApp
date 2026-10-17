import {
  test,
  expect,
  seedAdminUser,
  elevateAdminToAal2,
  createAuthenticatedClient,
  generateTotp,
  seedDeliveryRequestInState,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { createAdminClient } from '@/server/supabase/admin';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { ADMIN_COPY } from '@/features/admin/copy';
import { COURIER_ONBOARDING_COPY } from '@/features/courier-onboarding/copy';
import { COURIER_DOCS_BUCKET } from '@/features/courier-onboarding/upload-manager';
import { createHmac } from 'node:crypto';

// Buffer PNG real 2x2 válido para pruebas de subida (H11)
const DUMMY_2X2_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
  'base64'
);

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

    await page.evaluate(({ dni, courierId }) => {
      sessionStorage.setItem('cadeapp_onboarding_dni', dni);
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: `courier/${courierId}/dni_front_fixture.jpg`,
          dni_back: `courier/${courierId}/dni_back_fixture.jpg`,
          selfie: `courier/${courierId}/selfie_fixture.jpg`,
          avatar: `courier/${courierId}/avatar_fixture.jpg`,
        })
      );
    }, { dni: testDni, courierId: courier2.id });

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
    const duplicateDniAlert = page.getByRole('alert').filter({
      hasText: /ya está registrado|rechazado anteriormente/i,
    });
    await expect(duplicateDniAlert).toBeVisible({ timeout: 10000 });
    await expect(duplicateDniAlert).toContainText(
      /ya está registrado|rechazado anteriormente/i
    );

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

    const dbAdmin = createAdminClient();
    let uploadedDocs: Record<string, string> = {};

    try {
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

      // 3. Completar DNI numérico válido y subir los 4 documentos requeridos vía inputs de UI reales
      const uniqueDni = `39${Math.floor(100000 + Math.random() * 900000)}`;
      await dniInput.fill(uniqueDni);

      const requiredDocsToUpload: Array<{ id: string; name: string }> = [
        { id: '#file-input-dni_front', name: 'dni_front.png' },
        { id: '#file-input-dni_back', name: 'dni_back.png' },
        { id: '#file-input-selfie', name: 'selfie.png' },
        { id: '#file-input-avatar', name: 'avatar.png' },
      ];

      for (const doc of requiredDocsToUpload) {
        const input = page.locator(doc.id);
        await expect(input).toBeAttached();
        await input.setInputFiles({
          name: doc.name,
          mimeType: 'image/png',
          buffer: DUMMY_2X2_PNG,
        });

        const card = page.locator('[data-slot="document-upload-card"]').filter({
          has: page.locator(doc.id),
        });
        await expect(card).toHaveAttribute('data-status', 'success', { timeout: 20000 });
      }

      // El botón Continuar se habilita una vez completados DNI y los 4 documentos
      await expect(continueButton).toBeEnabled({ timeout: 10000 });

      // Verificar que sessionStorage contenga exactamente las 4 rutas canónicas generadas por upload-manager
      const rawDocs = await page.evaluate(() => sessionStorage.getItem('cadeapp_onboarding_docs'));
      expect(rawDocs).not.toBeNull();
      uploadedDocs = JSON.parse(rawDocs as string) as Record<string, string>;
      expect(Object.keys(uploadedDocs)).toHaveLength(4);
      for (const kind of ['dni_front', 'dni_back', 'selfie', 'avatar']) {
        expect(uploadedDocs[kind]).toMatch(
          new RegExp(`^courier/${courier.id}/${kind}_\\d+\\.(png|jpe?g|webp)$`, 'i')
        );
      }

      // 4. Continuar al paso 2 pulsando el botón Continuar habilitado (H02)
      await continueButton.click();

      await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      await expect(
        page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.vehicleHeadline })
      ).toBeVisible();

      // 5. Seleccionar tipo de vehículo, patente y aceptar consentimientos legales sin omitir controles (H02)
      const motoRadio = page.getByRole('radio', {
        name: new RegExp(COURIER_ONBOARDING_COPY.transportMoto, 'i'),
      });
      await motoRadio.check();
      await expect(motoRadio).toBeChecked();

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

      // 7. Verificación de datos persistidos en base de datos mediante cliente admin
      const { data: docsRows, error: docsErr } = await dbAdmin
        .from('courier_documents')
        .select('id, kind, storage_path, status, is_current')
        .eq('courier_id', courier.id);

      expect(docsErr).toBeNull();
      expect(docsRows).toHaveLength(4);

      for (const row of docsRows ?? []) {
        expect(row.status).toBe('submitted');
        expect(row.is_current).toBe(true);
        expect(row.storage_path).toBe(uploadedDocs[row.kind]);
      }

      const { data: courierRow, error: courierErr } = await dbAdmin
        .from('couriers')
        .select('status, vehicle_type, vehicle_plate, dni_hmac')
        .eq('profile_id', courier.id)
        .single();

      expect(courierErr).toBeNull();
      expect(courierRow?.vehicle_type).toBe('moto');
      expect(courierRow?.vehicle_plate).toBe('AB 123 CD');
      expect(courierRow?.dni_hmac).toBeTruthy();
    } finally {
      // 8. Cleanup aislado: eliminar filas de courier_documents y archivos físicos en Storage
      await dbAdmin.from('courier_documents').delete().eq('courier_id', courier.id);

      const pathsToRemove = Object.values(uploadedDocs);
      if (pathsToRemove.length > 0) {
        await dbAdmin.storage.from(COURIER_DOCS_BUCKET).remove(pathsToRemove);
      }

      // Limpieza adicional de cualquier archivo remanente en la carpeta del courier
      const { data: fileList } = await dbAdmin.storage
        .from(COURIER_DOCS_BUCKET)
        .list(`courier/${courier.id}`);
      if (fileList && fileList.length > 0) {
        const filesToDelete = fileList.map((f) => `courier/${courier.id}/${f.name}`);
        await dbAdmin.storage.from(COURIER_DOCS_BUCKET).remove(filesToDelete);
      }

      await resetCourierToPendingOnboarding(courier.id);
    }
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

    await page.evaluate(({ dni, courierId }) => {
      sessionStorage.setItem('cadeapp_onboarding_dni', dni);
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: `courier/${courierId}/dni_front_fixture.jpg`,
          dni_back: `courier/${courierId}/dni_back_fixture.jpg`,
          selfie: `courier/${courierId}/selfie_fixture.jpg`,
          avatar: `courier/${courierId}/avatar_fixture.jpg`,
        })
      );
    }, { dni: existingDni, courierId: courier2.id });

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
    const duplicateDniAlert = page.getByRole('alert').filter({
      hasText: /ya está registrado|rechazado anteriormente/i,
    });
    await expect(duplicateDniAlert).toBeVisible({ timeout: 10000 });
    await expect(duplicateDniAlert).toContainText(
      /ya está registrado|rechazado anteriormente/i
    );

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

  // ---------------------------------------------------------------------------
  // T-353: Validación semántica en UI de onboarding (PR362-H06)
  // ---------------------------------------------------------------------------
  test('T-353: Validación semántica en UI de onboarding: DNI con letras muestra error accesible, corrección habilita avance', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }
    await resetCourierToPendingOnboarding(courier.id);
    await loginAsCourier(0, page);

    await page.goto('/courier/onboarding/identity');
    await waitForNoSkeletons(page);

    // Precargar documentos requeridos usando el mecanismo de fixtures existente en esta spec (líneas 368-382)
    await page.evaluate((courierId) => {
      sessionStorage.setItem(
        'cadeapp_onboarding_docs',
        JSON.stringify({
          dni_front: `courier/${courierId}/dni_front_fixture.jpg`,
          dni_back: `courier/${courierId}/dni_back_fixture.jpg`,
          selfie: `courier/${courierId}/selfie_fixture.jpg`,
          avatar: `courier/${courierId}/avatar_fixture.jpg`,
        })
      );
    }, courier.id);
    await page.reload();
    await waitForNoSkeletons(page);

    const dniInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.dniPlaceholder);
    const continueBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnContinue, 'i'),
    });

    // 1. Ingresar DNI inválido con letras
    await dniInput.fill('1234567A');
    await dniInput.blur();

    // 2. Muestra mensaje de error accesible y botón deshabilitado
    const errorAlert = page.locator('#dni-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveText(/El DNI debe tener 7 u 8 dígitos numéricos/i);
    await expect(continueBtn).toBeDisabled();

    // 3. Corregir con DNI numérico válido
    await dniInput.fill('38123456');
    await dniInput.blur();

    await expect(errorAlert).not.toBeVisible();
    await expect(continueBtn).toBeEnabled();

    // 4. Continuar al paso de vehículo y verificar avance y persistencia en sessionStorage
    await continueBtn.click();
    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);
    await expect(
      page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.vehicleHeadline })
    ).toBeVisible();

    const savedDni = await page.evaluate(() =>
      sessionStorage.getItem('cadeapp_onboarding_dni')
    );
    expect(savedDni).toBe('38123456');
  });

  // ---------------------------------------------------------------------------
  // T-357: Actualización de vehículo desde el perfil del repartidor (Issue #344)
  // ---------------------------------------------------------------------------
  test('T-357: Flujo completo de actualización de vehículo desde perfil (moto -> car con ELA 666 -> bike -> walk) sin reonboarding ni documentos extras', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }

    const dbAdmin = createAdminClient();

    // Snapshot inicial de courier_documents para verificar que no sufre inserciones/modificaciones
    const { data: initialDocs, error: docsError } = await dbAdmin
      .from('courier_documents')
      .select('kind, storage_path, status')
      .eq('courier_id', courier.id);
    expect(docsError).toBeNull();

    // Precondición: courier con vehículo moto existente y habilitado (DoD 1: seed comprueba error:null y 1 fila)
    const { data: seeded, error: seedError } = await dbAdmin
      .from('couriers')
      .update({
        vehicle_type: 'moto',
        vehicle_plate: 'AB 123 CD',
        status: 'approved',
      })
      .eq('profile_id', courier.id)
      .select('profile_id');
    expect(seedError).toBeNull();
    expect(seeded).toHaveLength(1);

    // 1. Iniciar sesión como repartidor y navegar al perfil
    await loginAsCourier(0, page);
    await page.goto('/courier/profile');
    await waitForNoSkeletons(page);

    // 2. Verificar que se muestra Motocicleta con su patente Mercosur inicial y el enlace «Actualizar»
    await expect(page.getByText('Motocicleta')).toBeVisible();
    await expect(page.getByText(/Patente: AB 123 CD/i)).toBeVisible();

    const updateLink = page.getByRole('link', { name: /Actualizar/i });
    await expect(updateLink).toBeVisible();
    await updateLink.click();

    // 3. Verifica llegada a la pantalla de edición: sin stepper de onboarding, sin checkboxes ni subida documental
    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);

    await expect(page.getByRole('heading', { name: /Actualizar vehículo/i })).toBeVisible();
    await expect(page.getByText(COURIER_ONBOARDING_COPY.stepCounter2)).not.toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByText(COURIER_ONBOARDING_COPY.optionalDocsTitle)).not.toBeVisible();

    // 4. Validación de patente inválida: ingresar patente con formato incorrecto
    const carOption = page.locator('label:has(input[value="car"])');
    await carOption.click();

    const plateInput = page.getByLabel(/Patente del vehículo/i);
    await expect(plateInput).toBeVisible();
    await plateInput.fill('PATENTE_INVALIDA');
    await plateInput.blur();

    const plateError = page.locator('#plate-error');
    await expect(plateError).toBeVisible();
    await expect(plateError).toHaveText(/Formato de patente inválido/i);

    const saveButton = page.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
    await expect(saveButton).toBeDisabled();

    // 5. Corregir con patente argentina tradicional (formato ELA 666)
    await plateInput.fill('ELA 666');
    await plateInput.blur();
    await expect(plateError).not.toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // 6. Verifica redirección al perfil y persistencia de Automóvil + ELA 666 tras reload
    await page.waitForURL((url) => url.pathname.includes('/courier/profile'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);

    await expect(page.getByText('Automóvil')).toBeVisible();
    await expect(page.getByText(/Patente: ELA 666/i)).toBeVisible();
    await page.reload();
    await waitForNoSkeletons(page);
    await expect(page.getByText('Automóvil')).toBeVisible();
    await expect(page.getByText(/Patente: ELA 666/i)).toBeVisible();

    const { data: carPersisted, error: carPersistError } = await dbAdmin
      .from('couriers')
      .select('vehicle_type, vehicle_plate, status')
      .eq('profile_id', courier.id)
      .single();
    expect(carPersistError).toBeNull();
    expect(carPersisted).toMatchObject({
      vehicle_type: 'car',
      vehicle_plate: 'ELA 666',
      status: 'approved',
    });

    // 7. Modificar a Bicicleta: desaparece campo patente y se normaliza a null
    await page.getByRole('link', { name: /Actualizar/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);

    const bikeOption = page.locator('label:has(input[value="bike"])');
    await bikeOption.click();
    await expect(page.getByLabel(/Patente del vehículo/i)).not.toBeVisible();

    const saveBikeButton = page.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
    await expect(saveBikeButton).toBeEnabled();
    await saveBikeButton.click();

    await page.waitForURL((url) => url.pathname.includes('/courier/profile'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);
    await expect(page.getByText('Bicicleta')).toBeVisible();
    await page.reload();
    await waitForNoSkeletons(page);
    await expect(page.getByText('Bicicleta')).toBeVisible();

    const { data: bikePersisted, error: bikePersistError } = await dbAdmin
      .from('couriers')
      .select('vehicle_type, vehicle_plate, status')
      .eq('profile_id', courier.id)
      .single();
    expect(bikePersistError).toBeNull();
    expect(bikePersisted).toMatchObject({
      vehicle_type: 'bike',
      vehicle_plate: null,
      status: 'approved',
    });

    // 8. Modificar a A pie: sin patente y persiste walk
    await page.getByRole('link', { name: /Actualizar/i }).click();
    await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);

    const walkOption = page.locator('label:has(input[value="walk"])');
    await walkOption.click();
    await expect(page.getByLabel(/Patente del vehículo/i)).not.toBeVisible();

    const saveWalkButton = page.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i });
    await expect(saveWalkButton).toBeEnabled();
    await saveWalkButton.click();

    await page.waitForURL((url) => url.pathname.includes('/courier/profile'), {
      timeout: 15000,
    });
    await waitForNoSkeletons(page);
    await expect(page.getByText('A pie')).toBeVisible();
    await page.reload();
    await waitForNoSkeletons(page);
    await expect(page.getByText('A pie')).toBeVisible();

    const { data: walkPersisted, error: walkPersistError } = await dbAdmin
      .from('couriers')
      .select('vehicle_type, vehicle_plate, status')
      .eq('profile_id', courier.id)
      .single();
    expect(walkPersistError).toBeNull();
    expect(walkPersisted).toMatchObject({
      vehicle_type: 'walk',
      vehicle_plate: null,
      status: 'approved',
    });

    // 9. Verificar que courier_documents no fue alterado durante las 3 actualizaciones
    const { data: finalDocs, error: finalDocsError } = await dbAdmin
      .from('courier_documents')
      .select('kind, storage_path, status')
      .eq('courier_id', courier.id);
    expect(finalDocsError).toBeNull();
    expect(finalDocs).toEqual(initialDocs);
  });

  test('T-357: E2E negativo: postulante con alta incompleta nunca ve edición con ?mode=edit y mantiene precondición con aislamiento entre actores', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier2 = stagingContext.courierUsers?.[1];
    if (!courier2) {
      throw new Error('[E2E Error] Se requieren al menos 2 couriers en stagingContext');
    }

    const dbAdmin = createAdminClient();

    // Precondición: postulante con onboarding incompleto (vehicle_type nulo)
    await resetCourierToPendingOnboarding(courier2.id);

    // 1. Iniciar sesión como courier 2
    await loginAsCourier(1, page);

    // 2. Navegar directamente con query param malicioso ?mode=edit
    await page.goto('/courier/onboarding/vehicle?mode=edit');
    await waitForNoSkeletons(page);

    // 3. Verificar que se presenta la pantalla de alta (onboarding), no la de edición
    await expect(
      page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.vehicleHeadline })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /Actualizar vehículo/i })).not.toBeVisible();
    await expect(page.getByText(COURIER_ONBOARDING_COPY.stepCounter2)).toBeVisible();

    // Los consentimientos legales obligatorios deben estar presentes y desmarcados
    const checkboxes = page.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(3);

    // 4. Base de datos permanece con vehicle_type nulo y status pending (0 escrituras)
    const { data: courierRow, error: fetchError } = await dbAdmin
      .from('couriers')
      .select('vehicle_type, status')
      .eq('profile_id', courier2.id)
      .single();
    expect(fetchError).toBeNull();
    expect(courierRow?.vehicle_type).toBeNull();
    expect(courierRow?.status).toBe('pending');

    // 5. Control de actor ajeno: Courier 0 (actor A) intenta modificar directamente el registro de Courier 1 (actor B)
    const courier1 = stagingContext.courierUsers?.[0];
    if (!courier1) {
      throw new Error('[E2E Error] Se requiere courier1 en stagingContext');
    }
    const courier1Client = await createAuthenticatedClient(courier1);

    const { data: bBefore, error: bBeforeErr } = await dbAdmin
      .from('couriers')
      .select('profile_id, vehicle_type, vehicle_plate, status')
      .eq('profile_id', courier2.id)
      .single();
    expect(bBeforeErr).toBeNull();

    // Actor A autenticado intenta escribir sobre el perfil de B con su sesión de Supabase
    const { data: attackRows } = await courier1Client
      .from('couriers')
      .update({ vehicle_type: 'car', vehicle_plate: 'ATAQUE123' })
      .eq('profile_id', courier2.id)
      .select();

    // RLS (couriers_update_self) impide mutar filas ajenas; retorna 0 filas modificadas
    expect(attackRows ?? []).toHaveLength(0);

    const { data: bAfter, error: bAfterErr } = await dbAdmin
      .from('couriers')
      .select('profile_id, vehicle_type, vehicle_plate, status')
      .eq('profile_id', courier2.id)
      .single();
    expect(bAfterErr).toBeNull();
    expect(bAfter).toEqual(bBefore);
  });

  // ---------------------------------------------------------------------------
  // T-357: Vista de viaje en vivo para el comercio dueño (Issue #344 / DoD H04)
  // ---------------------------------------------------------------------------
  test('T-357: Vista de viaje refleja en vivo actualización de vehículo y patente para el comercio dueño con recarga y cleanup', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const dbAdmin = createAdminClient();

    // Precondición: courier con vehículo moto inicial (DoD 1: seed comprueba error:null y 1 fila)
    const { data: initialSeed, error: initialSeedError } = await dbAdmin
      .from('couriers')
      .update({
        vehicle_type: 'moto',
        vehicle_plate: 'AB 123 CD',
        status: 'approved',
      })
      .eq('profile_id', courier.id)
      .select('profile_id');
    expect(initialSeedError).toBeNull();
    expect(initialSeed).toHaveLength(1);

    // Sembrar solicitud en estado matched vinculando al merchant y al courier de fixture
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;

    const merchantClient = await createAuthenticatedClient(merchant);

    // Snapshot previo de lectura RPC get_trip_details (proyecta moto y patente AB 123 CD)
    const { data: initialTripRpc, error: initialRpcError } = await merchantClient.rpc('get_trip_details', {
      p_request_id: requestId,
    });
    expect(initialRpcError).toBeNull();
    const initialTrip = initialTripRpc as { vehicleType: string; vehiclePlate: string | null };
    expect(initialTrip.vehicleType).toBe('moto');
    expect(initialTrip.vehiclePlate).toBe('AB 123 CD');

    // Sesión aislada de navegador para el comercio dueño
    const merchantContext = await browser.newContext();
    try {
      const merchantBrowserPage = await merchantContext.newPage();
      await loginAsMerchant(merchantBrowserPage);

      // 1. Comercio abre /trips/{requestId} y comprueba bloque «Repartidor asignado» con Moto y patente inicial
      await merchantBrowserPage.goto(`/trips/${requestId}`);
      await waitForNoSkeletons(merchantBrowserPage);
      await expect(merchantBrowserPage.getByRole('heading', { name: 'Repartidor asignado' })).toBeVisible();
      await expect(merchantBrowserPage.getByText('Moto')).toBeVisible();
      await expect(merchantBrowserPage.getByText(/Patente:.*AB 123 CD/i)).toBeVisible();

      // 2. Repartidor autenticado cambia movilidad a Auto (car) con patente tradicional ELA 666 desde su perfil
      await loginAsCourier(0, page);
      await page.goto('/courier/profile');
      await waitForNoSkeletons(page);
      await page.getByRole('link', { name: /Actualizar/i }).click();
      await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      await page.locator('label:has(input[value="car"])').click();
      const plateInput = page.getByLabel(/Patente del vehículo/i);
      await plateInput.fill('ELA 666');
      await plateInput.blur();
      await page.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i }).click();
      await page.waitForURL((url) => url.pathname.includes('/courier/profile'), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      // 3. En la sesión del comercio dueño, recargar el viaje y comprobar que muestra Auto y ELA 666
      await merchantBrowserPage.reload();
      await waitForNoSkeletons(merchantBrowserPage);
      await expect(merchantBrowserPage.getByText('Auto')).toBeVisible();
      await expect(merchantBrowserPage.getByText(/Patente:.*ELA 666/i)).toBeVisible();

      // Contrastar con la RPC get_trip_details autorizada
      const { data: updatedCarRpc, error: carRpcError } = await merchantClient.rpc('get_trip_details', {
        p_request_id: requestId,
      });
      expect(carRpcError).toBeNull();
      const updatedCar = updatedCarRpc as { vehicleType: string; vehiclePlate: string | null };
      expect(updatedCar.vehicleType).toBe('car');
      expect(updatedCar.vehiclePlate).toBe('ELA 666');

      // 4. Repartidor cambia a Bicicleta (bike): desaparece la patente
      await page.getByRole('link', { name: /Actualizar/i }).click();
      await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/vehicle'), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      await page.locator('label:has(input[value="bike"])').click();
      await page.getByRole('button', { name: /Guardar vehículo|Actualizar vehículo/i }).click();
      await page.waitForURL((url) => url.pathname.includes('/courier/profile'), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      // 5. En la sesión del comercio dueño, recargar el viaje: se refleja Bicicleta y la patente desaparece
      await merchantBrowserPage.reload();
      await waitForNoSkeletons(merchantBrowserPage);
      await expect(merchantBrowserPage.getByText('Bicicleta')).toBeVisible();
      await expect(merchantBrowserPage.getByText(/Patente:/i)).not.toBeVisible();

      // Contrastar con RPC get_trip_details
      const { data: updatedBikeRpc, error: bikeRpcError } = await merchantClient.rpc('get_trip_details', {
        p_request_id: requestId,
      });
      expect(bikeRpcError).toBeNull();
      const updatedBike = updatedBikeRpc as { vehicleType: string; vehiclePlate: string | null };
      expect(updatedBike.vehicleType).toBe('bike');
      expect(updatedBike.vehiclePlate).toBeNull();
    } finally {
      await merchantContext.close();
      // Cleanup: restaurar estado asumido por la fixture global del courier
      await dbAdmin
        .from('couriers')
        .update({
          vehicle_type: 'moto',
          vehicle_plate: 'AB 123 CD',
          status: 'approved',
        })
        .eq('profile_id', courier.id);
    }
  });
});
