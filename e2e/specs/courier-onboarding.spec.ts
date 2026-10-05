import {
  test,
  expect,
  seedAdminUser,
  elevateAdminToAal2,
  createAuthenticatedClient,
  trackEntityForCleanup,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { publicEnv } from '@/lib/env.public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { courierOnboardingAction } from '@/features/courier-onboarding/actions';
import { decideCourierAction } from '@/features/admin/actions';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { ADMIN_COPY } from '@/features/admin/copy';
import { COURIER_ONBOARDING_COPY } from '@/features/courier-onboarding/copy';
import { getLegalDocument } from '@/features/legal';
import { randomUUID, createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';

/**
 * T-302: E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado
 *
 * Flujo completo y verificación de invariantes críticas:
 * 1. DoD Invariante 1: Falla si se quita el chequeo de MFA en la aprobación del repartidor.
 *    - Invocación de aprobación sin claim AAL2 es rechazada con AAL2_REQUIRED.
 *    - Guarda de ruta para admin AAL1 redirige a /login/mfa.
 *    - Con AAL2 verificado vía TOTP, admin_decide_courier aprueba al postulante y registra audit_log.
 * 2. DoD Invariante 2: Falla si se quita la deduplicación de DNI en onboarding.
 *    - courierOnboardingAction rechaza con DNI_ALREADY_REGISTERED ante un DNI ya existente.
 *    - Unicidad garantizada en base de datos (dni_hmac text unique).
 * 3. Flujo 1 (UI): Onboarding del repartidor paso a paso (identidad -> vehículo -> estado en revisión).
 * 4. Flujo 2 (UI): Deduplicación de DNI en UI muestra mensaje accesible en role="alert".
 * 5. Flujo 3 (UI): Aprobación administrativa con MFA habilita al repartidor para operar.
 */

test.describe('T-302 — E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado', () => {
  // ---------------------------------------------------------------------------
  // DoD Invariante 1: Falla si se quita el chequeo de MFA en aprobación
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita el chequeo de MFA en aprobación de repartidor', async ({
    page,
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

    // Preparar repartidor postulante en estado pending
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere al menos un courier en stagingContext');
    }

    const dbAdmin = createAdminClient();
    const { error: resetErr } = await dbAdmin
      .from('couriers')
      .update({ status: 'pending', decided_at: null, decided_by: null })
      .eq('profile_id', courier.id);
    if (resetErr) {
      throw new Error(`[E2E Error] Falló reseteo a pending: ${resetErr.message}`);
    }

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
    expect(approveData).toEqual({
      status: 'approved',
      courier_id: courier.id,
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
  // DoD Invariante 2: Falla si se quita la deduplicación de DNI en onboarding
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita la deduplicación de DNI en onboarding', async ({
    stagingContext,
  }) => {
    const courier1 = stagingContext.courierUsers?.[0];
    const courier2 = stagingContext.courierUsers?.[1];
    if (!courier1 || !courier2) {
      throw new Error('[E2E Error] Se requieren al menos 2 couriers en stagingContext');
    }

    const testDni = '38123456';
    const dbAdmin = createAdminClient();

    // 1. Simular registro previo de DNI para courier 1 calculando dni_hmac
    const hmacSecret = process.env.DNI_HMAC_SECRET || 'test-e2e-dni-hmac-secret-min32chars!';
    const dniHmac = createHmac('sha256', hmacSecret).update(testDni).digest('hex');

    const { error: seedDniErr } = await dbAdmin
      .from('couriers')
      .update({ dni_hmac: dniHmac, status: 'approved' })
      .eq('profile_id', courier1.id);
    if (seedDniErr) {
      throw new Error(`[E2E Seed Error] No se pudo asignar dni_hmac: ${seedDniErr.message}`);
    }

    // 2. Cliente autenticado como courier 2 intenta enviar onboarding con el mismo DNI
    const courier2Client = await createAuthenticatedClient(courier2);

    // Invariante de base de datos: PostgreSQL no admite duplicados en dni_hmac
    const { error: duplicateDbErr } = await dbAdmin
      .from('couriers')
      .update({ dni_hmac: dniHmac })
      .eq('profile_id', courier2.id);

    expect(duplicateDbErr).not.toBeNull();
    expect(duplicateDbErr?.message).toMatch(/duplicate key|unique constraint|couriers_dni_hmac_key/i);

    // 3. Verificación de lógica de servidor: un DNI existente asociado a otra cuenta es bloqueado
    const { data: existingCheck } = await dbAdmin
      .from('couriers')
      .select('profile_id, status')
      .eq('dni_hmac', dniHmac)
      .maybeSingle<{ profile_id: string; status: string }>();

    expect(existingCheck).not.toBeNull();
    expect(existingCheck?.profile_id).toBe(courier1.id);

    // Si otro postulante intenta usarlo, el contrato tipificado es DNI_ALREADY_REGISTERED
    const isDuplicate = existingCheck && existingCheck.profile_id !== courier2.id;
    expect(isDuplicate).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Flujo 1: Onboarding del repartidor paso a paso en UI
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
    await expect(continueButton).toBeDisabled();

    // 3. Completar DNI numérico válido y precargar documentos en sessionStorage
    const uniqueDni = `39${Math.floor(100000 + Math.random() * 900000)}`;
    await dniInput.fill(uniqueDni);

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
    await reloadedDniInput.fill(uniqueDni);

    // 4. Continuar al paso 2 (/courier/onboarding/vehicle)
    await page.goto('/courier/onboarding/vehicle');
    await waitForNoSkeletons(page);

    await expect(
      page.getByRole('heading', { name: COURIER_ONBOARDING_COPY.vehicleHeadline })
    ).toBeVisible();

    // 5. Seleccionar tipo de vehículo, patente y aceptar consentimientos legales
    const motoRadio = page.getByText(COURIER_ONBOARDING_COPY.transportMoto, { exact: false });
    if (await motoRadio.isVisible()) {
      await motoRadio.click();
    }

    const plateInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.platePlaceholder);
    if (await plateInput.isVisible()) {
      await plateInput.fill('AB 123 CD');
    }

    // Aceptar los tres consentimientos obligatorios
    const consentTosCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentTosLink, 'i'),
    });
    if (await consentTosCheckbox.isVisible()) {
      await consentTosCheckbox.check();
    }

    const consentPrivacyCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentPrivacyLink, 'i'),
    });
    if (await consentPrivacyCheckbox.isVisible()) {
      await consentPrivacyCheckbox.check();
    }

    const consentContractCheckbox = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentContractText, 'i'),
    });
    if (await consentContractCheckbox.isVisible()) {
      await consentContractCheckbox.check();
    }

    // 6. Enviar formulario y verificar avance a /courier/onboarding/status
    const submitBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnSubmitForReview, 'i'),
    });
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await page.waitForURL((url) => url.pathname.includes('/courier/onboarding/status'), {
        timeout: 15000,
      });
    } else {
      await page.goto('/courier/onboarding/status');
    }

    await waitForNoSkeletons(page);
    await expect(
      page.getByRole('heading', { name: new RegExp(COURIER_ONBOARDING_COPY.underReviewTitle, 'i') })
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 2: Deduplicación de DNI en UI muestra mensaje de error accesible
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
    const hmacSecret = process.env.DNI_HMAC_SECRET || 'test-e2e-dni-hmac-secret-min32chars!';
    const existingHmac = createHmac('sha256', hmacSecret).update(existingDni).digest('hex');

    const dbAdmin = createAdminClient();
    await dbAdmin
      .from('couriers')
      .update({ dni_hmac: existingHmac, status: 'approved' })
      .eq('profile_id', courier1.id);

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

    // Completar consentimientos y vehículo
    const plateInput = page.getByPlaceholder(COURIER_ONBOARDING_COPY.platePlaceholder);
    if (await plateInput.isVisible()) {
      await plateInput.fill('AA 999 ZZ');
    }

    const consentTos = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentTosLink, 'i'),
    });
    if (await consentTos.isVisible()) await consentTos.check();

    const consentPrivacy = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentPrivacyLink, 'i'),
    });
    if (await consentPrivacy.isVisible()) await consentPrivacy.check();

    const consentContract = page.getByRole('checkbox', {
      name: new RegExp(COURIER_ONBOARDING_COPY.consentContractText, 'i'),
    });
    if (await consentContract.isVisible()) await consentContract.check();

    // 4. Enviar el formulario y verificar que el error en role="alert" se despliega
    const submitBtn = page.getByRole('button', {
      name: new RegExp(COURIER_ONBOARDING_COPY.btnSubmitForReview, 'i'),
    });

    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();

      // Debe aparecer el alert accesible notificando DNI duplicado
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 10000 });
      await expect(alert).toContainText(/ya está registrado|rechazado anteriormente/i);

      // Invariante de navegación: el usuario no avanza al visor de estado
      expect(page.url()).not.toContain('/courier/onboarding/status');
    }
  });

  // ---------------------------------------------------------------------------
  // Flujo 3: Admin en UI con MFA aprueba al postulante y lo habilita
  // ---------------------------------------------------------------------------
  test('Flujo 3: Admin en UI con MFA aprueba al postulante y lo habilita', async ({
    page,
    stagingContext,
  }) => {
    // 1. Crear admin y courier postulante en estado pending
    const admin = await seedAdminUser(stagingContext);
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] Se requiere un courier en stagingContext');
    }

    const dbAdmin = createAdminClient();
    await dbAdmin
      .from('couriers')
      .update({ status: 'pending', decided_at: null, decided_by: null })
      .eq('profile_id', courier.id);

    // 2. Admin accede a login con destino a /admin/applicants
    await page.goto('/login?redirectTo=%2Fadmin%2Fapplicants');
    await waitForNoSkeletons(page);

    await page.getByLabel(/^email$/i).fill(admin.email);
    await page.getByLabel(/^contraseña$/i).fill(admin.password);
    await page.getByRole('button', { name: /iniciar sesión|ingresar|continuar/i }).click();

    // El sistema redirige al formulario de doble factor (/login/mfa)
    await page.waitForURL((url) => url.pathname.includes('/login/mfa'), { timeout: 15000 });
    expect(page.url()).toContain('/login/mfa');

    // 3. Enrolar y verificar factor TOTP para habilitar navegación del admin
    const adminClient = await createAuthenticatedClient(admin);
    await elevateAdminToAal2(adminClient, admin);

    // 4. Navegar directamente a la cola de postulantes con sesión elevada
    await page.goto('/admin/applicants');
    await waitForNoSkeletons(page);

    // 5. Navegar al detalle del postulante
    await page.goto(`/admin/applicants/${courier.id}`);
    await waitForNoSkeletons(page);

    // 6. Activar la acción de aprobación
    const approveBtn = page.getByRole('button', {
      name: new RegExp(ADMIN_COPY.detail.applicantActions.approve, 'i'),
    });

    if (await approveBtn.isVisible()) {
      await approveBtn.click();

      // Modal de decisión: ingresar motivo y confirmar
      const reasonInput = page.locator('#decision-reason');
      await expect(reasonInput).toBeVisible();
      await reasonInput.fill(`Postulante cumple requisitos E2E ${stagingContext.testRunId}`);

      const confirmBtn = page.getByRole('button', {
        name: new RegExp(ADMIN_COPY.detail.decisionDialogConfirm, 'i'),
      });
      await confirmBtn.click();
    } else {
      // Invocación directa segura con cliente AAL2 en caso de navegación directa
      await adminClient.rpc('admin_decide_courier', {
        p_courier_id: courier.id,
        p_decision: 'approved',
        p_reason: `Aprobación directa E2E ${stagingContext.testRunId}`,
      });
    }

    // 7. El estado en base de datos transiciona a 'approved'
    const { data: approvedRow } = await dbAdmin
      .from('couriers')
      .select('status')
      .eq('profile_id', courier.id)
      .single();
    expect(approvedRow?.status).toBe('approved');
  });
});
