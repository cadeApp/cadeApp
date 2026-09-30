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

// Helper para eliminar comentarios de código JS/TS
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
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
  const reducedMotionSetting =
    config.use?.contextOptions?.reducedMotion ?? config.use?.reducedMotion;
  assert.equal(
    reducedMotionSetting,
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

test('DoD: e2e-staging.yml corre tras deploy exitoso en staging, prueba el SHA exacto y ejecuta Playwright real', () => {
  const yaml = readFile('.github/workflows/e2e-staging.yml');
  assert.match(
    yaml,
    /workflow_run:/,
    'El workflow debe dispararse tras workflow_run (deploy a staging).'
  );
  assert.match(yaml, /workflows:\s*\[deploy\]/, 'Debe observar la finalización de deploy.');

  // H03: checkout explícito de head_sha y persist-credentials: false
  assert.match(
    yaml,
    /ref:\s*\${{\s*github\.event\.workflow_run\.head_sha\s*}}/,
    'El checkout debe fijar explícitamente ref: ${{ github.event.workflow_run.head_sha }} (H03).'
  );
  assert.match(
    yaml,
    /persist-credentials:\s*false/,
    'El checkout debe mantener persist-credentials: false.'
  );

  // H03: condición estricta de deploy exitoso en staging
  assert.match(
    yaml,
    /github\.event\.workflow_run\.conclusion\s*==\s*['"]success['"]/,
    'E2E debe continuar únicamente cuando el deployment previo haya finalizado con éxito.'
  );
  assert.match(
    yaml,
    /github\.event\.workflow_run\.head_branch\s*==\s*['"]staging['"]/,
    'E2E debe ejecutarse exclusivamente para el branch staging.'
  );

  // H01: instalación y ejecución mediante pnpm exec playwright (no dlx, no ambient)
  assert.match(
    yaml,
    /pnpm\s+exec\s+playwright\s+install\s+--with-deps\s+chromium/,
    'Debe instalar el navegador chromium con pnpm exec playwright install.'
  );

  // H04 (M1): Verificación estricta de ejecución de Playwright que rechaza falsos positivos de echo
  const lines = yaml.split('\n');
  const runLines = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith('run:'));

  const playwrightExecutionStep = runLines.find(
    (l) => /pnpm\s+exec\s+playwright\s+test/.test(l) && !/^\s*run:\s*echo\b/.test(l)
  );

  assert.ok(
    playwrightExecutionStep,
    'El workflow debe ejecutar realmente pnpm exec playwright test (rechaza mutación M1 con sólo echo).'
  );

  // Regla 00: Actions fijadas por SHA completo de 40 caracteres
  const actionLines = lines.filter((l) => l.trim().startsWith('uses:'));
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
// 4. Page Objects y Fixtures por rol con selectores accesibles
// --------------------------------------------------------------------------
test('DoD & H06: Page objects implementados con selectores accesibles por rol (e2e/pages)', () => {
  const pageFiles = [
    'e2e/pages/login.page.ts',
    'e2e/pages/merchant.page.ts',
    'e2e/pages/courier.page.ts',
    'e2e/pages/admin.page.ts',
  ];

  for (const file of pageFiles) {
    const code = readFile(file);
    const codeNoComments = stripComments(code);

    // Debe contener selectores accesibles
    assert.match(
      codeNoComments,
      /getByRole|getByLabel|getByPlaceholder|getByText|getByTestId/,
      `${file} debe usar selectores accesibles (getByRole, getByLabel, etc.).`
    );

    // H04 (M4) & H06: Rechazar selectores CSS frágiles o XPath en Page Objects
    assert.doesNotMatch(
      codeNoComments,
      /this\.page\.locator\(\s*['"](\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|\/\/)/,
      `${file} no debe usar selectores CSS frágiles ni XPath (rechaza mutación M4).`
    );
    assert.doesNotMatch(
      codeNoComments,
      /:nth-child|div\s*>\s*div|span\s*>\s*span/,
      `${file} no debe encadenar selectores estructurales frágiles.`
    );
  }

  const basePageCode = readFile('e2e/pages/base.page.ts');
  assert.match(basePageCode, /class BasePage/, 'Debe exportar BasePage.');
  assert.match(
    basePageCode,
    /waitForNoSkeletons/,
    'BasePage debe integrar el helper de espera de skeletons.'
  );
});

test('DoD & H02: Fixtures tipadas por rol y utilidades de seed/limpieza real en staging', () => {
  const rolesCode = readFile('e2e/fixtures/roles.ts');
  assert.match(
    rolesCode,
    /merchantPage|courierPage|adminPage/,
    'Debe exportar fixtures tipadas para merchant, courier y admin.'
  );

  const stagingSeedFixtures = readFile('e2e/fixtures/staging-seed.ts');
  assert.match(
    stagingSeedFixtures,
    /@\/server\/e2e\/staging-seed/,
    'e2e/fixtures/staging-seed.ts debe delegar a la capa server-side src/server/e2e/staging-seed.ts.'
  );

  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedServerCode = stripComments(serverSeedCode);

  // H02: import 'server-only' y createAdminClient
  assert.match(
    serverSeedCode,
    /import\s+['"]server-only['"]/,
    'src/server/e2e/staging-seed.ts debe comenzar con import "server-only".'
  );
  assert.match(
    serverSeedCode,
    /createAdminClient/,
    'src/server/e2e/staging-seed.ts debe reutilizar createAdminClient().'
  );

  // H02 & H04 (M2): seed y cleanup reales, no stubs vacíos
  assert.match(
    strippedServerCode,
    /\.from\(['"]delivery_requests['"]\)/,
    'seedStagingData debe interactuar realmente con la tabla delivery_requests (rechaza mutación M2).'
  );
  assert.match(
    strippedServerCode,
    /\.delete\(\)/,
    'cleanupStagingData debe ejecutar delete() real para la limpieza (rechaza mutación M2).'
  );

  // H02: Protección Fail-Closed
  assert.match(
    strippedServerCode,
    /assertAllowedE2EEnvironment/,
    'src/server/e2e/staging-seed.ts debe validar assertAllowedE2EEnvironment() antes de operar.'
  );
});

// --------------------------------------------------------------------------
// 5. Spec de humo para CI (e2e/specs/smoke.spec.ts)
// --------------------------------------------------------------------------
test('DoD, H04 (M3) & H05: spec de humo implementado con ejecución Playwright y assertions reales', () => {
  const smokeCode = readFile('e2e/specs/smoke.spec.ts');
  const codeWithoutComments = stripComments(smokeCode);

  assert.match(
    smokeCode,
    /test\.describe|test\(/,
    'smoke.spec.ts debe contener tests de Playwright.'
  );

  // H04 (M3) & H05: waitForNoSkeletons debe ser una llamada real, no estar sólo en comentarios
  assert.match(
    codeWithoutComments,
    /waitForNoSkeletons\s*\(/,
    'smoke.spec.ts debe invocar funcionalmente waitForNoSkeletons() (rechaza mutación M3 con comentario muerto).'
  );

  // H05: Navegación real y assertions significativas
  assert.match(
    codeWithoutComments,
    /page\.goto\s*\(|loginPage\.navigate\s*\(/,
    'smoke.spec.ts debe realizar navegación real en Playwright.'
  );

  assert.match(
    codeWithoutComments,
    /expect\s*\([^)]+\)\.(toBeVisible|toBe|toEqual|toBeOK)\s*\(/,
    'smoke.spec.ts debe incluir assertions significativas sobre el estado de la aplicación.'
  );
});

// --------------------------------------------------------------------------
// 6. Verificación de Mitigación de Mutaciones (M5 a M12) y Robustez de Lifecycle (H12-H14)
// --------------------------------------------------------------------------
test('DoD, H09, H12 & M5/M9: Fixture conecta efectivamente seed y cleanup abarcando todo el lifecycle con try/finally', () => {
  const rolesCode = readFile('e2e/fixtures/roles.ts');
  const strippedRoles = stripComments(rolesCode);

  // M5: roles.ts debe invocar seedStagingData antes de use(context)
  assert.match(
    strippedRoles,
    /await\s+seedStagingData\s*\(\s*context/,
    'roles.ts debe invocar funcionalmente seedStagingData(context) antes del test (rechaza mutación M5).'
  );

  // H12 & M9: El bloque try/finally debe abarcar tanto seedStagingData como use(context) para garantizar cleanup ante fallos del seed
  assert.match(
    strippedRoles,
    /try\s*\{[\s\S]*await\s+seedStagingData\s*\(\s*context[\s\S]*await\s+use\s*\(\s*context\s*\);[\s\S]*\}\s*catch\s*\([\s\S]*\}\s*finally\s*\{[\s\S]*await\s+cleanupStagingData\s*\(\s*context\s*\);/,
    'roles.ts debe asegurar la limpieza envolviendo tanto seedStagingData como use(context) en try/finally con preservación de errores (H12 / M9).'
  );

  // M5: smoke.spec.ts debe solicitar stagingContext y verificar las entidades sembradas
  const smokeCode = readFile('e2e/specs/smoke.spec.ts');
  const strippedSmoke = stripComments(smokeCode);

  assert.match(
    strippedSmoke,
    /stagingContext/,
    'smoke.spec.ts debe solicitar el fixture stagingContext para activar el ciclo de seed/teardown (rechaza mutación M5).'
  );
  assert.match(
    strippedSmoke,
    /stagingContext\.createdRequestIds/,
    'smoke.spec.ts debe verificar la presencia de entidades creadas en staging.'
  );
});

test('DoD, H08 & M6: El seed no usa identificadores falsos y exige UUIDs válidos para id, merchant_id y zonas', () => {
  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedSeed = stripComments(serverSeedCode);

  // M6: No debe contener generadores de ID inválidos ni zonas de texto arbitrario en campos UUID
  assert.doesNotMatch(
    strippedSeed,
    /\$\{context\.testRunId\}req/,
    'El seed no debe construir IDs con strings no-UUID (rechaza mutación M6).'
  );
  assert.doesNotMatch(
    strippedSeed,
    /merchant_id:\s*`\${context\.testRunId}_merchant/,
    'El seed no debe usar strings no-UUID para merchant_id (rechaza mutación M6).'
  );
  assert.doesNotMatch(
    strippedSeed,
    /pickup_zone_id:\s*['"]caba_norte['"]/,
    'pickup_zone_id debe ser un UUID resuelto y no el literal "caba_norte" (rechaza mutación M6).'
  );

  // Debe usar crypto.randomUUID() y assertValidUuid
  assert.match(
    strippedSeed,
    /crypto\.randomUUID\(\)/,
    'El seed debe generar identificadores UUID v4 reales con crypto.randomUUID().'
  );
  assert.match(
    strippedSeed,
    /assertValidUuid\s*\(/,
    'El seed debe validar estrictamente que todos los identificadores sean UUIDs válidos.'
  );
});

test('DoD, H08 & M7: El seed falla si Supabase devuelve error y no registra IDs no confirmados', () => {
  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedSeed = stripComments(serverSeedCode);

  // M7: Si Supabase devuelve error, debe lanzar excepción inmediatamente
  assert.match(
    strippedSeed,
    /if\s*\(\s*error\s*\|\|\s*!data\?\.id\s*\)\s*\{\s*throw\s+new\s+Error/,
    'El seed debe fallar explícitamente si Supabase devuelve error al insertar (rechaza mutación M7).'
  );

  // M7: Solo debe rastrear para cleanup DESPUÉS de comprobar éxito
  const insertIndex = strippedSeed.search(/\.from\(['"]delivery_requests['"]\)\s*\.insert/);
  const trackIndex = strippedSeed.indexOf("trackEntityForCleanup(context, 'request'");
  assert.ok(insertIndex >= 0, 'Debe insertar en delivery_requests.');
  assert.ok(trackIndex > insertIndex, 'trackEntityForCleanup debe ocurrir estrictamente después de confirmar la inserción exitosa.');
});

test('DoD, H10 & M8: Protección Fail-Closed rechaza producción y proyectos desconocidos incluso con flags de test', () => {
  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedSeed = stripComments(serverSeedCode);

  // M8: isAllowedE2EEnvironment debe comprobar afirmativamente contra staging conocido
  assert.match(
    strippedSeed,
    /KNOWN_STAGING_PROJECT_REFS/,
    'La guarda debe validar contra la lista de proyectos staging autorizados afirmativamente (H10 / M8).'
  );
  assert.match(
    strippedSeed,
    /axwvmyqwhwfghyjdufny/,
    'El proyecto de Supabase staging conocido (axwvmyqwhwfghyjdufny) debe estar registrado.'
  );
  assert.match(
    strippedSeed,
    /SUPABASE_PRODUCTION_PROJECT_REF/,
    'La guarda debe identificar y bloquear afirmativamente el ref de producción.'
  );
  assert.match(
    strippedSeed,
    /cadeapp\.com/,
    'La guarda debe bloquear dominios de producción.'
  );
});

test('DoD, H12 & M12: seedStagingData valida y falla ante error en profiles o merchants upsert', () => {
  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedSeed = stripComments(serverSeedCode);

  assert.match(
    strippedSeed,
    /if\s*\(\s*profileErr\s*\)\s*\{\s*throw\s+new\s+Error/,
    'seedStagingData debe validar explícitamente el resultado del upsert en profiles (H12).'
  );
  assert.match(
    strippedSeed,
    /if\s*\(\s*merchantErr\s*\)\s*\{\s*throw\s+new\s+Error/,
    'seedStagingData debe validar explícitamente el resultado del upsert en merchants (H12 / M12).'
  );
});

test('DoD, H13 & M10: e2e-staging.yml declara todas las variables de entorno necesarias para serverEnv', () => {
  const yaml = readFile('.github/workflows/e2e-staging.yml');

  assert.match(
    yaml,
    /DNI_HMAC_SECRET:\s*\${{\s*secrets\.DNI_HMAC_SECRET\s*}}/,
    'e2e-staging.yml debe inyectar DNI_HMAC_SECRET desde secrets para satisfacer serverEnv (H13).'
  );
  assert.match(
    yaml,
    /CRON_SECRET:\s*\${{\s*secrets\.CRON_SECRET\s*}}/,
    'e2e-staging.yml debe inyectar CRON_SECRET desde secrets para satisfacer serverEnv (H13).'
  );
});

test('DoD, H14 & M11: cleanupStagingData inspecciona errores de Supabase, conserva IDs fallidos y lanza error agregado', () => {
  const serverSeedCode = readFile('src/server/e2e/staging-seed.ts');
  const strippedSeed = stripComments(serverSeedCode);

  assert.match(
    strippedSeed,
    /cleanupErrors\.push/,
    'cleanupStagingData debe registrar los fallos individuales sin abortar de inmediato (H14).'
  );
  assert.match(
    strippedSeed,
    /if\s*\(\s*cleanupErrors\.length\s*>\s*0\s*\)\s*\{[\s\S]*throw\s+new\s+Error/,
    'cleanupStagingData debe lanzar un error agregado si hubo fallos en la limpieza (H14 / M11).'
  );
});


