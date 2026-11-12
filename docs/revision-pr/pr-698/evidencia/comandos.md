# Evidencia y comandos — PR #698 · Ronda 1

## Fuentes y resultados que se pudieron verificar

SHA `e77beb59` (código `c26f7673`), base `develop@28de2b98`. Inspección Github de archivos exactos. Logs CI GREEN `43165418123`: `unit` 204/204 archivos, 3860/3860; `db-tests` 46 archivos, 3858 pgTAP (CC-049 57/57), primera aplicación preserva E01/E08, typecheck/lint/build/audit/bundle-budget SUCCESS; paso `git diff --exit-code -- src/types/database.types.ts`. RED pre-migración `43164852008`: CC-049 falla 19/21 antes de corte.

| Mutación del autor | SHA | Run | Evidencia vista en log |
|---|---|---|---|
| #699 grant | `37ff5662` | [43166846365](https://github.com/cadeApp/cadeApp/actions/runs/43166846365) | fallan 8–9,25–30 pgTAP |
| #700 policy | `55daf59d` | [43166858170](https://github.com/cadeApp/cadeApp/actions/runs/43166858170) | fallan 1–7 pgTAP |
| #701 RPC sin helper | `adf80fb7` | [43166868060](https://github.com/cadeApp/cadeApp/actions/runs/43166868060) | fallan 44–56 pgTAP |
| #702 host sin anclar | `f2cc5a97` | [43166879691](https://github.com/cadeApp/cadeApp/actions/runs/43166879691) | E09/E13 pgTAP y Vitest helper/schema/fake/emisor |
| #703 emisor sin filtro | `0f21efb7` | [43166894445](https://github.com/cadeApp/cadeApp/actions/runs/43166894445) | falla Vitest de endpoints bloqueados |
| #704 timeout de socket | `32958169` | [43166904662](https://github.com/cadeApp/cadeApp/actions/runs/43166904662) | falla goteo y cleanup en transport.test.ts |
| #705 RED-DELETE | `df7826c7` | [43166916875](https://github.com/cadeApp/cadeApp/actions/runs/43166916875) | preservación E08 falla |
| #706 RED-TIMESTAMP | `e67060b9` | [43166930287](https://github.com/cadeApp/cadeApp/actions/runs/43166930287) | comparación last_seen_at falla |

Todas #699–#706 están **cerradas sin merge**. No son mutaciones independientes del revisor.

## H01 y H02: mutaciones independientes **pendientes de ejecución**

**H01:** en `src/app/api/push/send/route.ts`, solo durante prueba de sensibilidad, reemplazar el retorno de `NextResponse.json({ ok: true, result })` por retorno de `{ ok:true, result:{...result, attempts:result.attempts.map(a => a.outcome === 'blocked' ? {...a, endpoint:'https://push.example.com/leak'} : a)} }`. `route.test.ts` nuevo debe fallar en su igualdad exacta / `Object.hasOwn`. Restaurado: GREEN.

**H02:** en `src/server/push/sender.ts`, alterar temporalmente `if (status >= 200 && status < 300)` a `if (status >= 200 && status < 400)`. El caso 302 de `push.test.ts` debe fallar por `sentCount`/`failedCount`, no setup. Restaurado: GREEN. Incluir casos frontera 300 y 399 es recomendable.

### Harness completo de inspección estructural

El siguiente script **no muta el repo**, examina el árbol de un SHA (no interpreta el resultado como Vitest). Para reproducirlo en un clon, copiá **todo** el bloque a terminal. Puede ejecutarse desde cualquier ruta pasando `REPO_DIR`; el control de e77 espera ausencia de tests H01/H02. Es una comprobación de contenido, **no** un sustituto de RED/GREEN real.

```bash
cat >/tmp/pr698-r1-inspeccion.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const sha = process.argv[2] ?? 'e77beb59c753b36584d0bf504a3181dcb89515c9';
const cwd = process.argv[3] ?? process.cwd();
function read(path) {
  return execFileSync('git', ['show', sha + ':' + path], { cwd, encoding: 'utf8' });
}
const route = read('src/app/api/push/send/route.ts');
const routeTest = read('src/app/api/push/send/route.test.ts');
const sender = read('src/server/push/sender.ts');
const emitterTest = read('src/server/push/push.test.ts');
const transportTest = read('src/server/push/transport.test.ts');
assert.match(route, /NextResponse\.json\(\{ ok: true, result \}\)/);
assert.match(sender, /status\s*>=\s*200\s*&&\s*status\s*<\s*300/);
assert.ok(!routeTest.includes("outcome: 'blocked'"), 'H01 ya cubierto: releer SHA');
assert.match(emitterTest, /Object\.hasOwn\(attempt, 'endpoint'\)/);
const matrix = emitterTest.slice(emitterTest.indexOf("describe('PR91-H05:"), emitterTest.indexOf("describe('Casos de borde"));
assert.ok(!/\b302\b/.test(matrix), 'H02 ya cubierto: releer SHA');
assert.ok(transportTest.includes('un 3xx es un fallo'), 'debe existir prueba de 302 no redirigido');
console.log('INSPECCIÓN: H01 sin blocked en route.test y H02 sin 302 en matriz del emisor');
console.log('No prueba RED/GREEN de mutación ni ejecuta Vitest.');
NODE
node /tmp/pr698-r1-inspeccion.mjs e77beb59c753b36584d0bf504a3181dcb89515c9
```

**Ejecución:** no se pudo ejecutar este script contra un clon en esta sesión: `git ls-remote` falló con `Could not resolve host: github.com`. El control se verificó por inspección directa de archivos con la conexión GitHub. No afirmar que el script copiado a /tmp fue ejecutado. Para ejecutar sobre nuevo SHA: el chequeo de ausencia **deberá fallar** por tests agregados; usar pruebas Vitest para verificar efecto real.

## Comandos para agy y ronda 2

```bash
git fetch origin
git ls-remote origin feat/T-432-sec07-push-hardening
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/app/api/push/send/route.test.ts src/server/push/push.test.ts >/tmp/pr698-control.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr698-control.log | tail -4
# Ejecutar las dos mutaciones SOLO temporalmente y capturar la MISMA línea de resumen para RED.
# Restaurar el código sano desde una copia en memoria/scratch, NO con git checkout.
pnpm typecheck && pnpm lint && pnpm test
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

No levantar Supabase/Docker local, no acceder a secretos ni servicios remotos. CI db-tests sustituye base local. Si `clients.test.ts` hace timeout por carga, ejecutar sola antes de atribuir una regresión.

---

# Ronda 2 — verificación independiente y CI de `69fdfd85` (2026-11-12)

## Integridad, entorno y resultados

La función `POST` desde `export async function POST` en `src/app/api/push/send/route.ts` consta de **1174 caracteres** (FNV-1a `f2f06254`), y `sendPushNotification` desde `const PUSH_BATCH_SIZE` hasta antes de `safeNotifyPostTransition` consta de **2945 caracteres** (FNV-1a `fe533666`). Se compararon esos hashes contra el texto obtenido del conector de GitHub en **`69fdfd85`**. Se ejecutaron copias locales idénticas de las funciones en el harness Node22; el entorno no pudo clonar (DNS de github.com). `vm.Script` ejecuta el JavaScript transpileado de **la función real**, no una reimplementación. Dobles explícitos: `NextResponse.json` con roundtrip JSON, validación de entrada exitosa, transport/db aislados, `buildPushPayload` directo y allowlist FCM para la suscripción de test. El foco son **H01 serialización** y **H02 contadores/no-borrado**, no autenticación, Zod, Next runtime, criptografía ni red. No usar este runner como reemplazo del Vitest ni de pgTAP.

**Salida obtenida al ejecutar en el contenedor del revisor:**

```text
GREEN independiente aislado: HTTP blocked sin endpoint, clasificador [200,201,300,302,399,404,410,429,500,503].
RED H01: Expected values to be strictly deep-equal:
RED H02: statuses 300/302/399 fail on sentCount; other statuses retain expected behavior.
RESTORED GREEN: both SUT functions unchanged after in-memory mutation.
```

**Script íntegro**: copiar el contenido a `/tmp/pr698-review-harness.cjs` y ejecutar desde un checkout de **`69fdfd85`**, o pasar el path del repo. Requiere `typescript` resoluble (en repo, `NODE_PATH` apuntando al `node_modules` global si hiciera falta). Falla cerrado si cambian los fragmentos o no se aplica la mutación. Nunca modifica código ni test ni escribe en el repo.

```javascript
// PR698 independent runtime probe (Node + global TypeScript; no Next, Vitest or DB required).
// Run: node /tmp/pr698-review-harness.cjs /path/to/repository
// Reads the REAL production function sources. Dependencies external to the
// two invariants are injected, while the SUT functions are compiled and executed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = process.argv[2] || process.cwd();
const senderFile = fs.readFileSync(path.join(root, 'src/server/push/sender.ts'), 'utf8');
const routeFile = fs.readFileSync(path.join(root, 'src/app/api/push/send/route.ts'), 'utf8');
const senderStart = senderFile.indexOf('const PUSH_BATCH_SIZE = 10;');
const routeStart = routeFile.indexOf('export async function POST(req: NextRequest)');
assert(senderStart >= 0 && routeStart >= 0, 'SUT entrypoint not found; fail closed');
const senderEnd = senderFile.indexOf('\nexport async function safeNotifyPostTransition(', senderStart);
const senderSut = senderFile.slice(senderStart, senderEnd >= 0 ? senderEnd : undefined).trimEnd() + '\n';
const routeSut = routeFile.slice(routeStart);
function fnv(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
assert.equal(fnv(senderSut), 'fe533666', 'Sender excerpt differs from PR698@69fdfd85; stop');
assert.equal(fnv(routeSut), 'f2f06254', 'Route excerpt differs from PR698@69fdfd85; stop');
assert.match(senderSut, /export async function sendPushNotification/);
assert.match(routeSut, /return NextResponse\.json\(\{ ok: true, result \}\);/);

function compile(src, symbol, bindings) {
  const { outputText, diagnostics } = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.deepEqual(diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error) || [], []);
  const ctx = vm.createContext({ exports: {}, Buffer, Error, JSON, console, ...bindings });
  new vm.Script(outputText, { filename: symbol + '.generated.js' }).runInContext(ctx, { timeout: 1000 });
  assert.equal(typeof ctx.exports[symbol], 'function', 'Compiled SUT must export function');
  return ctx.exports[symbol];
}
const endpoint = 'https://fcm.googleapis.com/fcm/send/sub/1';
const req = {
  headers: { get: (k) => k.toLowerCase() === 'authorization' ? 'Bearer test-cron-secret-12345' : null },
  json: async () => ({ userIds: ['user-1'], event: { event:'request_published', requestId:'req-1' } }),
};
const fakeNextResponse = { json: (data, init) => ({status: init?.status ?? 200, json: async () => JSON.parse(JSON.stringify(data))}) };
function routeUnderTest(source, emitterResponse) {
  return compile(source, 'POST', {
    crypto, serverEnv:{CRON_SECRET:'test-cron-secret-12345'},
    sendPushRouteSchema:{safeParse:(v)=>({success:true,data:v})},
    sendPushNotification: async () => emitterResponse,
    NextResponse:fakeNextResponse,
  });
}
async function probeRoute(source) {
  const POST=routeUnderTest(source,{
    totalSubscriptions:2,sentCount:1,failedCount:1,deletedSubscriptions:[],
    attempts:[{outcome:'sent',endpoint,status:201},{outcome:'blocked',status:0,error:'ENDPOINT_NOT_ALLOWED'}], errors:[],
  });
  const response=await POST(req);
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.result.sentCount,1);
  assert.equal(json.result.failedCount,1);
  assert.deepEqual(json.result.attempts[1],{outcome:'blocked',status:0,error:'ENDPOINT_NOT_ALLOWED'});
  assert.equal(Object.hasOwn(json.result.attempts[1],'endpoint'),false);
  assert.equal(JSON.stringify(json).includes('push.example.com'),false);
}
function senderUnderTest(source) {
  return compile(source, 'sendPushNotification', {
    DefaultPushDatabaseClient:class{ }, WebPushTransport:class{ },
    isAllowedPushEndpoint: (url) => url.startsWith('https://fcm.googleapis.com/'),
    buildPushPayload: e=>e,
  });
}
async function probeSender(source) {
  const send=senderUnderTest(source); const failed=[];
  for(const status of [200,201,300,302,399,404,410,429,500,503]) {
    const deleted=[];
    const db={getSubscriptionsForUsers: async () => [{id:'sub-1',userId:'user-1',endpoint,p256dh:'k',auth:'a'}],
      deleteSubscriptionByEndpoint: async v=>deleted.push(v)};
    const transport={send:async()=>({status})};
    const result=await send(['user-1'],{event:'request_published',requestId:'req-1'},{db,transport});
    const successful=status>=200 && status<300;
    const removed=status===404 || status===410;
    try {
      assert.equal(result.sentCount,successful?1:0,'sentCount HTTP '+status);
      assert.equal(result.failedCount,successful?0:1,'failedCount HTTP '+status);
      assert.equal(deleted.length,removed?1:0,'DB deletes HTTP '+status);
      assert.equal(result.deletedSubscriptions.length,removed?1:0,'delete array HTTP '+status);
      assert.equal(result.attempts.length,1);
      assert.equal(result.attempts[0].status,status);
      assert.equal(result.attempts[0].outcome,'sent');
      assert.equal(result.attempts[0].endpoint,endpoint);
    } catch(e) {failed.push({status,message:e.message})}
  }
  return failed;
}
(async()=>{
  await probeRoute(routeSut);
  assert.deepEqual(await probeSender(senderSut), []);
  console.log('GREEN independiente aislado: HTTP blocked sin endpoint, clasificador [200,201,300,302,399,404,410,429,500,503].');

  const leak = routeSut.replace('return NextResponse.json({ ok: true, result });',
    "return NextResponse.json({ ok:true, result:{ ...result, attempts:result.attempts.map(a => a.outcome === 'blocked' ? { ...a, endpoint:'https://push.example.com/leak' } : a )} });");
  assert.notEqual(leak,routeSut,'H01 mutation missed target');
  let caught=false;
  try{await probeRoute(leak)}catch(e){caught= /deepStrictEqual|Expected values to be strictly equal|push\.example/.test(e.message);console.log('RED H01: '+e.message.split('\n')[0]);}
  assert(caught,'H01 mutation not caught by actual compiled route');

  const badSender=senderSut.replace('status < 300','status < 400');
  assert.notEqual(badSender,senderSut,'H02 mutation missed target');
  const failures=await probeSender(badSender);
  assert.deepEqual(failures.map(x=>x.status),[300,302,399]);
  console.log('RED H02: statuses '+failures.map(x=>x.status).join('/')+' fail on sentCount; other statuses retain expected behavior.');

  await probeRoute(routeSut);
  assert.deepEqual(await probeSender(senderSut), []);
  console.log('RESTORED GREEN: both SUT functions unchanged after in-memory mutation.');
})().catch((e)=>{console.error(e);process.exitCode=1});
```

```bash
node /tmp/pr698-review-harness.cjs .
# El SHA de la fuente debe ser 69fdfd85; comprobar git rev-parse HEAD.
```

## Evidencia de CI del SHA completo

- [Run 43172625497](https://github.com/cadeApp/cadeApp/actions/runs/43172625497) HEAD `69fdfd85` concluyó **failure**. Unit job `131029361959` **success**, log real: `Test Files 204 passed (204)`, `Tests 3864 passed (3864)`. Typecheck `131029362223`, lint `131029362246`, audit `131029362261`: **success**.
- DB job `131029362381` **success**; pgTAP `Files=46, Tests=3858, Result: PASS`, `cc049_push_subscriptions_hardening.sql ... ok`, preservación `[CC-035] CC-049 preservación GREEN: E01 y E08 siguen idénticas tras la primera aplicación`, y `git diff --exit-code -- src/types/database.types.ts` exitoso.
- Build job `131029362289` **failure**: `src/app/layout.tsx` → `An error occurred in next/font` → `TypeError: Cannot read properties of null (reading '1')` en `@next/font/dist/google/loader.js:122:78` para Montserrat; webpack reporta `Build failed` con exit 1. `layout.tsx` no figura entre los 3 archivos del diff incremental. **Causa no demostrada**; el run verde anterior construyó con el mismo código funcional. Bundle-budget `skipped` como consecuencia.
- Approval-policy run `43172625367` **success**.
- La bitácora del autor documenta su Vitest mutado: H01 `1 failed | 54 passed (55)`; H02 `3 failed | 52 passed (55)`; restaurado `55/55`. **No fueron ejecutados por este revisor**; el ensayo propio arriba comprueba el efecto aislado sobre funciones de producción del SHA con mutaciones en memoria.

## Chequeos de alcance e historial

`494e718c..69fdfd85` = un commit, solo `docs/tasks/log/T-432.md`, `src/app/api/push/send/route.test.ts`, `src/server/push/push.test.ts`. Los archivos del review no fueron modificados por el autor (GitHub commits por path muestra último `494e718c`). `develop..69fdfd85` = 27 rutas, todas admitidas por whitelist de develop **salvo** `src/domain/cc040-announcements.test.ts`, D01-A aceptada; la ficha de rama agrega esa única ruta. `git merge-tree` no ejecutado por falta de clon, GitHub indica `mergeable:true`. Sin Supabase ni Docker local; no E2E preview en el SHA.
