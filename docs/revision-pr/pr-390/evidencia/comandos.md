# Evidencia y comandos — PR #390, ronda 1

**Fuente revisada:** GitHub #390 HEAD `6f8ff6d81862e21c622c0e5d88a803867d68f403` y `develop` observado `50c99b00e1235b426dc98a98aa0183592d6fba50`.
**Hecho:** inspección vía API GitHub del patch (+32 líneas `docs/tasks/log/T-365.md`), ficha, bitácora, SQL y TypeScript; conector `compare_commits` informó status diverged, ahead 2/behind 2.
**No hecho:** no hay clon local de codebase en este entorno (red GitHub no resuelve DNS para git), por ello no se ejecutaron comandos git locales, tests, TypeScript, lint, pgTAP, E2E ni mutaciones sobre repositorio. Los reportes GREEN de bitácora son atribuidos al autor y al baseline, no a esta revisión.

## Verificación en checkout limpio (para ejecutar en ronda 2)
```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/develop
git diff --stat origin/develop...HEAD
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
git log --oneline -- docs/revision-pr/pr-390/
# No leer secretos / .env*; no levantar Docker/Supabase local.
pnpm typecheck > /tmp/t365-typecheck.log 2>&1; tail -n 12 /tmp/t365-typecheck.log
pnpm lint > /tmp/t365-lint.log 2>&1; tail -n 12 /tmp/t365-lint.log
pnpm test > /tmp/t365-test.log 2>&1; grep -E 'Test Files|Tests |Duration' /tmp/t365-test.log | tail -n 7
pnpm vitest run src/server/live/t204.test.ts src/features/requests/queries.test.ts src/features/requests/components/request-offers.test.tsx src/features/requests/hooks/use-request-offers.test.tsx
node docs/revision-pr/analizar.mjs verificacion
```

## Checker independiente estático con mutaciones EN MEMORIA (NO EQUIVALE A TEST RUNTIME)
Este harness es de la revisión, no reutiliza uno del autor. Copiar íntegro `cat` a `/tmp`, luego ejecutarlo desde la raíz del repo con `node /tmp/pr390-audit.cjs`. En el HEAD previo al fix debe indicar RED para ambos filtros ausentes; simula un GREEN inyectando el filtro en memoria y RED volviendo a quitarlo. **Sin ejecución acreditada en esta ronda**. Después del fix el original debe ser GREEN y quitar cada filtro debe ser RED.

```bash
cat >/tmp/pr390-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const paths = {
  live: 'src/server/live/t204.ts',
  ssr: 'src/features/requests/queries.ts',
};
function source(path) { return fs.readFileSync(path, 'utf8'); }
function queryBlock(s, anchor, method = ".from('offers')") {
  const start = s.indexOf(anchor);
  assert(start >= 0, 'falta símbolo ' + anchor);
  const from = s.indexOf(method, start);
  assert(from >= 0, 'falta consulta offers');
  const finish = s.indexOf('.limit(', from);
  assert(finish > from, 'falta paginación de offers');
  return s.slice(from, finish + 30);
}
const pending = /\.eq\(\s*['"]status['"]\s*,\s*['"]pending['"]\s*\)/;
function hasFilter(q) { return pending.test(q); }
function inject(q) {
  const replaced = q.replace(/(\.eq\(\s*['"]request_id['"]\s*,\s*[^)]+\))/, "$1\n      .eq('status', 'pending')");
  assert(replaced !== q, 'no se encontró request_id en el builder');
  return replaced;
}
const blocks = {
  live: queryBlock(source(paths.live), 'export async function getRequestOffersLiveServer'),
  ssr: queryBlock(source(paths.ssr), 'export async function getMerchantRequestWithOffers'),
};
for (const [name, original] of Object.entries(blocks)) {
  const originalGreen = hasFilter(original);
  const candidateGreen = originalGreen ? original : inject(original);
  const mutant = candidateGreen.replace(pending, '');
  assert(hasFilter(candidateGreen), 'instrumento no detecta la inclusión ' + name);
  assert(!hasFilter(mutant), 'mutante debía dar RED para ' + name);
  console.log(name + ': original=' + (originalGreen ? 'GREEN' : 'RED') +
    '; inyección en memoria=GREEN; mutación de sustracción=RED');
}
if (Object.values(blocks).some(b => !hasFilter(b))) {
  process.exitCode = 1; // baseline o corrección incompleta
}
NODE
node /tmp/pr390-audit.cjs
```

### Mutaciones FUNCIONALES que se deben demostrar en ronda 2
- Quitar solo el filtro `status=pending` en `t204.ts` -> test de servicio con ofertas mixtas falla; restaurarlo -> GREEN.
- Quitar solo el filtro `status=pending` en `queries.ts` -> test SSR con 51+ filas mixtas/cursor falla; restaurarlo -> GREEN.
- Quitar guarda `offer.status==='pending'` en CTA Y modal -> pruebas UI con `cancelled` / `expired` / `undefined` fallan; restaurar -> GREEN.
- Desactivar invalidación de caché al cancelar/reconectar -> test de integración con respuesta stale falla; restaurar -> GREEN.
- CC separado: cambiar autorización de dueño por `true` o retornar `reason` libre -> pgTAP con actor ajeno/campo prohibido RED; restaurar -> GREEN, CI db-tests del SHA.
- E2E Preview `match→courier_cancel→offers→historial→nueva oferta→rematch`, dos cuentas segregadas; observar rechazo real de oferta vieja (RPC).

**No ejecutar mutaciones en producción ni desplegar código inseguro.** Ninguna prueba está presentada como ya ejecutada.

## Ronda 2 — evidencia independiente y harness reproducible

La inspección estática independiente sobre código remoto exacto del SHA `6356f994457954b5ff0a5c7c27bb01098697d6fb` dio:
- Live: filtro en lugar correcto GREEN; mutación de eliminar el mismo filtro en cadena (sin persistir) RED.
- SSR: filtro en lugar correcto GREEN; mutación equivalente RED.
- Modal: `offers=[]`, `initialOffers=[{id:'offer-old',status:'pending'}]`, `request.status='published'` => condición actual `shouldClose=false`, confirmar habilitado. Este experimento evalúa la expresión extraída del archivo; **NO es prueba de interacción React**.
- Test «refetchea»: contiene aserción de mensaje, ninguna aserción que capture llamada a fetch/refetch en ese caso.

GitHub CI HEAD:
- Job unit 117312028603: `Test Files 135 passed`, `Tests 2498 passed`, workflows 79, ADR 6.
- Job db-tests 117312028537: `Files=26 Tests=2341 Result: PASS` final, diff tipos limpio. FAIL intermedio pertenece a prueba de mutación con restauración, no al cierre.
- No se corrió Vitest/Playwright ni Git en local: `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` devolvió `Could not resolve host: github.com`. No hubo acceso a .env ni secretos.

### Batería independiente de escritorio — copiá el script completo a /tmp
```bash
cat >/tmp/pr390-r2-audit.cjs <<'NODE'
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const specs=[
 {path:'src/server/live/t204.ts', anchor:'export async function getRequestOffersLiveServer'},
 {path:'src/features/requests/queries.ts', anchor:'export async function getMerchantRequestWithOffers'},
];
let ok=0;
for(const {path,anchor} of specs){
 const src=fs.readFileSync(path,'utf8'), start=src.indexOf(anchor);
 assert(start>=0,'No existe función '+anchor);
 const from=src.indexOf(".from('offers')",start),limit=src.indexOf('.limit(',from);
 assert(from>start&&limit>from,'No existe el builder esperado: '+path);
 const builder=src.slice(from,limit);
 const req=builder.indexOf(".eq('request_id'"), status=builder.indexOf(".eq('status', 'pending')");
 assert(req>=0,'No tiene request_id: '+path);
 assert(status>req,'No filtró pending previo a pagination: '+path);
 const mutant=builder.slice(0,status)+builder.slice(status).replace(".eq('status', 'pending')",'');
 assert(!mutant.includes(".eq('status', 'pending')"),'mutación no fue RED: '+path);
 console.log('GREEN→RED static-filter '+path);ok++;
}
const src=fs.readFileSync('src/features/requests/components/request-offers-list.tsx','utf8');
const bad=src.includes('const current = currentInOffers ?? currentInInitial;');
if(bad){
 const currentInOffers=undefined, currentInInitial={id:'old',status:'pending'},canAccept=true;
 const current=currentInOffers??currentInInitial;
 const shouldClose=!current||current.status!=='pending'||(currentInInitial&&currentInInitial.status!=='pending')||!canAccept;
 assert.equal(shouldClose,false);
 console.log('RED modal: after refetch [] the initialOffers fallback keeps stale selectedOffer');
 process.exitCode=1;
}else console.log('GREEN static modal: legacy fallback absent (REQUIERE TEST REACT)');
console.log('static filters checked: '+ok);
NODE
node /tmp/pr390-r2-audit.cjs
```
Este harness está concebido para fallar (RED) en el SHA actual por el modal, no para simular GREEN sin código nuevo. Al corregir, debe dar GREEN y **acompañarse** de un test de integración real; no usa la batería del autor. Ejecutarlo con checkout de ese SHA desde raíz del repo y copiarlo íntegro a /tmp para comprobar portabilidad.

### Pruebas RED→GREEN en la futura ronda
1. Test UI con initialOffers prop constante y refetch que retorna []: debe cerrar modal y dejar de admitir action. Mutación restaurando `?? initialOffers` debe hacerlo RED.
2. Test UI de `OFFER_NOT_PENDING`: mutación retirando `void refetch()` debe mostrar RED porque spy de red/cambio observable falta. Tras arreglar GREEN.
3. Test de cinco estados terminales más status ausente: cada status genera una ejecución real, no descripción aspiracional. Mutación de guardia para ese estado debe RED.
4. Test query con fixture de 51+ filas mezcladas y builder que aplica filtros; mutación eliminando `eq(status,pending)` de Live y SSR por separado debe RED. Restauraciones GREEN.
5. Offline/reconnect debe probar deshabilitación temporal y actualización final, sin alterar la política T-333; capturar salida Vitest original y mutante.

**Nada de mutar archivos versionados directamente con checkout de reversión; usar harness que parchea en memoria o trabajo en /tmp no commiteado.** Sin ejecutar Docker/Supabase local. El E2E real se prueba sobre Preview+Supabase Develop, nunca producción.


## Ronda 3 — evidencias reproducibles, SHA `d156e12f6db9d7f10412c4c3003d8c9d9c1de78c`

### Reproducción ejecutada por inspector (inspección remota + evaluación JS)
1. Leí `src/features/requests/hooks/use-request-offers.ts` y `request-offers-list.tsx` de ese SHA vía GitHub conector. `isOnline` solo refleja `onlineManager`; `canAccept` combina `published && isOnline`, sin barrera de frescura al reanudar.
2. Evaluación de esta condición con request published, isOnline true, una oferta cached pending y flag de frescura after-reconnect false: `source_allows_cta=true`, `should_allow_before_fresh_response=false`. La prueba existente `online -> offline -> reconnect con respuesta tardía` no pregunta por CTA mientras deferred fetch queda pendiente, solo por offline y post-resolución.
3. Mock `queries.test.ts`: `order: vi.fn(function() {return this;})`; mock `t204.test.ts`: `order: vi.fn().mockReturnThis()`. Para los timestamps ascendentes de fixture `pendingOffers` (0-51) el SQL DESC entrega índice **2** como fila 50; test espera índice **49**. Resultado `mock_order_is_noop_both=true`.
4. GitHub REST `pull/390` -> dirty, `compare_commits` -> behind 150. GH GET commit checks de d156e12 -> no job CI integral; branch workflows lista CI sólo en SHA previo.
5. `container.exec git ls-remote` devolvió: `fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com`.
**Nota:** solo resultados de evaluación de expresiones/inspección GitHub; NO son logs Vitest ni pruebas E2E.

### Checker independiente — archivo completo portable a /tmp (requiere checkout del SHA de análisis)
```bash
cat > /tmp/pr390-r3-check.cjs <<'NODE'
const fs=require('node:fs'), assert=require('node:assert/strict');
const ui=fs.readFileSync('src/features/requests/components/request-offers-list.tsx','utf8');
const hook=fs.readFileSync('src/features/requests/hooks/use-request-offers.ts','utf8');
const ssr=fs.readFileSync('src/features/requests/queries.test.ts','utf8');
const live=fs.readFileSync('src/server/live/t204.test.ts','utf8');
assert(ui.includes("const canAccept = request.status === 'published' && isOnline;"));
assert(hook.includes('setIsOnline(online)'));
const published=true, online=true, syncedAfterReconnect=false, cachedPending=true;
const sourceCanAccept=published&&online&&cachedPending;
const correctCanAccept=sourceCanAccept&&syncedAfterReconnect;
assert.equal(sourceCanAccept,true); assert.equal(correctCanAccept,false);
console.log('H13 static RED: recovered network enables cached pending before fresh response');
const start=ssr.indexOf("it('T-365: getMerchantRequestWithOffers filtra funcionalmente");
const end=ssr.indexOf('function mockMerchantDetailClient',start);
assert(start>=0&&end>start);
const ssrBlock=ssr.slice(start,end);
assert(ssrBlock.includes('order: vi.fn(function (this: MockFilteringOffersBuilder)'));
assert(ssrBlock.includes('const expected50thPending = pendingOffers[49]!;'));
const from=live.indexOf("it('T-365: filtra funcionalmente");
const liveBlock=live.slice(from,live.indexOf("describe('3.2 getRequestOffersLiveServer — proyección",from));
assert(from>=0&&liveBlock.includes('order: vi.fn().mockReturnThis()'));
const pending=Array.from({length:52},(_,i)=>({i,dt:'2026-09-26T12:00:'+String(i).padStart(2,'0')}));
const ordered=pending.slice().sort((a,b)=>b.dt.localeCompare(a.dt));
assert.equal(ordered[49].i,2); assert.notEqual(ordered[49].i,49);
console.log('H14 static RED: real descending page 1 cursor index=2, test assumes index=49');
NODE
node /tmp/pr390-r3-check.cjs
```
No hay ejecución acreditada de este script portable sobre un clon en la sesión; la evaluación equivalente de predicados se ejecutó con contenidos leídos de GitHub. No modificar `docs/revision-pr/**` desde el agente.

## Ronda 4 — verificación independiente en checkout local — SHA `368a9d2b7f23570ea0a956696c1b13afa4281f68`

**Ejecución independiente local de checks:**
```powershell
# 1. Typecheck
pnpm.cmd typecheck
# Salida: tsc --noEmit && tsc --project .github/workflows/tsconfig.json -> exit code 0 (0 errores)

# 2. Lint
pnpm.cmd lint
# Salida: next lint --dir src --max-warnings 0 && eslint ... -> exit code 0 (0 warnings, 0 errores)

# 3. Tests unitarios focalizados en componentes de Frente I
pnpm.cmd vitest run src/features/requests/components/request-offers.test.tsx src/features/requests/queries.test.ts src/server/live/t204.test.ts src/features/requests/hooks/use-request-offers.test.tsx
# Salida: 4 passed (4), 158 passed (158), duración 5.84s

# 4. Suite completa de vitest
pnpm.cmd test
# Salida: tests 79 pass, 6 ADR tests pass, workflows pass -> exit code 0

# 5. Integración con develop
git merge-tree $(git merge-base origin/develop HEAD) origin/develop HEAD
# Salida: merge limpio sin conflictos (incorporado en commit bc7afcd5)
```

**Verificación CI GitHub:**
- Run CI `39063665319` (pull_request trigger en SHA `368a9d2b`):
  - `db-tests`: SUCCESS (8m59s)
  - `audit`: SUCCESS (24s)
  - `typecheck`: SUCCESS (27s)
  - `build`: SUCCESS (59s)
  - `unit`: SUCCESS (1m35s)
  - `lint`: SUCCESS (49s)
  - `bundle-budget`: SUCCESS (11s)
- Estado general de CI en commit `368a9d2b`: **SUCCESS**.


## Ronda 5 — evidencia independiente y modelo — 2026-10-18
- SHA funcional: `368a9d2b7f23570ea0a956696c1b13afa4281f68`; HEAD documental: `efdff17f909f045d60811cea568e2a99d0f88c61`.
- GitHub CI run `39063665319`: `unit` 141 suites, 2698 PASS (job `117486695194`); `db-tests` Files=29, Tests=2735, Result:PASS (job `117486695120`). Documentación de revisión R4 lo corroboró localmente (no volver a atribuir esas ejecuciones a R5).
- GitHub status code SHA: `e2e-preview=failure`; run `39063757689`, job `117550374345`: 86 Chromium PASS, una global-settings FAIL (T-306 DoD1, expected alert SUBSCRIPTION_INACTIVE no encontrada en 3 intentos), dos tests no ejecutados.
- GitHub status HEAD docs: `e2e-preview=error` por cancelled en `39105885299`; otros checks CI success. `mergeable_state=unstable`.
- PR #407/T-371 cerró issue #405; merge SHA `0488f8a98f44b67101c7c520696c356d46c161ff`, develop muestra `PUBLICATION_CREDITS_EXHAUSTED` mientras PR #390 aún `SUBSCRIPTION_INACTIVE`.
- TanStack docs guía oficial: https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries ; un refetch infinite query solicita páginas secuencialmente. Inspección del código: `setSyncedAfterReconnect(true)` dentro de `queryFn` antes de retorno de cada página y `currentOffers` desde `query.data.pages` durante refetch.
- Este script propio modela la carrera conceptual, fue ejecutado en Node y devuelve las dos líneas documentadas (NO es test React).

```bash
cat >/tmp/pr390-r5-multipage-model.cjs <<'NODE'
'use strict';
const assert = require('node:assert/strict');
const state={
  online:true, requestStatus:'published', syncedAfterReconnect:false,
  fetchStatus:'fetching',
  oldCachedPages:[
    [{id:'new-offer',status:'pending'}],
    [{id:'cancelled-in-database',status:'pending'}],
  ],
  completedPages:0, totalPages:2,
};
const gate = s => s.requestStatus==='published'&&s.online&&s.syncedAfterReconnect;
assert.equal(gate(state),false);
// En la implementación original, queryFn marca synced=true al finalizar primera página.
state.completedPages=1;
state.syncedAfterReconnect=true;
assert.equal(state.fetchStatus,'fetching');
assert.equal(state.completedPages<state.totalPages,true);
const staleVisible=state.oldCachedPages.flat().some(o=>o.id==='cancelled-in-database'&&o.status==='pending');
assert.equal(staleVisible,true);
assert.equal(gate(state),true);
console.log('MODELO: gate TRUE con 1/2 páginas completas; caché vieja todavía contiene oferta pending cancelada');
const saferGate=s=>gate(s)&&s.fetchStatus==='idle'&&s.completedPages===s.totalPages;
assert.equal(saferGate(state),false);
console.log('MODELO GUARDA DE CONSULTA COMPLETA: FALSE hasta settlement de 2/2 páginas');
NODE
node /tmp/pr390-r5-multipage-model.cjs
```

**Pendiente**: test de integración real con QueryClient, 2 páginas, refetch asincrónico secuencial, segunda promesa diferida, y mutaciones adversarias del reviewer. No simular dichos resultados; la solicitud a Kira es hacer RED/GREEN real y que la siguiente ronda ejecute el checker propio.

## Ronda 6 — auditoría del SHA 115235956844a43b767209ca7c42ed2f07223ba2
- GitHub compare `origin/develop...branch` -> ahead 14 / behind 0, mergeable=true.
- GitHub compare `f6d106f0..1152359` -> 4 archivos propios en los globs permitidos; origin/develop trae los demás.
- Código UI verificado: `{hasNextPage&&!isError}` y botón `onClick={() => void fetchNextPage()}`, `disabled={isFetchingNextPage}`. Hook retorna isFetchingNextPage pero NO isFetching.
- Guía oficial TanStack https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries confirma `fetchNextPage` default `cancelRefetch:true` puede interrumpir refetch; recomienda `!isFetching`.
- Test H16 de UI: `const loadMoreButton=screen.queryByRole(...)`, `if(loadMoreButton)` envuelve click y aserción página 2.
- Corrí este modelo en Node, NO React/Vitest:
```bash
cat > /tmp/pr390-r6-concurrency-model.cjs <<'NODE'
'use strict';
const assert = require('node:assert/strict');
const preClick = {online:true, synced:false, hasNextPage:true, isError:false, isFetching:true, isFetchingNextPage:false};
assert.equal(preClick.isFetchingNextPage,false);
assert.equal(!preClick.online||!preClick.synced||preClick.isFetching||preClick.isFetchingNextPage,true);
console.log('R6 H17: current Cargar mas enabled during general refetch; safe guard disabled');
const s={online:true, requiredPostReconnectGeneration:8, fetchGeneration:8,
 fetchStatus:'idle', error:null, isError:false, isRefetchError:false,
 dataUpdatedAt:1020, reconnectEpoch:1010, errorUpdatedAt:900, priorPagesVerified:false};
const latch=s.online&&s.fetchGeneration>=s.requiredPostReconnectGeneration&&
 s.fetchStatus==='idle'&&!s.error&&!s.isError&&!s.isRefetchError&&
 s.dataUpdatedAt>=s.reconnectEpoch&&s.dataUpdatedAt>=s.errorUpdatedAt;
assert.equal(latch,true);assert.equal(s.priorPagesVerified,false);
console.log('R6 H17: possible latch TRUE after load-more without verifying old pages (model only)');
let page2Asserted=false;const loadMoreButton=null;
if(loadMoreButton){page2Asserted=true;}
assert.equal(page2Asserted,false);
console.log('R6 H18: conditional test can skip page 2 precondition');
NODE
node /tmp/pr390-r6-concurrency-model.cjs
```
Resultados del modelo: las 3 líneas `R6 H17`×2, `R6 H18`×1; exit 0 (modelo solo). `container.exec git ls-remote` -> no resuelve github.com. No se hicieron tests locales ni mutaciones reales, no se falsearon.

## Ronda 7 — 18/10/2026 — SHA funcional 3dc1d6ad3816a2757fff82e1905f910e37b6c707
- `compare_commits(e0ca8f67,3dc1d6a)` -> solo 4 archivos propios; no toca revisor ni esquema.
- `compare_commits(develop,feat/T-365-...)` -> behind 28 y ahead 16; GitHub `mergeable_state=clean`.
- `get_pr_info(#411)`: `merged=true`, merged_at 2026-10-18T22:48:43Z, nuevas suites T369 E2E están en develop pero fuera de rama #390.
- `get_commit_status(3dc1d6ad3816a2757fff82e1905f910e37b6c707)` -> `e2e-preview: success`, target run 39173436933.
- `fetch_workflow_job_logs(117811152050)`: `86 passed (26.7m)`, `1 flaky` (map-privacy), `3 passed (1.2m)` global-settings; trusted job success.
- `fetch_workflow_job_logs(117810917284)`: tras mutaciones deliberadas y restauradas, pgTAP `All tests successful. Files=30 Tests=2815 Result: PASS`. Unit: `145 Test Files passed`; workflows 79/79, ADR 6/6.
- `fetch_file` SHA: UI `isLoadMoreDisabled` incorpora `isFetching`; handler guarda antes `fetchNextPage()`. Test H17 chequea solo offline y reconnect; test H18 fuerza carga de pág2.
- Ejecuté análisis puro en Node sin checkout, con código completo abajo; no es React ni Vitest:
```bash
node - <<'NODE'
const assert=require('node:assert/strict');
const original=({isFetching,isFetchingNextPage,isOnline,synced})=>Boolean(isFetching)||Boolean(isFetchingNextPage)||!isOnline||!synced;
const mutant=({isFetchingNextPage,isOnline,synced})=>Boolean(isFetchingNextPage)||!isOnline||!synced;
const states={
 offline:{isFetching:false,isFetchingNextPage:false,isOnline:false,synced:false},
 reconnect:{isFetching:true,isFetchingNextPage:false,isOnline:true,synced:false},
 onlineInvalidate:{isFetching:true,isFetchingNextPage:false,isOnline:true,synced:true}
};
for(const [name,s] of Object.entries(states))console.log(name+': originalDisabled='+original(s)+' mutantWithoutIsFetchingDisabled='+mutant(s));
assert.equal(original(states.offline),mutant(states.offline));
assert.equal(original(states.reconnect),mutant(states.reconnect));
assert.notEqual(original(states.onlineInvalidate),mutant(states.onlineInvalidate));
console.log('MODEL PASS: offline/reconnect checks cannot detect mutating isFetching guard, live-online invalidate can');
NODE
```
Resultado real:
```
offline: originalDisabled=true mutantWithoutIsFetchingDisabled=true
reconnect: originalDisabled=true mutantWithoutIsFetchingDisabled=true
onlineInvalidate: originalDisabled=true mutantWithoutIsFetchingDisabled=false
MODEL PASS: offline/reconnect checks cannot detect mutating isFetching guard, live-online invalidate can
```

## Ronda 8 — auditoría independiente — código HEAD 939e8341001ab40d5f509a160f98438bf8387c04
1. `get_pr_info(#390)` y REST `/pulls/390`: HEAD 939e8341001ab40d5f509a160f98438bf8387c04, base develop SHA `99a7b9de121d76f0614dbff52139beb08c3ddeec`, mergeable true / clean.
2. `compare_commits(develop,feat/T-365-cancelacion-cadete-ofertas-historial)`: ahead 20 / behind 0, globs del diff contra develop limitados a archivos autorizados. `compare_commits(3bcf1e0..b05ff590)`: solo test UI de 150 líneas añadidas. Commit merge e79fb751 parent 2 `99a7b9de`.
3. `fetch_file(request-offers.test.tsx, HEAD)`: test H19 QueryClientProvider real, `getByRole Cargar más`, `fireEvent.click`, `findByText Cadete Que Cancelo`, cursor real, `void queryClient.invalidateQueries`, segunda página deferred, `fetchStatus fetching`, asserts disabled y no requests competidoras; luego resolve y button enabled. `fetch_file(request-offers-list.tsx, HEAD)`: `isLoadMoreDisabled` contiene `Boolean(isFetching)` y otras condiciones + `handleLoadMore` guardado.
4. `fetch_workflow_job_logs(117820848157)`: `checkout ref: 939e8341001ab40d5f509a160f98438bf8387c04`, `HEAD is now at 939e834`; Chromium `89 passed (22.4m)`; global-settings `6 passed (2.7m)` (3 nuevos T-369, 3 T-306). Job/status `e2e-preview` SUCCESS, run 39176723923. Sin flakes.
5. `fetch_workflow_job_logs(117820745505)` unidad: `145 Test Files passed`; workflows #pass 79 #fail 0; ADR #pass 6 #fail 0. `fetch_workflow_job_logs(117820745300)`: pgTAP final `All tests successful. Files=30, Tests=2815, Result: PASS`. GitHub check runs de SHA HEAD: audit, build, lint, typecheck, unit, db-tests, bundle-budget, approval-policy SUCCESS.
6. Modelo booleano aislado, ejecutado en este ambiente vía `node /tmp/pr390-r8-h19-model.cjs` (NO es test real React/Vitest ni reejecución del mutante del autor):
```js
'use strict';
const assert = require('node:assert/strict');
const disabled = s => Boolean(s.isFetching) || Boolean(s.isFetchingNextPage) || !s.isOnline || !s.synced;
const mutantNoIsFetching = s => Boolean(s.isFetchingNextPage) || !s.isOnline || !s.synced;
const scenarios = {
  idle: {isFetching:false,isFetchingNextPage:false,isOnline:true,synced:true},
  onlineInvalidate: {isFetching:true,isFetchingNextPage:false,isOnline:true,synced:true},
  offline: {isFetching:false,isFetchingNextPage:false,isOnline:false,synced:false},
  reconnect: {isFetching:true,isFetchingNextPage:false,isOnline:true,synced:false}
};
for (const [name,s] of Object.entries(scenarios)) console.log(`${name}: real=${disabled(s)}, mutated=${mutantNoIsFetching(s)}`);
assert.equal(disabled(scenarios.onlineInvalidate),true);
assert.equal(mutantNoIsFetching(scenarios.onlineInvalidate),false);
assert.equal(disabled(scenarios.idle),false);
assert.equal(disabled(scenarios.offline),true);
assert.equal(disabled(scenarios.reconnect),true);
console.log('R8 H19 logical guard model PASS; not a React or Vitest execution');
```
Salida literal:
```
idle: real=false, mutated=false
onlineInvalidate: real=true, mutated=false
offline: real=true, mutated=true
reconnect: real=true, mutated=true
R8 H19 logical guard model PASS; not a React or Vitest execution
```
7. No se ejecutaron `pnpm` ni E2E locales, no se manipuló Supabase ni Vercel, no se dispararon workflows ni mutaciones contra el repo, no se alteró el código de la PR. No reejecutar CI por docs del revisor.
