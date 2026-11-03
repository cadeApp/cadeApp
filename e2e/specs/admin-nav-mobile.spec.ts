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

/**
 * T-402: en una pantalla angosta (390 px) el admin llega a todas las secciones con el menú.
 * Antes, la navegación tenía `hidden md:flex` y debajo de `md` no había forma de cambiar de sección.
 */

const SECTIONS = [
  { label: 'Postulantes', path: '/admin/applicants' },
  { label: 'Comercios', path: '/admin/merchants' },
  { label: 'Viajes', path: '/admin/trips' },
  { label: 'Incidentes', path: '/admin/incidents' },
  { label: 'Novedades', path: '/admin/announcements' },
  { label: 'Parámetros', path: '/admin/settings' },
  { label: 'Auditoría', path: '/admin/audit' },
] as const;

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

test.describe('T-402 — navegación del admin en pantalla angosta', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('con el menú se llega a todas las secciones y la activa queda marcada', async ({ page, stagingContext }) => {
    test.setTimeout(150_000);

    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);
    await waitForNoSkeletons(page);

    const admin = new AdminPage(page);
    // Debajo de `lg` la barra lateral no se muestra: la única entrada es «Menú».
    await expect(admin.sidebarNav).toBeHidden();
    await waitForFormHydration(admin.menuButton);

    for (const section of SECTIONS) {
      await admin.goToSectionFromMenu(section.label);
      await page.waitForURL(new RegExp(`${section.path}(\\?|$)`));
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(admin.menuButton).toBeFocused();
      await waitForNoSkeletons(page);

      await admin.menuButton.click();
      await expect(admin.menuNav.getByRole('link', { name: section.label, exact: true })).toHaveAttribute(
        'aria-current',
        'page'
      );
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});
