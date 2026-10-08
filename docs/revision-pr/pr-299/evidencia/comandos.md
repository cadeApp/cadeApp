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

---

# Ronda 2 — nueva evidencia independiente, SHA `5250d51922bf67a2f2555fe824c791ffe94ab1a3`

## Logs de CI del SHA

- Run `37750956332`. Unit job `113223757529`: 125 archivos / 1999 tests en verde, pero falla `coverage for branches 89.74% < 90%` sobre `src/domain/testing/rpc-fake.ts`.
- DB job `113223757743`: migración T-339 aplicada; `rpc_offers.sql` PASS, `rpc_requests.sql` 7/1241 FAIL: tests 1098, 1103, 1104, 1148, 1154, 1161 y 1198; `t339_fixed_price.sql:68` CHECK `zones_centroid_lng_bounds`, 0 de 45 aserciones ejecutadas.
- Fuente anterior del reloj y precedencia: `supabase/migrations/20261002010000_cc015_admin_cancel_requires_incident.sql` leída desde develop. Usa `v_now timestamptz := now();` y chequea `REASON_REQUIRED` antes de validar incidentes. Nuevo `request_cycle` de T-339 usa `clock_timestamp()` y orden opuesto.
- Vercel bot en PR informa falla `api-deployments-free-per-day` (>100); no declarar `e2e-preview` verde.

## Harness de invariantes estructurales R2 (completo, lectura solamente)

Copia el código desde este archivo a `/tmp/audit-pr299-r2.mjs` en un checkout limpio del SHA; ejecutalo con `PR299_ROOT="$PWD" node /tmp/audit-pr299-r2.mjs`. Es **control auxiliar**, nunca una demostración de concurrencia SQL.

```js audit-pr299-r2.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.env.PR299_ROOT || process.cwd();
const read=(p)=>readFileSync(join(root,p),'utf8');
const migration=read('supabase/migrations/20261007090000_t339_fixed_price.sql');
const pg=read('supabase/tests/t339_fixed_price.sql');
const tests=read('src/domain/t339-fixed-price.test.ts');
const e2e=read('e2e/specs/fixed-price.spec.ts');
const fn=(name)=>{
  const start=migration.indexOf('create or replace function '+name+'(');
  if(start<0)throw new Error('No encontrado '+name);
  return migration.slice(start,migration.indexOf('\n$$;',start));
};
const cycle=fn('app_private.request_cycle');
const take=fn('public.take_request');
const acc=fn('public.accept_offer');
const checks=[
['H01 fixed consent declaration',/v_consent_status public\.consent_status;/.test(cycle)&&/into v_role, v_consent_status/.test(cycle)],
['H02 request precedes offer FOR UPDATE',acc.indexOf('for update;',acc.indexOf('where id = v_offer.request_id'))>=0],
['H03 fixed-price retry gate',/if v_req\.fixed_price_ars is not null then/.test(take.slice(take.indexOf('-- 5. Idempotencia'),take.indexOf('-- 6. Estado')))],
['H04 plan equals count',Number(pg.match(/select plan\((\d+)\)/)?.[1])===[...pg.matchAll(/^\s*select\s+(?:is|ok|throws_ok|lives_ok|results_eq|bag_eq|set_eq)\s*\(/gmi)].length],
['H05 test has genuine 2-session concurrency',/dblink|pg_background/i.test(pg)||/Promise\.all\(/.test(e2e)],
['H07 valid distinct attempts',/11th offer on a new valid request/.test(tests)],
['H08 merchant publishes from UI',/gotoNewRequest\(/.test(e2e)&&/submitRequestButton\.click\(\)/.test(e2e)],
['H09 no any',!/Record<string,\s*any>/.test(tests)],
['H11 request_cycle preserves transaction clock',/v_now timestamptz := now\(\)/.test(cycle)],
['H12 reason required before incident check',cycle.indexOf("raise exception 'REASON_REQUIRED'")<cycle.indexOf('and not exists (select 1 from public.incidents')],
['H13 valid zone seeded directly',!/values\s*\(pg_temp\.zone_id\(\),\s*'Centro Aguilares',\s*true,\s*-27\.4333,\s*-27\.4333\)/i.test(pg)]
];
let failures=0;
for(const [label,ok] of checks){console.log((ok?'GREEN ':'RED   ')+label);if(!ok)failures++}
console.log('TOTAL RED='+failures);
if(failures)process.exitCode=1;
```

**Resultados de inspección sobre los blobs exactos del SHA:** H01/H02/H03/H04/H07/H08/H09 = GREEN; H05/H11/H12/H13 = RED, y la cobertura H06 además es ROJA en CI. El control H05 es deliberadamente un proxy estático: incluso que muestre GREEN tras agregar `Promise.all` **NO valida dos transacciones reales**; verificar clientes Supabase distintos y el resultado en DB. El script tampoco comprueba mutaciones RED de SQL: esas requieren CI/DB. No se ejecutó una copia física en /tmp, porque en esta sesión no hay clone ni acceso DNS a GitHub; no se afirma lo contrario.

## Mutaciones RED que la revisión exigirá en R3

- H11: cambiar `v_now := now()` de `app_private.request_cycle` a `clock_timestamp()` en copia temporal → los seis timestamps dejan de coincidir.
- H12: mover nuevamente validación de incidente sobre `REASON_REQUIRED` → `rpc_requests.sql` caso 1161 debe devolver INVALID_STATE_TRANSITION y ponerse rojo.
- H13: en `INSERT zones` cambiar longitud `-65.6133` a `-27.4333` → error 23514, no disfrazarlo como aserción de éxito.
- H05: remover `FOR UPDATE` de request o alterar el orden de lock en el código en memoria → un test realmente paralelo debe fallar en su invariante (no en fixture).
- H06: mutar rama de error específica del fake → nueva aserción de comportamiento entra RED, restaurar y `pnpm test:coverage` GREEN con >=90% en CI.
- H02/H03/H04/H08: conservar los arreglos e incluir pruebas independientes verificables, no aceptar solo el «6/6 GREEN» del auditor del autor.

**No adulterar tests, snapshots, mocks o cobertura.** Todos los RED deben fallar por la propiedad prometida. Sin Docker ni Supabase remoto/local desde el agente; integración en `db-tests` y `e2e-preview` de CI. No disparar workflows manualmente, no editar `docs/revision-pr/**` desde la sesión autora.

