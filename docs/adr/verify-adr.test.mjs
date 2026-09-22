import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ADR_DIR = dirname(fileURLToPath(import.meta.url));
const ADR_README_PATH = resolve(ADR_DIR, 'README.md');
const ADR_0001_PATH = resolve(ADR_DIR, 'ADR-0001-supabase-baas.md');
const ADR_0002_PATH = resolve(ADR_DIR, 'ADR-0002-hosting-and-cron.md');

test('1. Existe el índice docs/adr/README.md con la convención [DATO] y [SUPUESTO]', () => {
  assert.equal(existsSync(ADR_README_PATH), true, 'Falta docs/adr/README.md');
  const content = readFileSync(ADR_README_PATH, 'utf8');
  assert.match(content, /ADR-0001/);
  assert.match(content, /ADR-0002/);
  assert.match(content, /\[DATO\]/);
  assert.match(content, /\[SUPUESTO\]/);
});

test('2. ADR-0001 documenta modelo relacional/ACID, RLS, push manual, backups/PITR y exclusión de courier-docs', () => {
  assert.equal(existsSync(ADR_0001_PATH), true, 'Falta docs/adr/ADR-0001-supabase-baas.md');
  const content = readFileSync(ADR_0001_PATH, 'utf8');

  // 1. Modelo relacional y ACID
  assert.match(content, /ACID/i);
  assert.match(content, /SELECT\s*\.\.\.\s*FOR UPDATE/i);
  assert.match(content, /SECURITY DEFINER/);
  assert.match(content, /accept_offer/);

  // 2. RLS y revelación progresiva (D3, D8, D15)
  assert.match(content, /Row Level Security/);
  assert.match(content, /delivery_request_contacts/);
  assert.match(content, /courier-docs/);
  assert.match(content, /audit_log/);

  // 3. Push manual Web Push (VAPID) desde Next.js vs Edge Functions
  assert.match(content, /push_subscriptions/);
  assert.match(content, /web-push|VAPID/i);
  assert.match(content, /best-effort/i);

  // 4. Backups, PITR y exclusión explícita de courier-docs del backup (D8)
  assert.match(content, /PITR|Point-in-Time Recovery/i);
  assert.match(content, /purge_after/);
  assert.match(content, /exclusi[óo]n.*courier-docs|courier-docs.*exclu/i);
  assert.match(content, /T-310/);
});

test('3. ADR-0001 incluye costos por ambiente en USD marcados como [DATO] o [SUPUESTO] y revisión de las 3 personas', () => {
  assert.equal(existsSync(ADR_0001_PATH), true, 'Falta docs/adr/ADR-0001-supabase-baas.md');
  const content = readFileSync(ADR_0001_PATH, 'utf8');

  // Ambientes requeridos
  assert.match(content, /local/);
  assert.match(content, /develop/);
  assert.match(content, /cadeapp-staging/);
  assert.match(content, /cadeapp-prod/);

  // Etiquetas obligatorias de costos en USD
  assert.match(content, /USD/);
  const datoMatches = content.match(/\[DATO\]/g) ?? [];
  const supuestoMatches = content.match(/\[SUPUESTO\]/g) ?? [];
  assert.ok(datoMatches.length >= 5, `Se esperaban >= 5 etiquetas [DATO], encontradas: ${datoMatches.length}`);
  assert.ok(supuestoMatches.length >= 3, `Se esperaban >= 3 etiquetas [SUPUESTO], encontradas: ${supuestoMatches.length}`);

  // Revisión de las 3 personas (P1, P2, P3)
  assert.match(content, /Lautaro073/);
  assert.match(content, /persona2/);
  assert.match(content, /persona3/);
});

test('4. ADR-0002 documenta hosting en Vercel, cron /api/cron/sweep con CRON_SECRET y expiración perezosa', () => {
  assert.equal(existsSync(ADR_0002_PATH), true, 'Falta docs/adr/ADR-0002-hosting-and-cron.md');
  const content = readFileSync(ADR_0002_PATH, 'utf8');

  // Hosting y restricciones del plan Hobby vs Pro (S1)
  assert.match(content, /Vercel/);
  assert.match(content, /Hobby/i);
  assert.match(content, /Pro/i);

  // Estrategia de cron y seguridad
  assert.match(content, /\/api\/cron\/sweep/);
  assert.match(content, /CRON_SECRET/);
  assert.match(content, /purge_after/);
  assert.match(content, /subscription_grace_days/);

  // Expiración perezosa (lazy expiration) desacoplada de la frecuencia del cron (S2)
  assert.match(content, /expiraci[óo]n perezosa|lazy expiration/i);
  assert.match(content, /expires_at <= now\(\)/);
});

test('5. ADR-0002 incluye costos en USD marcados como [DATO] o [SUPUESTO] y revisión de las 3 personas', () => {
  assert.equal(existsSync(ADR_0002_PATH), true, 'Falta docs/adr/ADR-0002-hosting-and-cron.md');
  const content = readFileSync(ADR_0002_PATH, 'utf8');

  assert.match(content, /USD/);
  const datoMatches = content.match(/\[DATO\]/g) ?? [];
  const supuestoMatches = content.match(/\[SUPUESTO\]/g) ?? [];
  assert.ok(datoMatches.length >= 4, `Se esperaban >= 4 etiquetas [DATO], encontradas: ${datoMatches.length}`);
  assert.ok(supuestoMatches.length >= 3, `Se esperaban >= 3 etiquetas [SUPUESTO], encontradas: ${supuestoMatches.length}`);

  // Revisión de las 3 personas (P1, P2, P3)
  assert.match(content, /Lautaro073/);
  assert.match(content, /persona2/);
  assert.match(content, /persona3/);
});
