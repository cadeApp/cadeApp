import { randomUUID } from 'node:crypto';
import { type Page } from '@playwright/test';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
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
 * T-414 (CC-040): novedades del admin.
 *
 * - El admin con MFA crea una novedad para comercios desde «Novedades», con confirmación de destinatarios.
 * - El comercio la ve como banner en su inicio, la cierra y no vuelve después de recargar.
 * - Un repartidor no la ve.
 *
 * La novedad vive en la base compartida de develop: se crea por un día y se borra al terminar, para no gastar el tope
 * diario de envíos ni dejarle el banner a otros comercios.
 */

/** Admin con un factor TOTP verificado (mismo patrón que `admin-trips.spec.ts`). */
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

async function loginAdminWithMfa(page: Page, credentials: UserCredentials, totpSecret: string): Promise<void> {
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

test.describe('T-414 — Novedades del admin', () => {
  test('el admin envía una novedad a comercios; el comercio la ve y la cierra; el repartidor no la ve', async ({
    page,
    browser,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
    assertAllowedE2EEnvironment();
    const admin = createAdminClient();
    const title = `E2E novedad ${randomUUID().slice(0, 8)}`;
    let announcementId: string | null = null;

    try {
      // Admin: alta desde la UI con confirmación.
      const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
      await loginAdminWithMfa(page, credentials, totpSecret);
      await page.goto('/admin/announcements');
      await waitForNoSkeletons(page);
      await expect(page.getByRole('link', { name: 'Novedades', exact: true })).toHaveAttribute('aria-current', 'page');

      await page.getByLabel('Comercios', { exact: true }).check();
      const titleInput = page.getByLabel('Título');
      await waitForFormHydration(titleInput);
      await titleInput.fill(title);
      await page.getByLabel('Texto').fill('Hoy los viajes múltiples cuestan 1 crédito.');
      await page.getByLabel('Ver mi plan').check();
      await page.getByLabel('Días visible').fill('1');
      await expect(page.getByRole('region', { name: 'Novedad de cadeApp' }).getByRole('heading', { name: title })).toBeVisible();

      await page.getByRole('button', { name: 'Revisar y enviar' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(/La van a ver \d+ cuentas? en su inicio/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Enviar novedad' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('table', { name: 'Novedades enviadas' }).getByText(title)).toBeVisible();

      const { data: row, error } = await admin
        .from('announcements')
        .select('id, audience, cta, push_recorded_at')
        .eq('title', title)
        .single();
      expect(error).toBeNull();
      announcementId = row?.id ?? null;
      expect(row).toMatchObject({ audience: 'merchants', cta: 'merchant_plan' });
      expect(row?.push_recorded_at).not.toBeNull();

      // Comercio: banner en su inicio, botón hacia «Mi plan», cierre que persiste.
      const merchantContext = await browser.newContext();
      try {
        const merchantPage = await merchantContext.newPage();
        await loginAsMerchant(merchantPage);
        await merchantPage.goto('/merchant/dashboard');
        await waitForNoSkeletons(merchantPage);
        const banner = merchantPage.getByRole('region', { name: 'Novedad de cadeApp' }).filter({ hasText: title });
        await expect(banner).toBeVisible();
        await expect(banner.getByRole('link', { name: 'Ver mi plan' })).toHaveAttribute('href', '/merchant/plan');

        await banner.getByRole('button', { name: 'Cerrar novedad' }).click();
        await expect(banner).toHaveCount(0);
        await merchantPage.reload();
        await waitForNoSkeletons(merchantPage);
        await expect(
          merchantPage.getByRole('region', { name: 'Novedad de cadeApp' }).filter({ hasText: title })
        ).toHaveCount(0);
      } finally {
        await merchantContext.close();
      }

      // Repartidor: la novedad es solo para comercios.
      const courierContext = await browser.newContext();
      try {
        const courierPage = await courierContext.newPage();
        await loginAsCourier(0, courierPage);
        await courierPage.goto('/courier/feed');
        await waitForNoSkeletons(courierPage);
        await expect(
          courierPage.getByRole('region', { name: 'Novedad de cadeApp' }).filter({ hasText: title })
        ).toHaveCount(0);
      } finally {
        await courierContext.close();
      }
    } finally {
      if (announcementId) {
        await admin.from('announcements').delete().eq('id', announcementId);
      } else {
        await admin.from('announcements').delete().eq('title', title);
      }
    }
  });
});
