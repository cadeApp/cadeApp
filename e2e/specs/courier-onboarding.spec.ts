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
async function enrollAdminTotpFactor(
  admin: UserCredentials
): Promise<{ secret: string; client: Awaited<ReturnType<typeof createAuthenticatedClient>> }> {
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

  return { secret, client: adminClient };
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

    // Limpiar dni_hmac huérfano si quedó de una corrida previa en Develop
    await dbAdmin
      .from('couriers')
      .update({ dni_hmac: null })
      .eq('dni_hmac', dniHmac)
      .neq('profile_id', courier1.id);

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
  // T-356 / CC-025: Recarga de documento rechazado con motivo seguro de catálogo público
  // ---------------------------------------------------------------------------
  test('T-356 / CC-025: Recarga de documento rechazado con motivo seguro y actualización a En revisión sin mutar aprobados', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }

    const dbAdmin = createAdminClient();

    try {
      // 1. Precondición en DB: repartidor con onboarding completo y moto
      await resetCourierToPendingOnboarding(courier.id);
      const uniqueDni = `39${Math.floor(100000 + Math.random() * 900000)}`;
      const secret = process.env.DNI_HMAC_SECRET ?? 'development_dni_hmac_secret_cadeapp';
      const dniHmac = createHmac('sha256', secret).update(uniqueDni).digest('hex');

      await dbAdmin
        .from('couriers')
        .update({
          status: 'pending',
          vehicle_type: 'moto',
          vehicle_plate: 'AB 123 CD',
          dni_hmac: dniHmac,
          license_status: 'submitted',
          insurance_status: 'none',
        })
        .eq('profile_id', courier.id);

      // Subir documentos base con license en 'submitted' (PR358-R03: rechazo real mediante admin_verify_document)
      const { data: insertedDocs, error: insertErr } = await dbAdmin
        .from('courier_documents')
        .insert([
          {
            courier_id: courier.id,
            kind: 'dni_front',
            storage_path: `courier/${courier.id}/dni_front_base.png`,
            status: 'verified',
            is_current: true,
          },
          {
            courier_id: courier.id,
            kind: 'dni_back',
            storage_path: `courier/${courier.id}/dni_back_base.png`,
            status: 'verified',
            is_current: true,
          },
          {
            courier_id: courier.id,
            kind: 'selfie',
            storage_path: `courier/${courier.id}/selfie_base.png`,
            status: 'verified',
            is_current: true,
          },
          {
            courier_id: courier.id,
            kind: 'license',
            storage_path: `courier/${courier.id}/license_base.png`,
            status: 'submitted',
            is_current: true,
            rejection_code: null,
          },
        ])
        .select('id, kind');

      if (insertErr || !insertedDocs) {
        throw new Error(`[E2E Error] Falló inserción de documentos base: ${insertErr?.message}`);
      }

      const licenseDoc = insertedDocs.find((d) => d.kind === 'license');
      if (!licenseDoc) {
        throw new Error('[E2E Error] No se encontró el documento de licencia insertado');
      }

      // 2. PR358-R03: Rechazar la licencia mediante la RPC real admin_verify_document con AAL2 y nota centinela privada
      const admin = await seedAdminUser(stagingContext);
      const { secret: totpSecret, client: adminClient } = await enrollAdminTotpFactor(admin);

      const sentinelPrivateNote = `PRIVATE_SENTINEL_NOTE_${stagingContext.testRunId}`;
      const { data: rejectData, error: rejectError } = await adminClient.rpc(
        'admin_verify_document',
        {
          p_document_id: licenseDoc.id,
          p_decision: 'rejected',
          p_reason: sentinelPrivateNote,
          p_rejection_code: 'illegible',
        }
      );

      expect(rejectError).toBeNull();
      expect(rejectData).toMatchObject({
        documentId: licenseDoc.id,
        status: 'rejected',
        rejectionCode: 'illegible',
      });

      // 3. Iniciar sesión como repartidor y navegar a /courier/profile
      await loginAsCourier(0, page);
      await page.goto('/courier/profile');
      await waitForNoSkeletons(page);

      // 4. Verificar estado UI:
      // DNI y Selfie figuran como validados
      await expect(page.getByText('Validado por admin').first()).toBeVisible();

      // Licencia figura como «Rechazado / requiere corrección» y muestra el motivo seguro del catálogo
      await expect(page.getByText('Rechazado / requiere corrección').first()).toBeVisible();
      await expect(page.getByText('Documento borroso, ilegible o cortado.')).toBeVisible();

      // Invariante PR358-R03: la nota interna centinela jamás se filtra en el DOM del cliente
      const pageHtml = await page.content();
      expect(pageHtml).not.toContain(sentinelPrivateNote);

      // Solo la licencia ofrece el botón/acción «Reemplazar»
      const replaceLicenseInput = page.locator('#file-input-license');
      await expect(replaceLicenseInput).toBeAttached();

      // 5. Subir nuevo archivo para la licencia
      await replaceLicenseInput.setInputFiles({
        name: 'licencia_corregida.png',
        mimeType: 'image/png',
        buffer: DUMMY_2X2_PNG,
      });

      // La tarjeta transiciona a «En revisión manual» con mensaje de éxito confirmado
      const successBadge = page
        .locator('[data-slot="document-replacement-card"][data-kind="license"]')
        .getByText(COURIER_ONBOARDING_COPY.underReviewBadge);
      await expect(successBadge).toBeVisible({ timeout: 20000 });

      const successMsg = page.getByText(COURIER_ONBOARDING_COPY.documentReplacedSuccess);
      await expect(successMsg).toBeVisible();

      // 6. PR358-R03: Inspección administrativa en el navegador de la nueva versión submitted y versión histórica
      await page.context().clearCookies();
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });

      await page.goto(`/login?redirectTo=%2Fadmin%2Fapplicants%2F${courier.id}`);
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

      // Doble factor TOTP en navegador
      await page.waitForURL((url) => url.pathname.includes('/login/mfa'), { timeout: 15000 });
      await waitForNoSkeletons(page);

      const totpInput = page.locator('#totp-code');
      await expect(totpInput).toBeVisible();
      const totpCode = generateTotp(totpSecret);
      await totpInput.fill(totpCode);

      const verifyMfaBtn = page.getByRole('button', {
        name: new RegExp(ADMIN_COPY.mfa.verifyButton, 'i'),
      });
      await expect(verifyMfaBtn).toBeVisible();
      await verifyMfaBtn.click();

      await page.waitForURL((url) => url.pathname.includes(`/admin/applicants/${courier.id}`), {
        timeout: 15000,
      });
      await waitForNoSkeletons(page);

      // Verificación en consola de administración:
      // A) Pestaña histórica marcada como (Histórico) y botones deshabilitados
      const historicalTab = page.getByRole('tab', { name: /Licencia de Conducir.*Histórico/i });
      await expect(historicalTab).toBeVisible();

      // B) Pestaña vigente sin (Histórico)
      const currentTab = page.getByRole('tab', { name: /^Licencia de Conducir$/i });
      await expect(currentTab).toBeVisible();

      // Al seleccionar la pestaña histórica:
      await historicalTab.click();
      await expect(page.getByText('Documento histórico (no admite revisión).')).toBeVisible();

      const rejectDocBtn = page.getByRole('button', {
        name: new RegExp(ADMIN_COPY.detail.rejectDocument, 'i'),
      });
      const verifyDocBtn = page.getByRole('button', {
        name: new RegExp(ADMIN_COPY.detail.verifyDocument, 'i'),
      });
      await expect(rejectDocBtn).toBeDisabled();
      await expect(verifyDocBtn).toBeDisabled();

      // Al seleccionar la versión vigente:
      await currentTab.click();
      await expect(page.getByText('Documento histórico (no admite revisión).')).not.toBeVisible();
      await expect(page.getByText('En revisión')).toBeVisible();
      await expect(rejectDocBtn).toBeEnabled();
      await expect(verifyDocBtn).toBeEnabled();

      // 7. Verificación estricta en base de datos:
      const { data: licenseRows } = await dbAdmin
        .from('courier_documents')
        .select('id, kind, status, is_current, storage_path, rejection_code')
        .eq('courier_id', courier.id)
        .eq('kind', 'license')
        .order('uploaded_at', { ascending: false });

      expect(licenseRows).toHaveLength(2);
      // El documento nuevo es el vigente en estado submitted
      expect(licenseRows?.[0]?.is_current).toBe(true);
      expect(licenseRows?.[0]?.status).toBe('submitted');
      expect(licenseRows?.[0]?.rejection_code).toBeNull();
      expect(licenseRows?.[0]?.storage_path).toMatch(
        new RegExp(`^courier/${courier.id}/license_\\d+\\.png$`)
      );

      // El documento anterior pasó a histórico (is_current = false) conservando estado rejected
      expect(licenseRows?.[1]?.is_current).toBe(false);
      expect(licenseRows?.[1]?.status).toBe('rejected');
      expect(licenseRows?.[1]?.rejection_code).toBe('illegible');

      // Los otros documentos continúan vigentes e inalterados
      const { data: otherRows } = await dbAdmin
        .from('courier_documents')
        .select('kind, status, is_current')
        .eq('courier_id', courier.id)
        .in('kind', ['dni_front', 'dni_back', 'selfie']);

      expect(otherRows).toHaveLength(3);
      for (const row of otherRows ?? []) {
        expect(row.status).toBe('verified');
        expect(row.is_current).toBe(true);
      }
    } finally {
      // Limpieza de datos en DB y Storage
      await resetCourierToPendingOnboarding(courier.id);
      const { data: files } = await dbAdmin.storage
        .from(COURIER_DOCS_BUCKET)
        .list(`courier/${courier.id}`);
      if (files && files.length > 0) {
        await dbAdmin.storage
          .from(COURIER_DOCS_BUCKET)
          .remove(files.map((f) => `courier/${courier.id}/${f.name}`));
      }
    }
  });
});
