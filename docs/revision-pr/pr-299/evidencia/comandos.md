# Evidencia reproducible — PR #299, revisión independiente

**HEAD de producto revisado:** `6fbde29f48cc502ff497d18c4488fcd442246bf6`. **Fecha:** 2026-10-08. No hay checkout local montado para esta sesión: el origen son blobs exactos obtenidos mediante GitHub y logs del CI. No se ha ejecutado pgTAP ni un E2E de integración desde este entorno. No ejecutar Docker/Supabase local o remoto.

## RED confirmados por CI del SHA

GitHub Actions, run `37743943883`:

- Job `db-tests`, ID `113200879815`: al aplicar `20261007090000_t339_fixed_price.sql` → `ERROR: "v_consent_status" is not a known variable (SQLSTATE 42601)`; exit 1. La migración nunca llega a probar SQL pgTAP nuevo.
- Job `unit`, ID `113200879836`: 125 test files / 1987 tests PASS; seguido de `ERROR: Coverage for branches (88.14%) does not meet "src/domain/**/*.ts" threshold (90%) for src/domain/testing/rpc-fake.ts`; exit 1.
- `lint`, `typecheck`, `build`, `audit` y `bundle-budget`: success, no sustituyen DB ni cobertura. `e2e-preview` no verificado de forma independiente sobre el SHA.

## Batería independiente de comprobación estática: código COMPLETO

Copiar el harness al directorio temporal sin tocar ningún archivo del repo:

```bash
awk '/^```js audit-pr299.mjs$/{inside=1;next} /^```$/{if(inside)exit} inside{print}' \
  docs/revision-pr/pr-299/evidencia/comandos.md > /tmp/audit-pr299.mjs
PR299_ROOT="$PWD" node /tmp/audit-pr299.mjs
```

En el HEAD original la ejecución **debe terminar roja** porque las propiedades de H01/H02/H03/H04/H08/H09 no están satisfechas. Después de corregir las seis, se espera verde. Es un oráculo **estructural auxiliar**, no prueba lógica de SQL ni sustituto de pgTAP/CI.

```js audit-pr299.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.PR299_ROOT || process.cwd();
const get = (path) => readFileSync(join(root, path), 'utf8');
const sql = get('supabase/migrations/20261007090000_t339_fixed_price.sql');
const pgtap = get('supabase/tests/t339_fixed_price.sql');
const domain = get('src/domain/t339-fixed-price.test.ts');
const e2e = get('e2e/specs/fixed-price.spec.ts');

function block(source, name) {
  const start = source.toLowerCase().indexOf('create or replace function ' + name.toLowerCase() + '(');
  assert(start >= 0, 'No existe la función ' + name);
  const end = source.indexOf('\n$$;', start);
  assert(end > start, 'Falta cierre de función ' + name);
  return source.slice(start, end);
}
function consentIsConsistent(s) {
  const b = block(s, 'app_private.request_cycle');
  return /\bv_consent_status\s+public\.consent_status\s*;/i.test(b) &&
    /into\s+v_role\s*,\s*v_consent_status/i.test(b) &&
    /\bv_consent_status\s+is\s+distinct\s+from\s+'active'/i.test(b);
}
function offerLockedBeforeRequest(s) {
  const b = block(s, 'public.accept_offer');
  const offer = b.indexOf('where id = p_offer_id');
  const req = b.indexOf('where id = v_offer.request_id');
  return offer !== -1 && req > offer && /for share/i.test(b.slice(offer, req));
}
function fixedPriceGuardOnRetry(s) {
  const b = block(s, 'public.take_request');
  const start = b.indexOf('-- 5. Idempotencia');
  const end = b.indexOf('-- 6. Estado', start);
  assert(start >= 0 && end > start, 'Bloque de idempotencia no localizable');
  return /v_req\.fixed_price_ars\s+is\s+not\s+null/i.test(b.slice(start, end));
}
function pgtapBalanced(s) {
  const planned = Number(s.match(/select\s+plan\((\d+)\)/i)?.[1]);
  const assertions = [...s.matchAll(/^\s*select\s+(?:is|ok|throws_ok|lives_ok|results_eq|set_eq|bag_eq)\s*\(/gmi)].length;
  return { planned, assertions, ok: planned === assertions };
}

const props = [
  ['H01 actor consent', consentIsConsistent(sql)],
  ['H02 lock order', !offerLockedBeforeRequest(sql)],
  ['H03 fixed price for idempotence', fixedPriceGuardOnRetry(sql)],
  ['H04 pgTAP assertion count', pgtapBalanced(pgtap).ok],
  ['H08 E2E UI publication', !e2e.includes('seedDeliveryRequestInState') || /goto\([^)]*merchant[^)]*\)[\s\S]*?getByLabel/i.test(e2e)],
  ['H09 no any', !/\bRecord<string,\s*any\s*>/.test(domain)],
];

let failures = 0;
for (const [name, valid] of props) {
  console.log((valid ? 'GREEN ' : 'RED   ') + name);
  if (!valid) failures++;
}
console.log('pgTAP ' + JSON.stringify(pgtapBalanced(pgtap)));

// Prueba de sensibilidad de detectores sobre transformaciones en memoria.
// Las variantes NO se escriben en el repo y NO simulan una ejecución PostgreSQL.
const consentRepaired = sql
  .replace('v_consent public.consent_status;', 'v_consent_status public.consent_status;')
  .replace("(v_consent is distinct from 'active')", "(v_consent_status is distinct from 'active')");
assert.equal(consentIsConsistent(consentRepaired), true, 'control consentimiento no reconoce fixture corregida');
assert.equal(consentIsConsistent(sql), false, 'control consentimiento no detecta bug');
assert.equal(pgtapBalanced(pgtap).planned, 28);
assert.equal(pgtapBalanced(pgtap).assertions, 26);
assert.equal(pgtapBalanced(pgtap.replace('select plan(28)', 'select plan(26)')).ok, true);

if (failures) {
  console.error('FAIL: ' + failures + ' invariantes de PR299 incumplidas');
  process.exitCode = 1;
} else {
  console.log('PASS: invariantes estructurales');
}
```

**Verificación de ejecución:** la lógica equivalente se calculó sobre los blobs de `6fbde29` con un runner JS independiente de GitHub (resultado: seis checks RED; contador plan=28, aserciones=26). No se pudo ejecutar físicamente el archivo extraído en /tmp por falta de checkout del repositorio en el contenedor. No escribir «harness ejecutado en /tmp» hasta verificarlo al retomar.

## Mutaciones RED de comportamiento que debe hacer el autor y revalidar luego la revisión

| ID | Mutación en memoria / worktree efímero | Qué aserción debe quedar roja |
|---|---|---|
| H01 | revertir nombre `v_consent_status` a `v_consent` solo en declaración | falla aplicación de migración; luego restaurar |
| H02 | volver a mover el lock de oferta antes del lock de solicitud | test real dos sesiones `accept_offer` queda rojo por `40P01` o timeout, sin quedarse colgado |
| H03 | retirar condición `fixed_price_ars IS NOT NULL` en idempotencia SQL y fake | toma de solicitud sin precio con oferta propia pending/accepted debe devolver `NO_FIXED_PRICE` |
| H04 | quitar comparación de piso al publicar | prueba de precio 999 vs piso 1000 debe ser roja por respuesta incorrecta |
| H05 | quitar `FOR UPDATE` de solicitud o `FOR SHARE` de courier (de una sola ruta) | prueba real de carrera detecta doble match o match de courier no elegible |
| H06 | convertir rama de rechazo de `take_request` a éxito | test de error específico debe caer, además de cumplir cobertura 90% |
| H07 | mover comprobación de `RATE_LIMITED` por delante de `REQUEST_EXPIRED` en fake | test precondicionado con límite verdaderamente agotado debe caer |
| H08 | omitir `auto_assign` o `fixed_price_ars` del payload UI | E2E publicando desde formulario falla su comprobación DB |
| H09 | reintroducir `any` | grep/guard de tipos deja de pasar |

Toda mutación se revierte **en memoria**, nunca con `git checkout` destructivo de cambios ajenos. Guardar salida RED y GREEN de cada prueba concreta, no solo afirmar «mutado».

## Comandos finales cuando el autor arregle

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
node tools/verify-fichas.test.ts
# pnpm db:types y pnpm test:db delegados al job db-tests del CI (sin Docker local)
git diff --check
git status --short
git ls-remote origin feat/T-339-precio-fijo
```

Abrir logs del nuevo SHA: verificar aplicación de migración, archivos/número/resultados pgTAP, `pnpm db:types --local` y `git diff --exit-code`; después comprobar E2E preview del nuevo SHA. No alterar thresholds, no marcar «verificado» en bitácora y no escribir `docs/revision-pr/**` desde el agente autor.

