# Evidencia y comandos — PR #402 ronda 1

SHA auditado: `81f277970928dc50ddb1fcea709bf0319f9e6f64`. La ejecución de CI citada corresponde a ese HEAD; el commit de revisión posterior no cambia código.

## Evidencia directa

- H01: `src/features/admin/components/publication-credits-dialogs.tsx:39-51` usa `useRef` para `operationKey`, `GrantCreditsDialog` desmonta formulario en :83-92 y `RegisterPeriodDialog` hace lo mismo en :247-255; pruebas presentes sobre retry dentro del mismo montaje (merchant-credits-view.test.tsx:103-157). No se probó recarga.
- H02: `src/features/trips/components/trip-merchant-container.tsx:39-54`, solo `notify.error` genérico en rama de falla de `merchantReportNoShowAction`; `replaceError` solo se actualiza en `handleConfirmReplace`. Los tests del diálogo no ejercitan no-show fallido.
- H03: `src/features/admin/queries.ts:666-676` hace `.limit(100)` y retorna array sin cursor; dos consumidores tienen arrays estáticos (`publication-plans-manager.tsx:60-105`, `publication-credits-dialogs.tsx:262-275`).
- H04: `src/features/admin/queries.ts:633-675` verifica admin y AAL2 en la aplicación, luego lee con `createAdminClient`, sin RPC SQL; no se atribuye bypass confirmado. `docs/tasks/T-369.md` en el PR declara esta decisión supuestamente humana; CC-029 mergeado no tenía RPC de listado. D01-B elegida por el usuario.

## CI real — no repetir conjeturas

- https://github.com/cadeApp/cadeApp/actions/runs/39062365789
- `unit` job 117482862760: `Test Files 145 passed (145)`, `Tests 2718 passed (2718)`.
- `db-tests` job 117482862558: `Files=29, Tests=2735, Result: PASS`. Runner T369 `TODOS LOS ESCENARIOS MULTISESIÓN OK (8/8)`.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget` success en ese mismo SHA. E2E Preview pending al consultar. `approval-policy` fallo por ausencia del bloque de revisión.
- La bitácora del autor cita 16 mutaciones locales de UI, pero **no fueron reproducidas independientemente**, así que esta ronda no las atribuye al revisor.

## Casos RED→GREEN a construir y reproducir por agy

### H01

1. Emular una RPC que confirma el lote y pierde la respuesta; desmontar y volver a montar el diálogo, o recargar la página con `sessionStorage` real/mocado adecuadamente. La prueba debe exigir **el mismo operationKey** en el reintento del mismo merchant/tipo/payload. El código actual genera otro UUID (RED).
2. Resolver la operación: al recibir resultado definitivo, borrar clave pendiente. Una nueva compra **idéntica pero intencional** debe obtener un UUID nuevo. Si cambia merchant, tipo, cantidad, origen o nota debe tener distinta key, sin guardar texto libre de nota en storage.
3. Mutación NEGATIVA en memoria sobre el nuevo hook: eliminar restauración de sesión manteniendo misma prueba => falla; revertir => GREEN. No reescribir expectations.

### H02

1. Rechazo de `merchantReportNoShowAction` con `INVALID_STATE_TRANSITION`: debe quedar `role=alert` en el diálogo, con mensaje de dominio; no debe llamarse `republishTripAction` ni cerrar el diálogo. Versión actual tiene toast pero ningún alert (RED).
2. Mutación de nueva rama `setReplaceError(...)` temporalmente omitida, misma prueba => RED; restaurar => GREEN. También test de nuevo intento y cierre.

### H03

1. Fixture de 151 planes con sort duplicado e inactivos dispersos: comprobar páginas 50/50/50/1 con nextCursor y sin duplicación; selección activa en página 4 también accesible desde registro; `.limit(100)` actual omite filas (RED).
2. Mutación que reinstala corte 100 o hace ordenar por sort sin id -> misma prueba debe detectar pérdida/duplicación. Si en tests de UI se mockea la RPC, eso no sustituye pgTAP de consulta paginada.

### H04 / D01-B

1. pgTAP de permisos: `anon` y comercio no acceden; admin AAL1 no accede, admin AAL2 sí. Intentos directos SELECT para `anon` y `authenticated` se rechazan y RLS sigue activo. La función debe ejecutar `app_private.assert_admin_aal2()` al inicio y no aceptar de cliente `role/admin` ni claims editables como prueba.
2. Mutación que quita la llamada a `assert_admin_aal2` de migración efímera: exactamente mismas pruebas de autorización deben fallar por acceso indebido, luego volver verde. Mutación que concede SELECT directo a `authenticated`: pgTAP de bypass debe caer.
3. Test de frontera Zod con payload inválido, cursor parcial, limit 0/51; no permitir listar planes desde service role en query o RPC wrapper.

## Comandos para agy (NO ejecutados por revisor)

```bash
git fetch origin && git switch feat/T-369-ui && git pull --ff-only origin feat/T-369-ui
git merge origin/develop  # no rebase; resolver conflictos de forma explícita
git diff --check origin/develop...HEAD
pnpm db:types
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm supabase test db supabase/tests/t369_publication_credits.sql
node docs/revision-pr/analizar.mjs verificacion
git status --short && git rev-parse HEAD && git ls-remote origin feat/T-369-ui
```

Las pruebas SQL van en CI `db-tests` contra base efímera. No conectar ni alterar Supabase Develop/staging/producción manualmente. Registrar comandos, entorno, run URLs, SHA y resultados reales en `docs/tasks/log/T-369.md`.

**Regla obligatoria:** prohibido tests falsos, asserts adulteradas, `.skip`/`.only`, fake que evita el camino real, desactivar gates, fingir RED o escribir la carpeta `docs/revision-pr/pr-402/**` desde agy. Al añadir solo documentación de la revisión, no pedir nuevo CI green exclusivamente por ello.

## Ronda 3 — harness completo de controles independientes (estáticos)

Se ejecutó el mismo código de `audit`/negativos en una sesión aislada con los contenidos de cinco archivos obtenidos vía GitHub del SHA `cd573afbc4c7c6d895145eea26285ca0ee14ffad`, con resultados `14/14` y `7/7`. Se reproduce sobre un checkout idéntico del SHA con Node, sin dependencias ni DB.

```js
// Revisión independiente PR402 ronda 3. Ejecutar en raíz del repo: node /tmp/pr402-r3-oraculo.mjs
// Lee archivos del SHA checkout; NO conecta a DB, no ejecuta mutaciones SQL.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const paths={
 runner:'supabase/tests/integration/t369_admin_list_plans_mutations.mjs',
 sql:'supabase/tests/t369_publication_credits.sql',
 ui:'src/features/trips/components/trip-merchant-container.tsx',
 test:'src/features/trips/components/trip-replace-courier-dialog.test.tsx',
 workflow:'.github/workflows/ci.yml'
};
const f=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,readFileSync(path,'utf8')]));
function audit(g){
 const specs=[
 ['runner en CI',g.runner.includes("process.env.CI !== 'true'")&&g.runner.includes("/^supabase_db_/")],
 ['suite inmutable',g.runner.includes("readFileSync(SUITE, 'utf8')")&&g.runner.includes("runSuite('baseline')")],
 ['rechazo fallo de psql',g.runner.includes("if (res.status !== 0)")&&g.runner.includes("if (res.error || res.signal)")],
 ['plan y fallos detectados por TAP',g.runner.includes("/^1\\.\\.\\d+$/")&&g.runner.includes("/^not ok \\d+/")],
 ['mutante autorizado real',g.runner.includes("redefine('M1'")&&g.runner.includes('assert_admin_aal2();')],
 ['mutante grant ACL real',g.runner.includes('grant select on table public.publication_plans to authenticated')&&g.runner.includes('revoke select on table public.publication_plans from authenticated')],
 ['mutante cursor real',g.runner.includes("redefine('M3'")&&g.runner.includes('(pl.sort, pl.id) > (p_after_sort, p_after_id)')],
 ['mutante desempate real',g.runner.includes("redefine('M3b'")&&g.runner.includes('pl.sort > p_after_sort')],
 ['rechaza RED sin aserciones',g.runner.includes('red.failed.length === 0 || missing.length > 0')&&g.runner.includes('red.total !== baseline.total')],
 ['restauración garantizada',g.runner.includes("finally {\n    restore();")&&g.runner.includes('functionMd5() !== originalMd5 || tableAcl() !== originalAcl')],
 ['suite pgTAP contiene nombres esperados',[
 'D01-B: sin usuario autenticado da UNAUTHENTICATED',
 'D01-B: 151 planes se recorren en páginas 50/50/50/1',
 'D01-B: publication_plans sigue con RLS y sin SELECT para anon/authenticated'
 ].every(s=>g.sql.includes(s))],
 ['H02 catch + alerta',g.ui.includes("try {\n        res = await merchantReportNoShowAction")&&g.ui.includes("if (replaceOpen) setReplaceError(getDomainErrorMessage('INTERNAL_ERROR'))")],
 ['H02 test rechazo real',g.test.includes("mockRejectedValueOnce(new Error('network'))")&&g.test.includes("getDomainErrorMessage('INTERNAL_ERROR')")],
 ['runner en CI y GREEN posterior',g.workflow.includes('node supabase/tests/integration/t369_admin_list_plans_mutations.mjs')&&g.workflow.includes('# Verificación final GREEN de toda la suite tras restauración')]
 ];
 return specs;
}
const original=audit(f);
for(const [name,ok] of original)assert.equal(ok,true,'Control original: '+name);
const mutations=[
 ['sin guarda CI',{...f,runner:f.runner.replace("process.env.CI !== 'true'",'false')},'runner en CI'],
 ['sin baseline',{...f,runner:f.runner.replace("runSuite('baseline')",'({total:0,failed:[]})')},'suite inmutable'],
 ['sin M1',{...f,runner:f.runner.replace("redefine('M1'","redefine('M5'")},'mutante autorizado real'],
 ['sin condición RED vacío',{...f,runner:f.runner.replace('red.failed.length === 0 || missing.length > 0','missing.length > 0')},'rechaza RED sin aserciones'],
 ['sin finally restore',{...f,runner:f.runner.replace("finally {\n    restore();","finally {\n    // restore();")},'restauración garantizada'],
 ['sin catch no-show',{...f,ui:f.ui.replace("try {\n        res = await merchantReportNoShowAction","// try removed\n        res = await merchantReportNoShowAction")},'H02 catch + alerta'],
 ['sin test rechazo',{...f,test:f.test.replace("mockRejectedValueOnce(new Error('network'))","mockResolvedValueOnce({ok:false,code:'INTERNAL_ERROR'})")},'H02 test rechazo real']
];
for(const [label,mutant,target] of mutations){
 const result=audit(mutant).find(([name])=>name===target)?.[1];
 assert.equal(result,false,'Control negativo no detectó '+label);
}
console.log('ORACULO_ESTÁTICO PR402: 14/14 propiedades + 7/7 controles negativos PASS');
// LIMITACIÓN: son verificaciones de texto/estructura, no sustituyen el runtime del job db-tests.
// Ver CI auténtico: https://github.com/cadeApp/cadeApp/actions/runs/39087097148/job/117555836464

```

**Límite:** las mutaciones de este script modifican solo COPIAS DE TEXTO. Los mutantes SQL reales que prueban la RPC se ejecutaron en el job `117555836464` del run `39087097148`, con logs citados en `evidencia/ronda-3.md`.
