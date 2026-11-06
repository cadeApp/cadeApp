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
 * PR584-H01: además, el corte en `lg` (1023/1024 px) y el escritorio (1280 px): una sola navegación visible por
 * ancho, el contenido al lado de la barra lateral y, en escritorio, el operador y «Salir».
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

    for (const section of SECTIONS) {
      await admin.goToSectionFromMenu(section.label);
      await page.waitForURL(new RegExp(`${section.path}(\\?|$)`));
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(admin.menuButton).toBeFocused();
      await waitForNoSkeletons(page);

      await admin.openMenu();
      await expect(admin.menuNav.getByRole('link', { name: section.label, exact: true })).toHaveAttribute(
        'aria-current',
        'page'
      );
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});

test.describe('T-402 — corte en lg y escritorio', () => {
  const SIDEBAR_WIDTH = 256;

  /** Geometría con ±1 px de tolerancia por redondeo del navegador. */
  function expectNear(actual: number, expected: number, label: string) {
    expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(1);
  }

  test('debajo de lg solo «Menú»; desde lg la barra lateral con el operador y el contenido a su lado', async ({
    page,
    stagingContext,
  }) => {
    test.setTimeout(150_000);

    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);
    const admin = new AdminPage(page);
    const operatorName = credentials.displayName?.trim();
    if (!operatorName) throw new Error('[E2E Error] El admin sembrado no tiene displayName');

    for (const width of [390, 1023, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/admin/merchants');
      await waitForNoSkeletons(page);
      const main = await page.locator('main').boundingBox();
      if (!main) throw new Error('[E2E Error] Falta el main');

      if (width < 1024) {
        await expect(admin.sidebarNav, `${width}px`).toBeHidden();
        await expect(admin.menuButton, `${width}px`).toBeVisible();
        expectNear(main.x, 0, `${width}px main.x`);
        expectNear(main.width, width, `${width}px main.width`);

        // CC-046: el menú lateral se apoya en el borde derecho. A 1023 px es más angosto que la pantalla (no
        // centrado); a 390 px ocupa todo el ancho.
        await admin.openMenu();
        const panel = await page.getByRole('dialog').boundingBox();
        if (!panel) throw new Error('[E2E Error] Falta el panel del menú');
        expectNear(panel.x + panel.width, width, `${width}px borde derecho del menú`);
        if (width >= 640) {
          expect(panel.x, `${width}px el menú no ocupa todo el ancho`).toBeGreaterThan(0);
        } else {
          expectNear(panel.x, 0, `${width}px el menú ocupa todo el ancho`);
        }
        // PR631-H01: Escape lo cierra y el foco vuelve a «Menú».
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(admin.menuButton).toBeFocused();
      } else {
        await expect(admin.sidebarNav, `${width}px`).toBeVisible();
        await expect(admin.menuButton, `${width}px`).toBeHidden();
        const links = admin.sidebarNav.getByRole('link');
        await expect(links).toHaveCount(SECTIONS.length);
        for (const [index, section] of SECTIONS.entries()) {
          const link = links.nth(index);
          await expect(link).toHaveText(section.label);
          await expect(link).toHaveAttribute('href', section.path);
          await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(1);
        }
        await expect(admin.sidebarNav.getByRole('link', { name: 'Comercios', exact: true })).toHaveAttribute(
          'aria-current',
          'page'
        );
        const sidebar = page.getByRole('complementary');
        await expect(sidebar.getByText(operatorName, { exact: true })).toBeVisible();
        await expect(sidebar.getByRole('button', { name: 'Salir' })).toBeVisible();
        expectNear(main.x, SIDEBAR_WIDTH, `${width}px main.x`);
        expectNear(main.width, width - SIDEBAR_WIDTH, `${width}px main.width`);
      }
    }
  });
});
