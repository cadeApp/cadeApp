import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Helper para leer archivos del repositorio
function readFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  assert.ok(fs.existsSync(fullPath), `El archivo ${relativePath} debe existir.`);
  return fs.readFileSync(fullPath, 'utf8');
}

// --------------------------------------------------------------------------
// 1. Configuración de Playwright (playwright.config.ts)
// --------------------------------------------------------------------------
test('DoD: playwright.config.ts define reducedMotion: "reduce"', async () => {
  const configPath = path.resolve(process.cwd(), 'playwright.config.ts');
  assert.ok(fs.existsSync(configPath), 'playwright.config.ts debe existir.');
  const configModule = await import(pathToFileURL(configPath).href);
  const config = configModule.default;
  assert.ok(config, 'playwright.config.ts debe exportar una configuración por defecto.');
  assert.equal(
    config.use?.reducedMotion,
    'reduce',
    'La configuración debe fijar reducedMotion: "reduce" según el objetivo de T-301.'
  );
});

test('DoD: playwright.config.ts define baseURL apuntando a staging por defecto y testDir en e2e', async () => {
  const configPath = path.resolve(process.cwd(), 'playwright.config.ts');
  const configModule = await import(pathToFileURL(configPath).href);
  const config = configModule.default;
  assert.match(
    config.use?.baseURL ?? '',
    /cadeapp-staging\.vercel\.app|localhost/,
    'baseURL debe apuntar a cadeapp-staging.vercel.app o configurable por variable de entorno.'
  );
  assert.ok(
    config.testDir?.includes('e2e'),
    'testDir debe apuntar al directorio e2e.'
  );
});

test('DoD: playwright.config.ts incluye el proyecto serial "global-settings"', async () => {
  const configPath = path.resolve(process.cwd(), 'playwright.config.ts');
  const configModule = await import(pathToFileURL(configPath).href);
  const config = configModule.default;
  const projects = config.projects || [];
  const globalSettingsProject = projects.find((p: { name: string }) => p.name === 'global-settings');
  assert.ok(
    globalSettingsProject,
    'Debe existir un proyecto llamado "global-settings" para specs que alteran platform_settings.'
  );
  assert.equal(
    globalSettingsProject.fullyParallel,
    false,
    'El proyecto global-settings debe ejecutarse en serie (fullyParallel: false).'
  );
  assert.ok(
    globalSettingsProject.testMatch,
    'El proyecto global-settings debe especificar un testMatch para aislar sus pruebas.'
  );
});

// --------------------------------------------------------------------------
// 2. Workflow de CI para staging (.github/workflows/e2e-staging.yml)
// --------------------------------------------------------------------------
test('DoD: .github/workflows/e2e-staging.yml existe y previene superposición de corridas (concurrency)', () => {
  const yaml = readFile('.github/workflows/e2e-staging.yml');
  assert.match(yaml, /name:\s*e2e-staging/, 'El workflow debe llamarse e2e-staging.');
  assert.match(
    yaml,
    /group:\s*e2e-staging/,
    'Debe definir el grupo de concurrencia e2e-staging.'
  );
  assert.match(
    yaml,
    /cancel-in-progress:\s*false/,
    'cancel-in-progress debe ser false para que dos corridas no se superpongan ni se cancelen.'
  );
});

test('DoD: e2e-staging.yml se ejecuta tras deploy en staging y corre el spec de humo', () => {
  const yaml = readFile('.github/workflows/e2e-staging.yml');
  assert.match(
    yaml,
    /workflow_run:/,
    'El workflow debe dispararse tras workflow_run (deploy a staging).'
  );
  assert.match(yaml, /workflows:\s*\[deploy\]/, 'Debe observar la finalización de deploy.');
  assert.match(
    yaml,
    /smoke\.spec\.ts|playwright test/,
    'El workflow debe ejecutar el spec de humo en staging.'
  );
  // Regla 00: Actions fijadas por SHA completo de 40 caracteres
  const actionLines = yaml.split('\n').filter((l) => l.trim().startsWith('uses:'));
  for (const line of actionLines) {
    if (!line.includes('./')) {
      assert.match(
        line,
        /@[a-f0-9]{40}/,
        `Toda Action externa debe estar fijada por commit SHA: ${line}`
      );
    }
  }
});

// --------------------------------------------------------------------------
// 3. Helper de Skeletons (e2e/helpers/skeletons.ts)
// --------------------------------------------------------------------------
test('DoD: un helper espera a que desaparezcan los skeletons sin tiempos fijos', () => {
  const helperCode = readFile('e2e/helpers/skeletons.ts');
  assert.match(
    helperCode,
    /export (async )?function waitForNoSkeletons/,
    'Debe exportar la función waitForNoSkeletons.'
  );
  assert.doesNotMatch(
    helperCode,
    /waitForTimeout|setTimeout/,
    'El helper no debe usar tiempos fijos ni sleeps (regla 40 y DoD de T-301).'
  );
  assert.match(
    helperCode,
    /\.animate-pulse|\[aria-busy="true"\]|\[data-slot="skeleton"\]/,
    'El helper debe buscar los selectores de skeleton de cadeApp (.animate-pulse / aria-busy).'
  );
});

// --------------------------------------------------------------------------
// 4. Page Objects y Fixtures por rol
// --------------------------------------------------------------------------
test('DoD: Page objects implementados con selectores accesibles por rol (e2e/pages)', () => {
  const basePageCode = readFile('e2e/pages/base.page.ts');
  assert.match(basePageCode, /class BasePage/, 'Debe exportar BasePage.');
  assert.match(
    basePageCode,
    /waitForNoSkeletons/,
    'BasePage debe integrar el helper de espera de skeletons.'
  );

  const loginPageCode = readFile('e2e/pages/login.page.ts');
  assert.match(loginPageCode, /class LoginPage/, 'Debe exportar LoginPage.');
  assert.match(
    loginPageCode,
    /getByRole|getByLabel|getByText/,
    'LoginPage debe utilizar selectores accesibles por rol, label o texto.'
  );

  const merchantPageCode = readFile('e2e/pages/merchant.page.ts');
  assert.match(merchantPageCode, /class MerchantPage/, 'Debe exportar MerchantPage.');

  const courierPageCode = readFile('e2e/pages/courier.page.ts');
  assert.match(courierPageCode, /class CourierPage/, 'Debe exportar CourierPage.');

  const adminPageCode = readFile('e2e/pages/admin.page.ts');
  assert.match(adminPageCode, /class AdminPage/, 'Debe exportar AdminPage.');
});

test('DoD: Fixtures tipadas por rol y utilidades de seed/limpieza en staging (e2e/fixtures)', () => {
  const rolesCode = readFile('e2e/fixtures/roles.ts');
  assert.match(
    rolesCode,
    /merchantPage|courierPage|adminPage/,
    'Debe exportar fixtures tipadas para merchant, courier y admin.'
  );

  const seedCode = readFile('e2e/fixtures/staging-seed.ts');
  assert.match(
    seedCode,
    /seedStagingData|cleanupStagingData/,
    'Debe proveer utilidades para seed y limpieza de datos en staging.'
  );
});

// --------------------------------------------------------------------------
// 5. Spec de humo para CI (e2e/specs/smoke.spec.ts)
// --------------------------------------------------------------------------
test('DoD: spec de humo implementado para verificar carga y salud sin skeletons', () => {
  const smokeCode = readFile('e2e/specs/smoke.spec.ts');
  assert.match(smokeCode, /test\(/, 'smoke.spec.ts debe contener tests de Playwright.');
  assert.match(
    smokeCode,
    /waitForNoSkeletons/,
    'El spec de humo debe utilizar el helper de skeletons en lugar de sleeps fijos.'
  );
});
