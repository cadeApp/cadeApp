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
import { AdminPage, LoginPage } from '../pages';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-407 (A06): filtros de la auditoría.
 *
 * DoD:
 * 1. Filtrar por el día de hoy (hora de Argentina) muestra la acción que el spec acaba de hacer; un rango de ayer no.
 * 2. Filtrar por el `targetId` de esa entidad muestra solo sus filas.
 */

/** Admin con un factor TOTP verificado: el cliente queda en aal2 para las RPC admin. */
async function seedAdminWithTotp(context: StagingSeedContext) {
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
  return { credentials, client, totpSecret: enrolled.totp.secret };
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

/** Fecha civil de Argentina (`YYYY-MM-DD`) de un instante. */
function argentinaDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(iso));
}

function previousDay(civilDate: string): string {
  const [year, month, day] = civilDate.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) - 1)).toISOString().slice(0, 10);
}

test.describe('T-407 — Auditoría A06: rango de fechas y entidad', () => {
  test('hoy muestra la acción recién hecha, ayer no, y el targetId deja solo las filas de esa entidad', async ({
    page,
    stagingContext,
  }) => {
    test.setTimeout(120_000);

    const courier = stagingContext.courierUsers?.[0];
    const otherCourier = stagingContext.courierUsers?.[1];
    if (!courier || !otherCourier) throw new Error('[E2E Error] Faltan repartidores en stagingContext');

    // 1. Acciones auditadas por RPC (datos por API, no por UI): suspender y reactivar a uno, suspender al otro.
    const { credentials, client, totpSecret } = await seedAdminWithTotp(stagingContext);
    const reason = `Auditoría E2E ${stagingContext.testRunId}`;
    for (const [rpc, courierId] of [
      ['admin_suspend_courier', courier.id],
      ['admin_reinstate_courier', courier.id],
      ['admin_suspend_courier', otherCourier.id],
    ] as const) {
      const { error } = await client.rpc(rpc, { p_courier_id: courierId, p_reason: reason });
      if (error) throw new Error(`[E2E Seed Error] ${rpc}: ${error.message}`);
    }

    // El día se toma de la fila real, para no fallar si el spec cruza la medianoche de Argentina.
    const { data: auditRows, error: auditErr } = await createAdminClient()
      .from('audit_log')
      .select('created_at')
      .eq('target_id', courier.id)
      .eq('action', 'admin_suspend_courier');
    if (auditErr || !auditRows?.[0]) throw new Error(`[E2E Inspect Error] ${auditErr?.message ?? 'sin fila'}`);
    const today = argentinaDate(auditRows[0].created_at);
    const yesterday = previousDay(today);

    await loginAdminWithMfa(page, credentials, totpSecret);
    const admin = new AdminPage(page);
    const ownRows = admin.auditLogTable.getByRole('row').filter({ hasText: reason });

    // 2. Por targetId: solo las dos filas del primer repartidor, no la del segundo.
    await page.goto(`/admin/audit?target=${courier.id}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText('Mostrando los eventos de una sola entidad.')).toBeVisible();
    const bodyRows = admin.auditLogTable.locator('tbody tr');
    await expect(bodyRows).toHaveCount(2);
    await expect(ownRows.filter({ hasText: 'Suspendió un repartidor' })).toHaveCount(1);
    await expect(ownRows.filter({ hasText: 'Reactivó un repartidor' })).toHaveCount(1);

    // 3. Hoy, desde el formulario (GET nativo, no necesita hidratación): la acción aparece y el filtro por entidad se conserva.
    await admin.filterAuditByDates(today, today);
    await page.waitForURL((url) => url.searchParams.get('from') === today && url.searchParams.get('to') === today);
    expect(new URL(page.url()).searchParams.get('target')).toBe(courier.id);
    await waitForNoSkeletons(page);
    await expect(bodyRows).toHaveCount(2);
    await expect(ownRows.filter({ hasText: 'Suspendió un repartidor' })).toHaveCount(1);

    // Sin entidad, hoy también trae la suspensión del otro repartidor.
    await page.goto(`/admin/audit?from=${today}&to=${today}&action=admin_suspend_courier`);
    await waitForNoSkeletons(page);
    await expect(ownRows).toHaveCount(2);

    // 4. Ayer: ninguna de las acciones recién hechas.
    await page.goto(`/admin/audit?target=${courier.id}`);
    await waitForNoSkeletons(page);
    await admin.filterAuditByDates(yesterday, yesterday);
    await page.waitForURL((url) => url.searchParams.get('to') === yesterday);
    await waitForNoSkeletons(page);
    await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
    await expect(ownRows).toHaveCount(0);
  });
});
