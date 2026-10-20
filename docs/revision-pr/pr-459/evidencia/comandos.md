# Evidencia y comandos — PR #459 / T-382 — Ronda 1

**SHA fijo examinado:** `1b24455f37b845b6b1e53ba672b459b62853ae06`. Esta sesión usó lectura GitHub; sin clon local, entorno Supabase, test runner ni acceso a credenciales. Nada en esta sección afirma ejecución de Vitest/Playwright por la revisión.

## Sondas propias realizadas sobre blobs del SHA (ESTÁTICAS)

El revisor obtuvo dos archivos por GitHub y ejecutó en memoria tres predicados originales, seguidos de reemplazos hipotéticos del texto en memoria **sin modificar la rama**. Resultado:

```text
S1-H01: baseline defect detected = true; hypothetical-fix defect detected = false
S2-H02: baseline defect detected = true; hypothetical-fix defect detected = false
S3-H03: baseline defect detected = true; hypothetical-fix defect detected = false
```

Son evidencias de **rutas de código que faltan**, no de efectos reales ni de que el arreglo propuesto sea completo. Las mutaciones de la ficha M1–M7 fueron del autor, no de la revisión.

### Harness completo reproducible en una copia limpia del SHA

Copiar el bloque desde la raíz del repo. No toca el código fuente ni entorno remoto:

```bash
cat > /tmp/pr459-static-probes.cjs <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const ui = fs.readFileSync(path.join(root, 'src/features/notifications/push/components/push-permission-prompt.tsx'),'utf8');
const sub = fs.readFileSync(path.join(root, 'src/features/notifications/push/subscription.ts'),'utf8');
function h1(s) {
  return /const result = await unsubscribeFromPush\(\);[\s\S]{0,160}if \(!result\.ok\) \{\s*setErrorMessage\(PUSH_COPY\.prompt\.statusDeactivateError\);\s*return;/.test(s);
}
function h2(s) {
  return s.includes("error: err instanceof Error ? err.message : 'subscription_failed'") &&
   s.indexOf("let subscription = await registration.pushManager.getSubscription()") <
    s.indexOf("error: err instanceof Error ? err.message : 'subscription_failed'");
}
function h3(s) { return s.includes('message: cause.message'); }
const probes = [
 ['S1-H01', h1, ui, ui.replace('setErrorMessage(PUSH_COPY.prompt.statusDeactivateError);',"setAccountState('pending_unsubscribe');\n      setErrorMessage(PUSH_COPY.prompt.statusDeactivateError);")],
 ['S2-H02', h2, sub, sub.replace("error: err instanceof Error ? err.message : 'subscription_failed'","error: classifySubscribeException(err)")],
 ['S3-H03', h3, sub, sub.replace('message: cause.message','message: sanitizePushErrorMessage(cause.message)')]
];
let fail = false;
for (const [label, check, original, mutated] of probes) {
 const baseline = check(original);
 const after = check(mutated);
 console.log(label + ': baseline defect detected=' + baseline + ', hypothetical-fix defect detected=' + after);
 if (!baseline || after || mutated===original) fail=true;
}
if(fail) process.exitCode=1;
NODE
node /tmp/pr459-static-probes.cjs
```

**Aviso:** que el script dé PASS no verifica el arreglo nuevo. Es detector específico de tres patrones del SHA original; las pruebas de comportamiento serán obligatorias durante el arreglo.

## Pruebas funcionales requeridas y mutaciones — NO ejecutadas por esta revisión

Desde un worktree limpio del SHA funcional (sin ejecutar contra producción):

```bash
git fetch origin
git worktree add --detach /tmp/pr459-wt 1b24455f37b845b6b1e53ba672b459b62853ae06
cd /tmp/pr459-wt
pnpm install --frozen-lockfile
pnpm exec vitest run src/features/notifications/push.test.ts src/app/api/push/subscriptions/status/route.test.ts src/features/courier-onboarding/components.test.tsx
pnpm typecheck
pnpm lint
pnpm test
# No se corrió nada de lo anterior en esta revisión.
```

Pruebas faltantes para el agy (todas necesitan GREEN tras fijar el comportamiento):
- H01 RED inicial: el caso `unsubscribe()` true + `DELETE 500` debe fallar por falta de «baja pendiente» y «Reintentar baja»; segundo intento `DELETE 200` con `getSubscription() === null` y el endpoint pendiente debe funcionar. Mutaciones locales: quitar UI pendiente y quitar el fallback del pending endpoint; ambos deben provocar RED.
- H02 RED inicial: `navigator.serviceWorker.ready` rechaza con `NotAllowedError` y `pushManager.getSubscription()` con `AbortError`; debe fallar la expectativa de código estable, sin POST. Mutación: devolver `err.message` como código; RED.
- H03 RED inicial: `new Error`/`DOMException` con URL-capacidad, `p256dh`, `auth` en `message` debe fallar «log sin secretos». Mutación: reponer `message: cause.message`; RED.

Usar copia local temporal del archivo en worktree para cada mutación; **restaurarla sin `git checkout`**, confirmar GREEN sobre el mismo test. Registrar en bitácora comandos completos, extractos del resumen y hashes del archivo restaurado. Nunca dejar mutaciones, mocks engañosos, `.skip` ni expectations debilitadas en commit.

## Evidencia declarada por el autor; no certificada por la revisión

Bitácora `docs/tasks/log/T-382.md` a este SHA: RED inicial `21 failed`; GREEN unitarios `164 passed`, mutaciones M1–M7 RED/GREEN; Playwright local contra Preview `a61ecd10` y Supabase Develop, T-382 `3 passed`; gate completo con `CI=true`/`--workers=1`, Chromium `93 passed` y dos flaky (reintento exitoso), global-settings `6 passed`. El autor canceló `e2e-preview` oficial durante las rondas por decisión expresa de Lautaro073. Esta revisión **no reejecutó** esas pruebas ni inspeccionó una corrida CI completa como evidencia de ausencia de bloqueantes.

## Rama y alcance

GitHub `compare(develop, feat/T-382-push-errors-status)`: `ahead 3`/`behind 0`; `mergeable=true`. 14 archivos del diff, todos dentro de los permitidos de la ficha de develop. `git merge-tree` y `node docs/revision-pr/analizar.mjs verificacion` **no ejecutados aquí** por falta de clon. El comentario final de PR referencia la carpeta y el SHA; el commit exclusivamente documental que agrega esta revisión no exige un nuevo gate E2E por sí mismo.

## Ronda 2 — Evidencia independiente, exclusivamente estática

**SHA de código:** `dc5f78cbf3ea7ec92f8b2a06464cac885d73389e`. Las sondas de abajo se ejecutaron en memoria sobre blobs recuperados de GitHub, sin ejecutar Vitest/Playwright. Baseline defecto detectado=true; con reemplazo hipotético en memoria, defecto detectado=false; **esto NO verifica comportamiento ni arreglos**.

- S1: early return `inactive` de `getPushSubscriptionStatus` sin consultar endpoint pendiente cuando falta soporte.
- S2: early return `ok:true` de `unsubscribeFromPush` sin realizar DELETE pendiente.
- S3: propiedad `name` del logger registrada sin pasar por sanitizador.
- S4: excepción de `serviceWorker.ready` o `getSubscription` retorna `unknown` ignorando pendiente.

### Harness completo reproducible desde la raíz del repo, SHA funcional examinado

```bash
cat >/tmp/pr459-r2-probes.cjs <<'NODE'
const fs = require('node:fs');
const src = fs.readFileSync('src/features/notifications/push/subscription.ts', 'utf8');
const section = (a,b)=>src.split(a)[1]?.split(b)[0] || '';
const status = section('export async function getPushSubscriptionStatus()', 'export async function unsubscribeFromPush()');
const unsub = section('export async function unsubscribeFromPush()', '__END__');
const logger = section('function logSubscribeFailure(', '/**');
const preSW = status.split('let endpoint: string;')[1]?.split("try {\n    const response")[0] || '';
const checks = [
 ['S1',status,x=>/if \(!isPushSupported\(\)\)\s*\{\s*return 'inactive';/.test(x),x=>x.replace("return 'inactive';","return hasPendingUnsubscribe() ? 'pending_unsubscribe' : 'inactive';")],
 ['S2',unsub,x=>/if \(!isPushSupported\(\)\)[\s\S]{0,170}return \{ ok: true \};/.test(x),x=>x.replace("if (!isPushSupported()) {","if (!isPushSupported() && !pendingEndpoint) {")],
 ['S3',logger,x=>x.includes('...(name ? { name } : {})'),x=>x.replace('...(name ? { name } : {})','...(name ? { name: sanitizePushErrorMessage(name, knownSecrets) } : {})')],
 ['S4',preSW,x=>x.includes("} catch {\n    return 'unknown';\n  }"),x=>x.replace("} catch {\n    return 'unknown';\n  }","} catch {\n    return hasPendingUnsubscribe() ? 'pending_unsubscribe' : 'unknown';\n  }")]
];
let invalid=false;
for(const [label,original,check,mutate] of checks){
 const changed=mutate(original), base=check(original), after=check(changed);
 console.log(label, 'baseline_defect='+base, 'hypothetical_fix_defect='+after);
 if(!base || after || original===changed) invalid=true;
}
process.exitCode=invalid?1:0;
NODE
node /tmp/pr459-r2-probes.cjs
```

**Este harness de análisis de código no sustituye pruebas RED/GREEN.** Los mutantes son marcadores de posibles cambios, no parches listos para producción; las pruebas de integración reales nuevas deben hacer fallar el SHA previo y pasar el SHA corregido.

**Autor, no revisor:** `docs/tasks/log/T-382.md` a `0e32446d` declara tests focalizados 173/173, generales 3028/3028, M8–M12 RED y GREEN, E2E 7+1 passed. No reproducidos desde esta sesión. Sin clon por DNS, `git merge-tree`/`analizar.mjs` y tests locales no ejecutados; `e2e-preview` oficial diferido por decisión de Lautaro073.

## Ronda 3 — sondas independientes S5 y S6

**SHA funcional:** `0c534f8cccaca9c281a3b29b71c2cde349ee0d0d`. Esta revisión corrió **Node local sobre un modelo mínimo de los predicados y del contrato SQL**, NO importó las funciones de producción ni ejecutó Supabase. Datos del modelo ficticios.

Salida realmente obtenida:

```text
S5: regex acepta token auth puramente alfanumérico de 22 chars: YES (riesgo condicionado).
S6: cuenta B limpia pending local con 200 aunque la fila de A siga en DB: YES (simulación de contrato).
```

Harness completo ejecutado desde `/tmp/pr459-r3-static.cjs`:

```js
const assert = require('node:assert/strict');
// Sonda de contrato por inspección; NO ejecuta código de la aplicación.
const standardName=/^[A-Za-z][A-Za-z0-9]{0,63}$/;
const authToken='AaBbCcDdEeFf0123456789';
assert(standardName.test(authToken),'regex does not accept sample secret');
console.log('S5: regex acepta token auth puramente alfanumérico de 22 chars: YES (riesgo condicionado).');
const userA='A',userB='B',endpoint='https://push.example.invalid/endpoint';
let rows=[{user_id:userA,endpoint}];
let pending=endpoint;
// Simulación del contrato DELETE en develop: DELETE WHERE user_id = B AND endpoint = E;
// si no hay error db (0 filas borradas), responde {ok:true}.
rows=rows.filter(row=>!(row.user_id===userB && row.endpoint===endpoint));
const response={ok:true};
if(response.ok)pending=null; // contrato del confirmUnsubscribeOnServer
assert.equal(pending,null);
assert.deepEqual(rows,[{user_id:userA,endpoint}]);
console.log('S6: cuenta B limpia pending local con 200 aunque la fila de A siga en DB: YES (simulación de contrato).');
```

### Fuente y reproducción funcional pendiente

- Código real SHA `0c534f8`: `subscription.ts:127` (regex), `129-140` (log), `263-268` (pending solo URL), `279-298` (estado no scoped), `324-353` (un DELETE 2xx limpia local), `356-375` (reintento). Servidor `develop@04f1183`: `route.ts` DELETE filtrado por endpoint y `user_id`, responde ok en ausencia de dbError sin comprobar filas.
- La bitácora `fb3379bc` contiene M13–M17, 181 tests focalizados, 3036 tests generales y E2E 7+1; verificado que están escritos, **no reproducidos en esta sesión**.
- En esta sesión `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` devolvió DNS `Could not resolve host: github.com`. No hubo worktree, `pnpm`, `git merge-tree` ni pruebas contra Supabase/Vercel. Al no haber clon, `node docs/revision-pr/analizar.mjs verificacion` no se pudo ejecutar aquí.
- CI HEAD `fb3379bc`: unit/typecheck/lint/build/audit/bundle-budget success; approval-policy failure; db-tests cancelado y e2e-preview no final. `develop` avanzó 15 commits respecto a la base histórica del PR, `mergeable_state=unstable` en lectura REST; sincronizar y revalidar antes de declarar lista.
- Tests funcionales requeridos para cerrar: H03 inyección de `Error.name` que sea **todo un token** (no solo etiquetas), mutar whitelist; H05 fixture A→B→A en mismo origen, primer DELETE fallido, B no limpia el pending de A, A reintenta con misma sesión, DB sin fila A, mutate quitar chequeo de identidad y exigir RED. Guardar salidas por comando en bitácora, no presentarlas como comprobadas antes.

## Ronda 4 — sondas independientes S7/S8 de pérdida de recuperación y carrera de sesión

**Examinado:** `da930eff32283c09d81b33c7f13c88451dd569a3`. **IMPORTANTÍSIMO:** las sondas se ejecutaron en Node como **modelo explícito de transiciones del código fuente**; no importan TypeScript de la aplicación ni invocan las rutas/DB. No se presentan como verificación funcional independiente. Intento de clon: `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` → `Could not resolve host: github.com`.

**Salida realmente obtenida:**

```text
S7 unknown identity should retain native on DELETE failure: RED (expected assertion failure)
S7 hypothetical early guard: GREEN in contract model
S8 A pending must survive a B-authenticated 200/zero-row DELETE: RED (expected assertion failure)
S8 hypothetical session re-check: GREEN in contract model
```

**Harness completo reproducible**, ejecutar `node /tmp/pr459-r4-proof.cjs` (guardar este bloque allí):

```javascript
const assert = require('node:assert/strict');
const prefix = 'cadeapp_pending_unsub_endpoint';
const endpoint = 'https://push.example.invalid/e';
const key = id => prefix + ':' + id;
// Modelo del flujo de subscription.ts, NO ejecuta funciones de producción.
async function simulate({initialUser, requestUser, responseOK, pending=false, guarded=false}) {
  let native = !pending;
  const userId = initialUser;
  const storage = new Map(pending && userId ? [[key(userId),endpoint]] : []);
  let sent = false;
  if (guarded && native && !userId)
    return {native,stored:storage.size,sent,ok:false};
  const target = native ? endpoint : storage.get(key(userId)) ?? null;
  if (!target) return {native,stored:storage.size,sent,ok:true};
  if (native) native = false;
  sent = true;
  let dbRowOwner = 'A';
  if (responseOK && requestUser===dbRowOwner) dbRowOwner=null;
  if (!responseOK) {
    if(userId) storage.set(key(userId),target);
    return {native,stored:storage.size,sent,ok:false,dbRowOwner};
  }
  if (guarded && requestUser!==userId)
    return {native,stored:storage.size,sent,ok:false,dbRowOwner};
  if (userId && storage.get(key(userId))===target)storage.delete(key(userId));
  return {native,stored:storage.size,sent,ok:true,dbRowOwner};
}
async function expectFailure(label,fn) {
  try { await fn(); throw new Error('Did not fail: '+label); }
  catch(e) {
    if(e.message.startsWith('Did not fail'))throw e;
    console.log(label+': RED (expected assertion failure)');
  }
}
(async()=>{
  await expectFailure('S7 unknown identity should retain native on DELETE failure',async()=>{
    const x=await simulate({initialUser:null,requestUser:null,responseOK:false});
    assert.equal(x.native,true);
  });
  const g=await simulate({initialUser:null,requestUser:null,responseOK:false,guarded:true});
  assert.deepEqual({native:g.native,sent:g.sent,ok:g.ok},{native:true,sent:false,ok:false});
  console.log('S7 hypothetical early guard: GREEN in contract model');
  await expectFailure('S8 A pending must survive a B-authenticated 200/zero-row DELETE',async()=>{
    const x=await simulate({initialUser:'A',requestUser:'B',responseOK:true,pending:true});
    assert.equal(x.stored,1);
  });
  const fixed=await simulate({initialUser:'A',requestUser:'B',responseOK:true,pending:true,guarded:true});
  assert.equal(fixed.stored,1);
  assert.equal(fixed.dbRowOwner,'A');
  console.log('S8 hypothetical session re-check: GREEN in contract model');
})().catch(e=>{console.error(e);process.exitCode=1});
```

**Autor:** bitácora `39360343` documenta M18–M20 RED/GREEN, 188 focalizados y 3059 generales, typecheck/lint, E2E real con usuarios A/B del Preview `da930eff` GREEN `8+2`, y RED en deploy previo. Inspeccionado el código E2E, no reproducido por revisor. R4 S7/S8 son **mutaciones propias de modelo**, no tests de aplicación ni GREEN de reparación.

## Ronda 5 — lectura de SHA real y sondas independientes S9–S13

**SHA de aplicación:** `f8f2fc2501aad66a2bfd5ea52913f1d5195b2e5e`. **SHA de bitácora y E2E:** `8445008adf8d1cb179172f7237e946cb4a8b3115`.

**Método:** obtención de los blobs mediante GitHub conector y ejecución de predicados sobre el **texto de producción y test real** en una sandbox V8; mutantes solo en memoria, no escriben ni ejecutan TS. Dado que `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` falló por DNS (`Could not resolve host: github.com`), no se dispuso de worktree ni se ejecutaron Vitest, Playwright o `pnpm`. **No presentar sondas como un RED/GREEN funcional.**

**Resultados de S9–S12 ejecutados (true = condición fuente presente):**

```text
S9 guardia H05 post-DELETE y previa al localStorage.removeItem: true; al quitarla hipotéticamente: false.
S10 guardia H06 de userId previa a native unsubscribe() y DELETE: true; al quitarla: false.
S11 test de DELETE diferido que cambia A→B antes de resolver response: true; mutando la transición en test: false.
S12 test que prohíbe native.unsubscribe y DELETE sin sesión: true; quitando assertion de native: false.
S13 E2E H05 y alta de A: espera POST 200, no depende del texto de éxito transitorio; cleanup en finally: true.
```

**Harness independiente reproducible:** desde una copia limpia del repo, escribir el siguiente script fuera del repo y ejecutarlo con Node.

```bash
cat >/tmp/pr459-r5-probes.cjs <<'NODE'
const fs=require('node:fs');
const code=fs.readFileSync('src/features/notifications/push/subscription.ts','utf8');
const tests=fs.readFileSync('src/features/notifications/push.test.ts','utf8');
const e2e=fs.readFileSync('e2e/specs/notifications.spec.ts','utf8');
const between=(t,a,b)=>t.split(a)[1]?.split(b)[0]||'';
const confirm=between(code,'async function confirmUnsubscribeOnServer(', 'export async function unsubscribeFromPush()');
const unsub=between(code,'export async function unsubscribeFromPush()','__END__');
const probes=[
 ['S9',confirm,x=>{const fetch=x.indexOf("await fetch('/api/push/subscriptions'"); const guard=x.indexOf("if ((await getCurrentUserId()) !== userId)",fetch); const del=x.indexOf('localStorage.removeItem(',fetch); return fetch>=0 && guard>fetch && del>guard;}, x=>x.replace(/if \(\(await getCurrentUserId\(\)\) !== userId\) \{\s*keepPendingForOwner\(\);\s*return \{ ok: false, error: 'identity_changed' \};\s*\}/g,'')],
 ['S10',unsub,x=>{const g=x.indexOf('if (!userId) {');const u=x.indexOf('await subscription.unsubscribe()',g);const d=x.indexOf('return await confirmUnsubscribeOnServer(endpoint, userId)',g);return g>=0&&u>g&&d>u;},x=>x.replace(/if \(!userId\) \{\s*return \{ ok: false, error: 'unauthorized' \};\s*\}/,'')],
 ['S11',tests,x=>x.includes('let releaseDelete: (response: Response) => void')&&x.includes('session.userId = USER_B;\\n      releaseDelete(')&&x.includes('expect(localStorage.getItem(pendingUnsubStorageKey(USER_A))).toBe(ENDPOINT)'),x=>x.replace('session.userId = USER_B;\\n      releaseDelete(','releaseDelete(')],
 ['S12',tests,x=>x.includes('expect(native.unsubscribe).not.toHaveBeenCalled()')&&x.includes('expect(deletes(fetchMock)).toEqual([])'),x=>x.replace('expect(native.unsubscribe).not.toHaveBeenCalled()','')]
];
let invalid=false;
for(const [name,src,check,mutate] of probes){
const b=check(src),changed=mutate(src),m=check(changed);
console.log(name,'source='+b,'hypothetical_mutant='+m);
if(!b||m||changed===src)invalid=true;
}
const caseH05=e2e.split("test('PR459-H05:")[1]||'';
const s13=e2e.match(/const subscribed = page\.waitForResponse\(/g)?.length>=2 && caseH05.includes("expect((await subscribed).status()).toBe(200)") && !caseH05.includes("¡Avisos activados con éxito!") && caseH05.includes("finally {") && caseH05.includes("await deleteSubscription(endpoint)");
console.log('S13 e2e stable wait='+Boolean(s13));
if(!s13) invalid=true;
process.exitCode=invalid?1:0;
NODE
node /tmp/pr459-r5-probes.cjs
```

**Evidencia del autor, no reproducida por el revisor:** `docs/tasks/log/T-382.md` a `8445008a` documenta RED `3 failed | 74 passed`, GREEN `192` focalizados y `3063` generales, M21/M22 RED y GREEN restaurados, E2E `push-user-activation` `2 passed` y T-382 tras ajustar espera `4 passed` dos veces sin retries. Se inspeccionó que test realmente pospone respuesta de fetch y hace cambio de cuenta.

**CI HEAD `8445008a` al consultar:** `typecheck`, `lint`, `build`, `bundle-budget` SUCCESS, Vercel SUCCESS; `audit` FAILURE (log `7 vulnerabilities found, Severity 5 moderate | 2 high (1 ignored)`), `approval-policy` FAILURE previo al comentario de R5; `unit` y `db-tests` en progreso, `e2e-preview` pendiente. No atribuir vulnerabilidades a esta ronda que no modifica dependencias.
