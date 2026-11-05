import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedAdminUser,
  seedStagingData,
  createAuthenticatedClient,
  generateTotp,
  type StagingSeedContext,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { createAdminClient } from '@/server/supabase/admin';
import { AdminPage, LoginPage } from '../pages';

/**
 * T-403: la búsqueda de la cola de postulantes se resuelve en PostgreSQL sin tildes (CC-044) y el contador de la
 * pestaña cuenta solo postulaciones enviadas (CC-043). Un postulante «José …» se encuentra buscando «jose …», el
 * contador refleja su alta en «Pendientes» y una cuenta homónima sin envío no aparece.
 */

/** Admin con un factor TOTP verificado; devuelve el secreto para pasar el segundo paso en el navegador. */
async function seedAdminWithTotp(context: StagingSeedContext): Promise<{
  credentials: UserCredentials;
  totpSecret: string;
}> {
  const credentials = await seedAdminUser(context);
  const client = await createAuthenticatedClient(credentials);
  const { data: enrolled, error: enrollErr } = await client.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollErr || !enrolled?.totp?.secret) {
    throw new Error(`[E2E MFA Error] Error al enrolar TOTP: ${enrollErr?.message}`);
  }
  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: generateTotp(enrolled.totp.secret),
  });
  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Error al verificar TOTP inicial: ${verifyErr.message}`);
  }
  return { credentials, totpSecret: enrolled.totp.secret };
}

async function loginAdminWithMfa(page: Page, credentials: UserCredentials, totpSecret: string) {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await waitForFormHydration(loginPage.submitButton);
  await loginPage.emailInput.fill(credentials.email);
  await loginPage.passwordInput.fill(credentials.password);
  await loginPage.submitButton.click();
  await page.waitForURL(/\/login\/mfa/);

  const codeInput = page.getByLabel(/código de seguridad/i);
  await waitForFormHydration(codeInput);
  await codeInput.fill(generateTotp(totpSecret));
  await page.getByRole('button', { name: /verificar/i }).click();
  await page.waitForURL(/\/admin/);
}

async function renameProfile(profileId: string, displayName: string): Promise<void> {
  const { error } = await createAdminClient().from('profiles').update({ display_name: displayName }).eq('id', profileId);
  if (error) throw new Error(`[E2E Seed Error] No se pudo renombrar ${profileId}: ${error.message}`);
}

test.describe('T-403 — búsqueda sin tildes y contador de postulantes', () => {
  test('«jose» encuentra a «José», el contador refleja su alta y una cuenta sin envío no cuenta', async ({
    page,
    stagingContext,
  }) => {
    test.setTimeout(150_000);

    // Token único de la corrida: aísla la búsqueda de las demás pruebas que comparten Supabase Develop.
    const token = stagingContext.testRunId.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const applicant = stagingContext.courierUsers?.[1];
    if (!applicant) throw new Error('[E2E Error] Se requiere un segundo courier en stagingContext');

    // El courier sembrado ya envió su postulación (seed de T-421); se lo nombra con tildes y sigue aprobado.
    await renameProfile(applicant.id, `José Búsqueda ${token}`);

    // Una cuenta homónima que nunca envió la postulación pero ya cargó un vehículo (DNI nulo: la guarda de CC-043 lo
    // permite sin marcar el envío, como el alta de vehículo de CC-042). Distingue application_submitted de
    // vehicle_type: una cola que filtrara por vehículo la contaría.
    const seededCount = stagingContext.courierUsers?.length ?? 0;
    await seedStagingData(stagingContext, { couriersCount: seededCount + 1, courierApplication: 'not_submitted' });
    const unsubmitted = stagingContext.courierUsers?.[seededCount];
    if (!unsubmitted) throw new Error('[E2E Seed Error] No se sembró la cuenta sin envío');
    await renameProfile(unsubmitted.id, `José Búsqueda ${token} sin envío`);
    const { data: partialCourier, error: partialError } = await createAdminClient()
      .from('couriers')
      .update({ vehicle_type: 'moto', vehicle_plate: 'AE 002 EE', dni_hmac: null })
      .eq('profile_id', unsubmitted.id)
      .select('status, vehicle_type, vehicle_plate, dni_hmac, application_submitted, submitted_at')
      .single();
    if (partialError || !partialCourier) {
      throw new Error(`[E2E Seed Error] No se persistió el vehículo sin envío: ${partialError?.message ?? 'sin fila'}`);
    }
    expect(partialCourier).toMatchObject({
      status: 'pending',
      vehicle_type: 'moto',
      vehicle_plate: 'AE 002 EE',
      dni_hmac: null,
      application_submitted: false,
      submitted_at: null,
    });

    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);
    await page.goto('/admin/applicants?tab=pending');
    await waitForNoSkeletons(page);

    const admin = new AdminPage(page);
    const searchTerm = `jose busqueda ${token}`;

    // 1. Antes del alta en «Pendientes»: el aprobado no cuenta y la cuenta sin envío tampoco.
    await admin.searchApplicants(searchTerm);
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(searchTerm).replace(/%20/g, '(\\+|%20)')}`));
    await expect(admin.applicantsCount).toHaveText('0 pendientes');
    await expect(page.getByText(`No encontramos postulantes con «${searchTerm}»`)).toBeVisible();

    // 2. Alta del postulante en «Pendientes».
    const { error: pendingErr } = await createAdminClient()
      .from('couriers')
      .update({ status: 'pending' })
      .eq('profile_id', applicant.id);
    if (pendingErr) throw new Error(`[E2E Seed Error] No se pudo pasar a pendiente: ${pendingErr.message}`);

    await page.reload();
    await waitForNoSkeletons(page);

    // 3. «jose» (sin tilde) encuentra a «José Búsqueda …»; el contador lo refleja y la cuenta sin envío no aparece.
    await expect(admin.applicantsCount).toHaveText('1 pendiente');
    const rows = page.getByRole('row').filter({ hasText: `José Búsqueda ${token}` });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).not.toContainText('sin envío');
    // «Enviado» sale de submitted_at (envío reciente del seed), con la fecha completa en <time>.
    await expect(rows.first().locator('time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);

    // 4. La búsqueda se mantiene al cambiar de pestaña.
    await page.getByRole('tab', { name: 'Aprobados' }).click();
    await page.waitForURL(/tab=approved/);
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(admin.applicantsCount).toHaveText('0 aprobados');
  });
});
