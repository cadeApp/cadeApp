import type { Page } from '@playwright/test';
import {
  test,
  expect,
  seedAdminUser,
  createAuthenticatedClient,
  generateTotp,
  type StagingSeedContext,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { LoginPage } from '../pages';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-380 / CC-034: reactivar un repartidor suspendido desde el detalle del admin.
 *
 * DoD:
 * 1. El admin (con MFA) suspende al repartidor y después lo reactiva con motivo; ve «Aprobado».
 * 2. El repartidor vuelve aprobado y sin disponibilidad: al activarla vuelve a ver el feed.
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

/** Abre el diálogo de la acción, completa el motivo y confirma. */
async function decideWithReason(page: Page, actionName: string, reason: string) {
  const trigger = page.getByRole('button', { name: actionName });
  const dialog = page.getByRole('dialog');
  // El botón vive fuera de un formulario: se reintenta el clic hasta que React hidrata y abre el diálogo.
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(dialog.getByRole('heading', { name: actionName })).toBeVisible();

  const reasonInput = dialog.getByLabel(/motivo de la decisión/i);
  await waitForFormHydration(reasonInput);
  await reasonInput.fill(reason);
  await dialog.getByRole('button', { name: /confirmar decisión/i }).click();
  await expect(dialog).toBeHidden();
}

test.describe('T-380 — reactivar un repartidor suspendido (CC-034)', () => {
  test('el admin suspende y reactiva con motivo; el repartidor vuelve al feed al activar su disponibilidad', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
  }, testInfo) => {
    test.setTimeout(150_000);

    const courier = stagingContext.courierUsers?.[0];
    if (!courier) throw new Error('[E2E Error] No courier user in stagingContext');
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== 'string' || baseURL.length === 0) {
      throw new Error('[E2E Error] Falta baseURL para crear el contexto aislado del repartidor');
    }

    // 1. Admin con MFA en el detalle del repartidor aprobado.
    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);
    await page.goto(`/admin/applicants/${courier.id}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();

    // 2. Suspende con motivo.
    await decideWithReason(page, 'Suspender repartidor', `Suspensión E2E ${stagingContext.testRunId}`);
    await expect(page.getByText('Suspendido', { exact: true })).toBeVisible();

    // 3. El repartidor suspendido ve el aviso y no el feed.
    const courierContext = await browser.newContext({ baseURL });
    try {
      const courierPage = await courierContext.newPage();
      await loginAsCourier(0, courierPage);
      await courierPage.goto('/courier/feed');
      await waitForNoSkeletons(courierPage);
      await expect(
        courierPage.getByRole('heading', { name: /cuenta suspendida temporalmente/i })
      ).toBeVisible();

      // 4. El admin lo reactiva con motivo y ve «Aprobado» (no «Ocurrió un inconveniente inesperado»).
      const reason = `Reactivación E2E ${stagingContext.testRunId}: el reclamo no se confirmó.`;
      await decideWithReason(page, 'Reactivar repartidor', reason);
      await expect(page.getByText('Aprobado', { exact: true })).toBeVisible();
      await expect(page.getByText(/inconveniente inesperado/i)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Suspender repartidor' })).toBeVisible();

      // Lo que dejó la RPC: aprobado, sin disponibilidad y una auditoría con el motivo.
      const admin = createAdminClient();
      const { data: courierRow, error: courierErr } = await admin
        .from('couriers')
        .select('status, available, deactivated_at')
        .eq('profile_id', courier.id)
        .single();
      if (courierErr) throw new Error(`[E2E Inspect Error] ${courierErr.message}`);
      expect(courierRow).toEqual({ status: 'approved', available: false, deactivated_at: null });

      const { data: auditRows, error: auditErr } = await admin
        .from('audit_log')
        .select('actor_id, before, after')
        .eq('action', 'admin_reinstate_courier')
        .eq('target_id', courier.id);
      if (auditErr) throw new Error(`[E2E Inspect Error] ${auditErr.message}`);
      expect(auditRows).toEqual([
        {
          actor_id: credentials.id,
          before: { status: 'suspended' },
          after: { status: 'approved', reason },
        },
      ]);

      // 5. El repartidor vuelve sin disponibilidad; al activarla ve el feed.
      await courierPage.reload();
      await waitForNoSkeletons(courierPage);
      await expect(
        courierPage.getByRole('heading', { name: /cuenta suspendida temporalmente/i })
      ).toHaveCount(0);
      const unavailableHeading = courierPage.getByRole('heading', { name: /no estás disponible/i });
      await expect(unavailableHeading).toBeVisible();
      const availability = courierPage.getByRole('switch', { name: /cambiar estado de disponibilidad/i });
      await expect(availability).toHaveAttribute('aria-checked', 'false');
      await availability.click();
      await expect(availability).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
      await expect(unavailableHeading).toHaveCount(0);
      await expect(courierPage.getByRole('heading', { name: /solicitudes abiertas/i })).toBeVisible();
    } finally {
      await courierContext.close();
    }
  });
});
