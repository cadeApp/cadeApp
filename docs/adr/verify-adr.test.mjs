import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ADR_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ADR_DIR, '../..');
const ADR_README_PATH = resolve(ADR_DIR, 'README.md');
const ADR_0001_PATH = resolve(ADR_DIR, 'ADR-0001-supabase-baas.md');
const ADR_0002_PATH = resolve(ADR_DIR, 'ADR-0002-hosting-and-cron.md');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');
const SEED_PATH = resolve(REPO_ROOT, 'supabase/seed.sql');
const ENV_EXAMPLE_PATH = resolve(REPO_ROOT, '.env.example');

/**
 * H07: Extrae únicamente la sección de revisión del ADR y verifica que exista
 * una fila de tabla por cada persona (Lautaro073, persona2, persona3) con un
 * estado perteneciente al vocabulario cerrado ('Aprobado' | 'Revisado con observaciones' | 'Pendiente')
 * y que ninguna quede en 'Pendiente'.
 */
function assertReviewTableSection(content, sectionHeadingRegex, adrName) {
  const parts = content.split(sectionHeadingRegex);
  assert.equal(
    parts.length,
    2,
    `${adrName}: Falta el encabezado de la sección de revisión (${sectionHeadingRegex})`
  );
  const reviewSection = parts[1].split(/^## /m)[0];

  const CLOSED_VOCABULARY = ['Aprobado', 'Revisado con observaciones', 'Pendiente'];
  for (const person of ['Lautaro073', 'persona2', 'persona3']) {
    const rowRegex = new RegExp(
      `^\\|\\s*\\*\\*\`${person}\`\\*\\*\\s*\\|[^|]+\\|\\s*(Aprobado|Revisado con observaciones|Pendiente)\\s*\\|`,
      'm'
    );
    const match = reviewSection.match(rowRegex);
    assert.ok(
      match,
      `${adrName}: Falta fila válida en la sección de revisión para ${person} con vocabulario cerrado (${CLOSED_VOCABULARY.join(' / ')})`
    );
    assert.notEqual(
      match[1],
      'Pendiente',
      `${adrName}: La fila de revisión de ${person} sigue en estado 'Pendiente'`
    );
  }
}

test('1. Existe docs/adr/README.md con la convención [DATO]/[SUPUESTO] atribuida al DoD de T-007 (H14)', () => {
  assert.equal(existsSync(ADR_README_PATH), true, 'Falta docs/adr/README.md');
  const content = readFileSync(ADR_README_PATH, 'utf8');
  assert.match(content, /ADR-0001/);
  assert.match(content, /ADR-0002/);
  assert.match(content, /\[DATO\]/);
  assert.match(content, /\[SUPUESTO\]/);
  // H14: La convención [DATO]/[SUPUESTO] sale del DoD de T-007, no de master-plan.md §12 y §16
  assert.doesNotMatch(content, /Plan Maestro \(`docs\/master-plan\.md` §12 y §16\) y el DoD/);
  assert.match(content, /DoD de `T-007`/);
});

test('2. ADR-0001 documenta modelo relacional/ACID, RLS real (H01/H03/H04), push manual, backups/PITR y exclusión de courier-docs como [SUPUESTO] sujeto a T-310 (H05)', () => {
  assert.equal(existsSync(ADR_0001_PATH), true, 'Falta docs/adr/ADR-0001-supabase-baas.md');
  const content = readFileSync(ADR_0001_PATH, 'utf8');

  // 1. Modelo relacional y ACID con identificadores y estados reales (H03, H04)
  assert.match(content, /ACID/i);
  assert.match(content, /SELECT\s*\.\.\.\s*FOR UPDATE/i);
  assert.match(content, /SECURITY DEFINER/);
  assert.match(content, /accept_offer/);
  assert.match(content, /offers_one_accepted_per_request_idx/);
  assert.match(content, /accepted_offer_id/);
  assert.match(content, /status\s*=\s*'published'/);
  assert.match(content, /merchants\.subscription_status/);
  assert.match(content, /couriers\.status\s*=\s*'approved'/);

  // 2. RLS y revelación progresiva real (H01, H02, H03, H10)
  assert.match(content, /Row Level Security/);
  assert.match(content, /delivery_request_contacts/);
  assert.match(content, /contacts_select_merchant/);
  assert.match(content, /contacts_select_accepted_courier/);
  assert.match(content, /contacts_select_admin/);
  assert.match(content, /app_private\.is_admin\(\)/);
  assert.match(content, /delivery_requests_select_courier/);
  // H01 / H02 / H22: ADR-0001 describe el estado destino decidido por Lautaro073 (notes protegido hasta matched,
  // visible solo para comercio dueño, repartidor de accepted_offer_id y admin, distinto de offers.message,
  // con migración a delivery_request_contacts y test de columna en RLS asignados a T-006 / H22).
  assert.match(content, /\bH02\b/);
  assert.match(content, /\bH22\b/);
  assert.match(content, /\bT-006\b/);
  assert.match(content, /offers\.message/);
  assert.doesNotMatch(content, /Mientras `Lautaro073` resuelve la decisión abierta/);
  assert.doesNotMatch(content, /quedando abierta la decisión `H02`/);
  assert.match(content, /supabase\/tests\/rls_matrix\.sql/);
  assert.match(content, /courier-docs/);
  assert.match(content, /audit_log/);

  // 3. Push manual Web Push (VAPID) con nombres reales (H03)
  assert.match(content, /push_subscriptions/);
  assert.match(content, /NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  assert.match(content, /web-push|VAPID/i);
  assert.match(content, /best-effort/i);

  // 4. Backups, PITR y exclusión de courier-docs como [SUPUESTO] sujeto a verificación en T-310 (H05)
  assert.match(content, /PITR|Point-in-Time Recovery/i);
  assert.match(content, /purge_after/);
  assert.match(content, /exclusi[óo]n.*courier-docs|courier-docs.*exclu/i);
  assert.match(content, /T-310/);
  assert.doesNotMatch(
    content,
    /no copian ni retienen los archivos binarios del bucket S3 \(`courier-docs`\)\*\*\s*\(\*\*`\[DATO\]`\*\*\)/
  );
  assert.match(content, /no copian ni retienen los archivos binarios del bucket `courier-docs`\*\*\s*\(\*\*`\[SUPUESTO\]`\*\*\)/);
});

test('3. ADR-0001 incluye ambientes específicos (H15), citas correctas a §17/S3/D1 (H13), costos USD, fuentes consultadas (H14) y tabla de revisión cerrada (H07)', () => {
  assert.equal(existsSync(ADR_0001_PATH), true, 'Falta docs/adr/ADR-0001-supabase-baas.md');
  const content = readFileSync(ADR_0001_PATH, 'utf8');

  // H15: Ambientes requeridos verificados en filas de tabla (no palabras sueltas)
  assert.match(content, /\|\s*\*\*`local`\*\*\s*\|/);
  assert.match(content, /\|\s*\*\*`develop`(?:\s*\(CI\))?\*\*\s*\|/);
  assert.match(content, /cadeapp-staging/);
  assert.match(content, /cadeapp-prod/);
  assert.match(content, /Supabase Pro/);

  // H13: S3 es el límite de 2 proyectos gratuitos en §17; no se atribuye sobrecosto impositivo a S3
  assert.match(content, /§17/);
  assert.doesNotMatch(content, /supuesto S3 del Master Plan §16/);
  assert.doesNotMatch(content, /ver S3 en Master Plan §16/);

  // Etiquetas obligatorias de costos en USD
  assert.match(content, /USD/);
  const datoMatches = content.match(/\[DATO\]/g) ?? [];
  const supuestoMatches = content.match(/\[SUPUESTO\]/g) ?? [];
  assert.ok(datoMatches.length >= 5, `Se esperaban >= 5 etiquetas [DATO], encontradas: ${datoMatches.length}`);
  assert.ok(supuestoMatches.length >= 4, `Se esperaban >= 4 etiquetas [SUPUESTO], encontradas: ${supuestoMatches.length}`);

  // H14: Sección Fuentes consultadas con URLs y fecha
  assert.match(content, /## 8\. Fuentes consultadas[\s\S]*https:\/\/supabase\.com\/pricing[\s\S]*2026-09-22/);

  // H07: Revisión de las 3 personas dentro de la sección 7 con vocabulario cerrado
  assertReviewTableSection(content, /^## 7\. Revisión y conformidad del equipo[^\n]*$/m, 'ADR-0001');
});

test('4. ADR-0002 documenta Vercel Hobby vs Vercel Pro (H15), cron /api/cron/sweep con src/server/env.ts (H10), request_ttl_minutes = 30 (H11), platform_settings clave/valor (H12) y expiración perezosa (H04)', () => {
  assert.equal(existsSync(ADR_0002_PATH), true, 'Falta docs/adr/ADR-0002-hosting-and-cron.md');
  const content = readFileSync(ADR_0002_PATH, 'utf8');

  // H15: Hosting y restricciones de planes con nombres exactos
  assert.match(content, /Vercel Hobby/);
  assert.match(content, /Vercel Pro/);

  // H10, H11, H12: Rutas y parámetros reales del esquema
  assert.match(content, /\/api\/cron\/sweep/);
  assert.match(content, /CRON_SECRET/);
  assert.match(content, /src\/server\/env\.ts/);
  assert.doesNotMatch(content, /src\/lib\/env\.ts/);
  assert.match(content, /request_ttl_minutes\s*=\s*30/);
  assert.doesNotMatch(content, /default_expiry_minutes/);
  assert.match(content, /purge_after/);
  assert.match(content, /key\s*=\s*'subscription_grace_days'/);
  assert.doesNotMatch(content, /platform_settings\.subscription_grace_days/);

  // H04: Expiración perezosa usando status = 'published'
  assert.match(content, /expiraci[óo]n perezosa|lazy expiration/i);
  assert.match(content, /status\s*=\s*'published'/);
  assert.match(content, /expires_at <= now\(\)/);
});

test('5. ADR-0002 incluye citas correctas a §17 (H13), costos en USD, fuentes consultadas (H14) y tabla de revisión cerrada (H07)', () => {
  assert.equal(existsSync(ADR_0002_PATH), true, 'Falta docs/adr/ADR-0002-hosting-and-cron.md');
  const content = readFileSync(ADR_0002_PATH, 'utf8');

  assert.match(content, /§17/);
  assert.doesNotMatch(content, /supuestos `S1` y `S2` — §16/);
  assert.doesNotMatch(content, /tarjeta \(`S3`\)/);

  assert.match(content, /USD/);
  const datoMatches = content.match(/\[DATO\]/g) ?? [];
  const supuestoMatches = content.match(/\[SUPUESTO\]/g) ?? [];
  assert.ok(datoMatches.length >= 4, `Se esperaban >= 4 etiquetas [DATO], encontradas: ${datoMatches.length}`);
  assert.ok(supuestoMatches.length >= 3, `Se esperaban >= 3 etiquetas [SUPUESTO], encontradas: ${supuestoMatches.length}`);

  // H14: Sección Fuentes consultadas con URLs y fecha
  assert.match(content, /## 7\. Fuentes consultadas[\s\S]*https:\/\/vercel\.com\/pricing[\s\S]*2026-09-22/);

  // H07: Revisión de las 3 personas dentro de la sección 6 con vocabulario cerrado
  assertReviewTableSection(content, /^## 6\. Revisión y conformidad del equipo[^\n]*$/m, 'ADR-0002');
});

test('6. Barrido integral (H03, H04, H06, H10, H16): todo identificador snake_case, enum y ruta existente citados en los ADR coinciden con el repositorio, y pnpm test / CI ejecutan esta suite', () => {
  const sqlCorpus =
    readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
      .join('\n') +
    '\n' +
    readFileSync(SEED_PATH, 'utf8') +
    '\n' +
    readFileSync(ENV_EXAMPLE_PATH, 'utf8');

  // Lista blanca cerrada: herramientas de Postgres/CLI y las 3 funciones RPC futuras de Fase 1 (T-101..T-103)
  const ALLOWED_NON_SCHEMA_IDS = new Set([
    'pg_dump',
    'pg_temp',
    'submit_offer',
    'accept_offer',
    'publish_request',
  ]);

  // Rutas futuras explícitamente planificadas para T-104
  const ALLOWED_FUTURE_PATHS = new Set([
    'vercel.json',
    'src/app/api/cron/sweep/route.ts',
  ]);

  for (const [name, path] of [
    ['ADR-0001', ADR_0001_PATH],
    ['ADR-0002', ADR_0002_PATH],
  ]) {
    const text = readFileSync(path, 'utf8');

    // 1. Cruce de todos los identificadores snake_case entre backticks (H03)
    for (const match of text.matchAll(/`([a-z][a-z0-9_]*(?:_[a-z0-9]+)+)`/g)) {
      const id = match[1];
      if (ALLOWED_NON_SCHEMA_IDS.has(id)) continue;
      assert.equal(
        sqlCorpus.includes(id),
        true,
        `${name} cita el identificador '${id}' que no existe en supabase/migrations, seed.sql ni .env.example`
      );
    }

    // 2. Prohibición de estados o columnas inexistentes (H04)
    assert.doesNotMatch(text, /status\s*=\s*'open'/i, `${name} usa status = 'open' (el enum es 'published')`);
    assert.doesNotMatch(text, /\bcanceled\b/i, `${name} usa 'canceled' con una sola 'l' (el enum es 'cancelled')`);
    assert.doesNotMatch(text, /merchants\.status\b/, `${name} usa 'merchants.status' (la columna es 'subscription_status')`);

    // 3. Cruce de rutas de archivos del repo citadas entre backticks (H10, cuidando excepción H15 para T-104)
    for (const match of text.matchAll(/`((?:supabase|src|\.github)\/[^`\s:]+)`/g)) {
      const relPath = match[1];
      if (ALLOWED_FUTURE_PATHS.has(relPath)) continue;
      assert.equal(
        existsSync(resolve(REPO_ROOT, relPath)),
        true,
        `${name} cita la ruta inexistente '${relPath}'`
      );
    }
  }

  // 4. Verificación de H06: pnpm test y ci.yml ejecutan docs/adr/verify-adr.test.mjs
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /docs\/adr\/verify-adr\.test\.mjs/);
  const ciYaml = readFileSync(resolve(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ciYaml, /docs\/adr\/verify-adr\.test\.mjs/);
});
