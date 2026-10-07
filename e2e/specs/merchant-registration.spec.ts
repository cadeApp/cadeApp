import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  test as roleTest,
  expect,
  assertAllowedE2EEnvironment,
  cleanupStagingData,
  createStagingSeedContext,
  trackEntityForCleanup,
  type StagingSeedContext,
} from '../fixtures';
import { LoginPage } from '../pages';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { getLegalDocument } from '@/features/legal/documents';

/**
 * T-313: E2E de registro de comercio y consentimientos.
 *
 * DoD:
 * 1. Alta completa y panel visible.
 * 2. Versión de consentimiento registrada (tos + privacy en el alta, pilot_terms en el onboarding).
 * 3. Un courier no entra a `(merchant)`.
 * 4. Falla si no se guarda el consentimiento: una cuenta sin consentimientos no llega al panel.
 *
 * Datos: cada caso crea sus propios usuarios (UI o fixture) y los limpia con `cleanupStagingData`.
 * Credenciales solo en memoria; nunca datos reales.
 */

interface LocalRegistrationContext extends StagingSeedContext {
  pendingCleanupEmails: Set<string>;
}

interface RegistrationFixtures {
  /** Contexto propio, sin seed previo: el usuario lo crea el flujo probado y se registra para limpieza. */
  registrationContext: LocalRegistrationContext;
}

const test = roleTest.extend<RegistrationFixtures>({
  registrationContext: async ({}, use) => {
    assertAllowedE2EEnvironment();
    const baseContext = createStagingSeedContext();
    const context: LocalRegistrationContext = Object.assign(baseContext, {
      pendingCleanupEmails: new Set<string>(),
    });
    let testError: unknown = null;
    try {
      await use(context);
    } catch (error) {
      testError = error;
      throw error;
    } finally {
      let cleanupPhaseError: unknown = null;
      try {
        if (context.pendingCleanupEmails.size > 0) {
          const admin = createAdminClient();
          for (const targetEmail of context.pendingCleanupEmails) {
            let page = 1;
            const perPage = 50;
            let foundUserId: string | null = null;
            while (true) {
              const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage });
              if (listError) {
                throw new Error(`[E2E Admin Error] listUsers: ${listError.message}`);
              }
              const match = data.users.find((u) => u.email === targetEmail);
              if (match) {
                foundUserId = match.id;
                break;
              }
              if (!data.nextPage || data.users.length < perPage) {
                break;
              }
              page++;
            }
            if (foundUserId) {
              trackEntityForCleanup(context, 'user', foundUserId);
            }
          }
        }
        await cleanupStagingData(context);
      } catch (cleanupErr) {
        cleanupPhaseError = cleanupErr;
      }

      if (cleanupPhaseError) {
        if (testError) {
          const combined = new Error(
            `[E2E Lifecycle Error] Falló la ejecución principal y el cleanup posterior.\n` +
              `Error principal: ${testError instanceof Error ? testError.message : String(testError)}\n` +
              `Error de cleanup: ${cleanupPhaseError instanceof Error ? cleanupPhaseError.message : String(cleanupPhaseError)}`,
            { cause: testError }
          );
          throw combined;
        } else {
          throw cleanupPhaseError;
        }
      }
    }
  },
});

const MERCHANT_PANEL_HEADING = /mis solicitudes/i;

function uniqueEmail(context: StagingSeedContext, suffix: string): string {
  return `e2e_${context.testRunId}_${suffix}@cadeapp-staging.test`;
}

function uniquePassword(): string {
  return `P@ssword_${randomUUID()}!`;
}

async function findProfileIdByDisplayName(displayName: string): Promise<string> {
  const admin = createAdminClient();
  let foundId: string | null = null;
  await expect
    .poll(
      async () => {
        const { data, error } = await admin
          .from('profiles')
          .select('id')
          .eq('display_name', displayName)
          .maybeSingle();
        if (error) throw new Error(`[E2E Query Error] profiles: ${error.message}`);
        foundId = data?.id ?? null;
        return foundId;
      },
      { message: 'El alta por UI tiene que crear el profile del comercio' }
    )
    .not.toBeNull();
  if (!foundId) throw new Error('[E2E Error] Profile del alta no encontrado');
  return foundId;
}

async function readConsentState(profileId: string) {
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: consents, error: consentsError }] =
    await Promise.all([
      admin.from('profiles').select('role, consent_status').eq('id', profileId).maybeSingle(),
      admin.from('consents').select('document, version').eq('profile_id', profileId),
    ]);
  if (profileError) throw new Error(`[E2E Query Error] profiles: ${profileError.message}`);
  if (consentsError) throw new Error(`[E2E Query Error] consents: ${consentsError.message}`);
  return { profile, consents: consents ?? [] };
}

async function readMerchantOnboardingDiagnostic(profileId: string, businessName: string) {
  const admin = createAdminClient();
  const [
    { data: setting, error: settingError },
    { data: pilotConsent, error: pilotConsentError },
    { data: profile, error: profileError },
    { data: merchant, error: merchantError },
  ] = await Promise.all([
    admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'pilot_terms_version')
      .maybeSingle(),
    admin
      .from('consents')
      .select('version')
      .eq('profile_id', profileId)
      .eq('document', 'pilot_terms')
      .maybeSingle(),
    admin
      .from('profiles')
      .select('display_name')
      .eq('id', profileId)
      .maybeSingle(),
    admin
      .from('merchants')
      .select('business_name, default_pickup_address, subscription_status')
      .eq('profile_id', profileId)
      .maybeSingle(),
  ]);
  if (settingError) {
    throw new Error(`[E2E Query Error] platform_settings:${settingError.code}`);
  }
  if (pilotConsentError) {
    throw new Error(`[E2E Query Error] consents:${pilotConsentError.code}`);
  }
  if (profileError) {
    throw new Error(`[E2E Query Error] profiles:${profileError.code}`);
  }
  if (merchantError) {
    throw new Error(`[E2E Query Error] merchants:${merchantError.code}`);
  }
  return {
    settingVersion: String(setting?.value ?? 'missing'),
    pilotConsentVersion: pilotConsent?.version ?? 'missing',
    profileUpdated: profile?.display_name === businessName,
    merchantUpdated:
      merchant?.business_name === businessName &&
      merchant?.default_pickup_address === 'Alberdi 150, Aguilares' &&
      merchant?.subscription_status === 'pilot',
  };
}

async function expectMerchantPanelBlocked(page: Page, path: string, expectedUrl: RegExp) {
  await page.goto(path);
  await expect(page).toHaveURL(expectedUrl);
  await waitForNoSkeletons(page);
  await expect(page.getByRole('heading', { name: MERCHANT_PANEL_HEADING })).toHaveCount(0);
}

test.describe('T-313 — E2E de registro de comercio y consentimientos', () => {
  // ---------------------------------------------------------------------------
  // DoD 1 y 2: Alta completa, panel visible y versión de consentimiento registrada
  // ---------------------------------------------------------------------------
  test('DoD: Alta completa y panel visible con la versión de consentimiento registrada', async ({
    page,
    registrationContext,
  }) => {
    const displayName = `E2E Alta ${registrationContext.testRunId}`;
    const businessName = `E2E Comercio Alta ${registrationContext.testRunId}`;
    const email = uniqueEmail(registrationContext, 'alta');
    const password = uniquePassword();

    // 1. Alta por UI como comercio, aceptando Términos y Privacidad
    await page.goto('/register');
    await waitForNoSkeletons(page);
    const merchantRole = page.getByRole('button', { name: /tengo un comercio/i });
    await merchantRole.click();
    await expect(merchantRole).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel(/^nombre y apellido$/i).fill(displayName);
    await page.getByLabel(/^teléfono$/i).fill('+5493865000099');
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^contraseña$/i).fill(password);
    await page
      .getByRole('checkbox', { name: /acepto los términos y la política de privacidad/i })
      .check();
    registrationContext.pendingCleanupEmails.add(email);
    await page.getByRole('button', { name: /^crear cuenta$/i }).click();

    const registrationError = page.locator('form').getByRole('alert');
    await expect(registrationError).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /revisá tu email/i })).toBeVisible();

    // 2. El alta quedó en la base: se registra para limpieza antes de cualquier aserción
    const profileId = await findProfileIdByDisplayName(displayName);
    trackEntityForCleanup(registrationContext, 'user', profileId);

    // 3. Consentimiento registrado con la versión publicada que la persona vio
    const afterSignup = await readConsentState(profileId);
    expect(afterSignup.profile?.role).toBe('merchant');
    expect(afterSignup.profile?.consent_status).toBe('active');
    expect(afterSignup.consents).toEqual(
      expect.arrayContaining([
        { document: 'tos', version: getLegalDocument('tos').version },
        { document: 'privacy', version: getLegalDocument('privacy').version },
      ])
    );

    // 4. El ambiente puede exigir confirmación de email: se confirma por fixture (no es el flujo probado)
    const admin = createAdminClient();
    const { error: confirmError } = await admin.auth.admin.updateUserById(profileId, {
      email_confirm: true,
    });
    if (confirmError) {
      throw new Error(`[E2E Fixture Error] No se pudo confirmar el email: ${confirmError.message}`);
    }

    // 5. Primer ingreso: con onboarding incompleto el destino es el onboarding del comercio
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(email, password);
    await expect(page).toHaveURL(/\/merchant\/onboarding/);

    // 6. Onboarding completo aceptando los Términos del piloto
    await page.getByLabel(/^nombre del negocio$/i).fill(businessName);
    await page.getByLabel(/^teléfono de contacto$/i).fill('+5493865000099');
    await page.getByRole('combobox', { name: /barrio de retiro habitual/i }).click();
    await page.getByRole('option').first().click();
    await page.getByLabel(/^dirección de retiro habitual$/i).fill('Alberdi 150, Aguilares');
    await page.getByRole('checkbox', { name: /acepto los términos del piloto/i }).check();
    await page.getByRole('button', { name: /^empezar$/i }).click();

    // 7. Panel del comercio visible
    try {
      await expect(page).toHaveURL(/\/merchant\/dashboard/);
    } catch (navigationError) {
      const diagnostic = await readMerchantOnboardingDiagnostic(profileId, businessName);
      throw new Error(
        '[T-313 Onboarding Diagnostic] ' +
          `setting=${diagnostic.settingVersion}; ` +
          `pilotConsent=${diagnostic.pilotConsentVersion}; ` +
          `profileUpdated=${diagnostic.profileUpdated}; ` +
          `merchantUpdated=${diagnostic.merchantUpdated}\n` +
          `Navigation: ${navigationError instanceof Error ? navigationError.message : String(navigationError)}`
      );
    }
    await waitForNoSkeletons(page);
    await expect(page.getByRole('heading', { name: MERCHANT_PANEL_HEADING })).toBeVisible();

    // 8. Oráculo de base: comercio en piloto y versión de los Términos del piloto registrada
    const { data: merchant, error: merchantError } = await admin
      .from('merchants')
      .select('business_name, subscription_status')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (merchantError) throw new Error(`[E2E Query Error] merchants: ${merchantError.message}`);
    expect(merchant).toEqual({ business_name: businessName, subscription_status: 'pilot' });

    const afterOnboarding = await readConsentState(profileId);
    expect(afterOnboarding.consents).toEqual(
      expect.arrayContaining([
        { document: 'tos', version: getLegalDocument('tos').version },
        { document: 'privacy', version: getLegalDocument('privacy').version },
        { document: 'pilot_terms', version: getLegalDocument('pilot_terms').version },
      ])
    );
  });

  // ---------------------------------------------------------------------------
  // DoD 3: Un courier no entra a (merchant)
  // ---------------------------------------------------------------------------
  test('DoD: Un courier no entra a (merchant)', async ({ page, loginAsCourier }) => {
    await loginAsCourier(0, page);

    const routes: Array<{ path: string; expectedUrl: RegExp }> = [
      { path: '/merchant/dashboard', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/history', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/onboarding', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/plan', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/requests', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/requests/new', expectedUrl: /\/courier\/feed/ },
      { path: '/merchant/requests/e2e-denied', expectedUrl: /\/courier\/feed/ },
      { path: '/onboarding', expectedUrl: /\/courier\/onboarding\/identity/ },
      { path: '/requests', expectedUrl: /\/courier\/feed/ },
      { path: '/requests/new', expectedUrl: /\/courier\/feed/ },
      { path: '/requests/e2e-denied', expectedUrl: /\/courier\/feed/ },
    ];

    for (const { path, expectedUrl } of routes) {
      await expectMerchantPanelBlocked(page, path, expectedUrl);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 4: Falla si no se guarda el consentimiento
  // ---------------------------------------------------------------------------
  test('DoD: Sin consentimiento guardado el comercio no llega al panel', async ({
    page,
    registrationContext,
  }) => {
    const email = uniqueEmail(registrationContext, 'sin_consentimiento');
    const password = uniquePassword();

    // 1. Cuenta de comercio creada sin pasar por activate_account_consents (consentimiento no guardado)
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'merchant',
        display_name: `E2E Sin Consentimiento ${registrationContext.testRunId}`,
        phone: '+5493865000098',
      },
    });
    if (createError || !created.user) {
      throw new Error(
        `[E2E Fixture Error] No se pudo crear el comercio: ${createError?.message ?? 'sin usuario'}`
      );
    }
    const profileId = created.user.id;
    trackEntityForCleanup(registrationContext, 'user', profileId);

    const state = await readConsentState(profileId);
    expect(state.profile?.role).toBe('merchant');
    expect(state.profile?.consent_status).toBe('pending');
    expect(state.consents).toEqual([]);

    // 2. El ingreso no lleva al panel: pide consentimiento
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.emailInput.fill(email);
    await loginPage.passwordInput.fill(password);
    await loginPage.submitButton.click();
    await expect(page).toHaveURL(/\/login\?consentRequired=1/);

    // 3. Forzar la navegación a (merchant) tampoco entra
    for (const path of ['/merchant/dashboard', '/merchant/onboarding', '/merchant/requests/new']) {
      await expectMerchantPanelBlocked(page, path, /\/login\?consentRequired=1/);
    }
  });
});
