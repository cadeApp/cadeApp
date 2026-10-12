# Evidencia y comandos — PR #318 / Ronda 1

**Fecha:** 2026-10-11 · **SHA de código/bitácora inspeccionado:** `4e70e93486463f261722108bedc3e8d622708617`.  
**Base:** `develop` con squash de PR #317 en `267e9810f99343f2511473d76dddd4e5da740847`.

## Consultas realizadas mediante el conector de GitHub

1. `GET PR #318`: `draft=true`, `merged=false`, rama `feat/T-340-lectores`.
2. Comparación `develop...feat/T-340-lectores`: `ahead=2, behind=0`, **1 único archivo** `docs/tasks/log/T-340.md` (+43 líneas), sin code/SQL/CI/E2E.
3. `docs/tasks/log/T-340.md` sesión `2026-10-11 18:30`: `Gate 0 bloqueado`, `HAS_URL: false`, test remoto **no corrido**, PR Draft; ningún cambio de lectores.
4. `GET /actions/runs/38171033590/jobs`: `migrate-develop` success; log: **`Applying migration 20261009200000_t340_multi_drop.sql...`**.
5. `GET /actions/runs/38171033600/jobs`: `audit`, `lint`, `db-tests`, `unit`, `build`, `typecheck`, `bundle-budget` con conclusion `success`.
6. `GET /actions/runs/38171291606/jobs`: `resolve-preview`, `e2e-preview`, `report-preview-status` `success`. No prueba en ese run identificada como Gate 0.
7. `src/server/e2e/staging-seed.ts`: `createStagingSeedContext`, `cleanupStagingData`, `findRequestIdByNotesMarker` que agrega el request de UI a `createdRequestIds` para limpieza; `createAuthenticatedClient`; `isAllowedE2EEnvironment` fail-closed.
8. `e2e/fixtures/roles.ts`: fixture crea merchant y 2 couriers temporales, los limpia en `finally`. `e2e/specs/main-flow.spec.ts`: UI legacy real con cash, cambio preset 5000, `notesMarker` y `findRequestIdByNotesMarker`. `e2e/specs/request-states.spec.ts`: `createAuthenticatedClient`, `accept_offer` como merchant, inspect backend.
9. `.github/workflows/e2e-preview.yml`: `environment: develop`, `concurrency: cadeapp-develop-e2e`, `pnpm exec playwright test --project=chromium --workers=1`, `SUPABASE_SERVICE_ROLE_KEY` leído desde `secrets` y **no mostrado**.

## Control independiente reproducible del Gate 0

Desde **checkout limpio exactamente del SHA auditado**, guardar en `/tmp/pr318-r1-check.cjs` este script; no usa red ni modifica archivos. La comprobación basal debe ser **GREEN para el hecho «Gate 0 correctamente reportado como pendiente»**, y la mutación textual adversarial debe volverse RED. No se presenta esta comprobación como E2E ni como sustituto del checkpoint:

```js
const fs=require('node:fs');
const assert=require('node:assert/strict');
const log=fs.readFileSync('docs/tasks/log/T-340.md','utf8');
const task=fs.readFileSync('docs/tasks/T-340.md','utf8');
const spec='e2e/specs/t340-legacy-checkpoint.spec.ts';
const latest=log.split('## 2026-10-11 18:30 — asako669 (agy)').at(-1);

function gateWasNotExecuted(session) {
  return session.includes('Gate 0 bloqueado:') &&
    session.includes('No se modificó ningún archivo de lectores') &&
    session.includes('Falta ejecutar el checkpoint funcional');
}
assert(latest!==log,'No apareció la sesión del autor R1');
assert(gateWasNotExecuted(latest),'El baseline no declara Gate 0 pendiente');
assert(!fs.existsSync(spec),'Ya existe spec de Gate 0: reauditar SHA');
assert(task.includes('verificación con cliente legacy'),'No hay gate en ficha');

const mutant=latest.replace('Gate 0 bloqueado:', 'Gate 0 cerrado:');
assert(mutant!==latest,'Mutación sin objetivo');
assert(!gateWasNotExecuted(mutant),'La sonda no detectó una afirmación falsa de cierre');
console.log('BASELINE: no hay test de Gate 0 y el autor lo declara bloqueado');
console.log('RED adversarial: alteración de estado del gate detectada (solo texto)');
console.log('Esto NO ejecuta las cuatro invariantes contra Supabase Develop');
```

**Alcance de comprobación efectivamente hecha por el revisor:** comparación/diff y lectura de bitácora, contrato, test fixtures, flujo E2E y resultados de CI; sin checkout local ni ejecución del script anterior. No se afirma haber ejecutado el nuevo E2E ni una mutación real de SQL.

## E2E que deberá aportar el agy al resolver H01

**Archivo permitido por opción A:** `e2e/specs/t340-legacy-checkpoint.spec.ts` (un nuevo spec). No modificar workflow ni secretos. Gate de ejecución: este spec debe entrar por autodiscovery en `e2e-preview` usando `--project=chromium`, credenciales `environment: develop`, fixture `stagingContext` y cleanup.

**Oráculos sobre la misma request proveniente de la UI legacy:** `status='published'`, `drops_count=1`, `count(drop)=1`, contacto privado de esa entrega con `cash_change_amount=5000` y nota centinela; reintento `publish_request` no crea segundo drop (capturar error esperado exacto si estado ya no es draft); tras oferta `pending` + `accept_offer`, `get_trip_details` como actor autorizado devuelve exactamente los campos previos; columnas legacy `notes` y `cash_change_amount` siguen intactas. Asegurar `requestId` de `findRequestIdByNotesMarker` para evitar que la suite use la request seed previa.

**Prueba RED mínima real del nuevo test:** en la aplicación/DB **no** hacer modificaciones destructivas de la instancia Develop compartida; mutar temporalmente **una aserción del E2E** para exigir `drops_count=2` o un importe distinto; la misma prueba real contra Develop debe fallar específicamente por ese oráculo, **restaurar** la aserción y repetir GREEN. Esto demuestra que la aserción funciona pero **no sustituye** mutación del comportamiento productivo: para una demostración más fuerte usar mutation SQL solo en instancia efímera, nunca Develop. No cambiar hooks a `.skip`, `test.only` ni fingir RED.

**Criterio de CI:** leer el log interno del job E2E **del SHA que contiene el nuevo archivo**, localizar `t340-legacy-checkpoint.spec.ts`, 4 invariantes, resultado y enlaces; registrar junto al commit en `docs/tasks/log/T-340.md`. Un run verde de la rama anterior no cierra Gate 0.

## Ronda 2 — E2E funcional real y control independiente de cobertura

**SHA auditado:** `9c5e797cec93a8e621c0faf3f7b3feef869d7c85`, archivo nuevo `e2e/specs/t340-legacy-checkpoint.spec.ts` (217 líneas). Diff desde R1: **solo** archivo E2E y nueva bitácora de agy; no tocó los archivos de revisión ni implementación de lectores.

**Ejecuciones reales consultadas en GitHub (no son hipótesis):**

- GitHub Actions CI, run https://github.com/cadeApp/cadeApp/actions/runs/38178270092 (SHA exacto): checks unit, typecheck, lint, build, audit, bundle-budget, db-tests PASS. Job `db-tests` 114585177535: `Files=21, Tests=1980, Result: PASS`; H08 8/8 y H14 3/3; mutantes H15 del **paso 1** RED→GREEN; `db:types --local` sin drift.
- GitHub Actions **e2e-preview** https://github.com/cadeApp/cadeApp/actions/runs/38178339003, job https://github.com/cadeApp/cadeApp/actions/runs/38178339003/job/114585413997. El checkout muestra `HEAD is now at 9c5e797 test(e2e): add legacy client checkpoint spec for Gate 0 [T-340]`. Log literal:
```text
✓  63 [chromium] › e2e/specs/t340-legacy-checkpoint.spec.ts:29:7 › T-340 Gate 0 — Checkpoint funcional de compatibilidad legacy posmerge › T-340 Gate 0: cliente legacy publica 1 drop, reintento sin duplicación, get_trip_details post-match y persistencia legacy (21.9s)
71 passed (14.9m)
3 passed (1.0m)
```
- El job `report-preview-status` 114591314176 concluyó PASS y `GET /commits/9c5e797.../status` respondió `context='e2e-preview', state='success'` para ese SHA. No se confundió con el `73/73` del SHA anterior.
- **NO hay línea RED ni segunda corrida del E2E nuevo**: no inventarla. El job verde prueba los cuatro oráculos *con las funciones intactas*, no un mutante de producto.
- Última bitácora del autor `2026-10-11 19:10` termina en «Falta: push / ejecución GREEN / documentación de Gate 0». La rama sí fue pusheada y Actions pasó, por lo que el registro ya no refleja el estado real.

### Sonda reproducible de integridad del nuevo E2E (solo texto y mutaciones EN MEMORIA)

Guardá este código como `/tmp/pr318-r2-check.cjs` desde checkout del SHA exacto; ejecutá `node /tmp/pr318-r2-check.cjs`. No requiere red, no edita la prueba ni consulta datos de usuario. Las condiciones equivalentes fueron **evaluadas en V8** sobre los bytes exactos devueltos por el conector en esta revisión; la sonda no ejecuta Playwright y no debe presentarse como RED runtime.

```js
const fs=require('node:fs');
const assert=require('node:assert/strict');
const src=fs.readFileSync('e2e/specs/t340-legacy-checkpoint.spec.ts','utf8');
const expected=[
 ['submit UI','await merchantPage.submitRequestButton.click()'],
 ['marker ID','await findRequestIdByNotesMarker(stagingContext, notesMarker)'],
 ['published','expect(reqRow?.status).toBe(\'published\')'],
 ['drops_count','expect(reqRow?.drops_count).toBe(1)'],
 ['one drop','expect(dropsRows).toHaveLength(1)'],
 ['canonical position','expect(drop.position).toBe(1)'],
 ['private notes','expect(dropContacts?.notes).toBe(notesMarker)'],
 ['private cash','expect(dropContacts?.cash_change_amount).toBe(CHANGE_AMOUNT)'],
 ['real retry RPC',"merchantClient.rpc('publish_request'"],
 ['exact retry error',"expect(retryError?.message).toContain('INVALID_STATE_TRANSITION')"],
 ['same UUID','expect(retryDrop.id).toBe(drop.id)'],
 ['real acceptance RPC',"merchantClient.rpc('accept_offer'"],
 ['courier RPC',"courierClient.rpc('get_trip_details'"],
 ['trip notes','expect(trip?.deliveryNotes).toBe(notesMarker)'],
 ['trip cash','expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT)'],
 ['legacy notes','expect(finalReq?.notes).toBe(notesMarker)'],
 ['legacy cash','expect(finalReq?.cash_change_amount).toBe(CHANGE_AMOUNT)'],
 ['track offer','trackEntityForCleanup(stagingContext, \'offer\', offerId)']
];
for(const [name,needle] of expected){
 assert(src.includes(needle),'Falta control fuente: '+name);
}
const mutants=[
 ['wrong private notes',src.replace(
   'expect(dropContacts?.notes).toBe(notesMarker)',
   "expect(dropContacts?.notes).toBe('incorrect')"),
   'expect(dropContacts?.notes).toBe(notesMarker)'],
 ['replace same UUID check',src.replace(
   'expect(retryDrop.id).toBe(drop.id)',
   'expect(retryDrop.id).toBeDefined()'),
   'expect(retryDrop.id).toBe(drop.id)'],
 ['remove UI publish',src.replace(
   'await merchantPage.submitRequestButton.click()',
   'await Promise.resolve()'),
   'await merchantPage.submitRequestButton.click()'],
 ['switch actor courier→merchant',src.replace(
   "courierClient.rpc('get_trip_details'",
   "merchantClient.rpc('get_trip_details'"),
   "courierClient.rpc('get_trip_details'"],
 ['omit legacy cash check',src.replace(
   'expect(finalReq?.cash_change_amount).toBe(CHANGE_AMOUNT)',
   'expect(finalReq).toBeDefined()'),
   'expect(finalReq?.cash_change_amount).toBe(CHANGE_AMOUNT)']
];
for(const [name,mutant,needle] of mutants){
 assert.notEqual(mutant,src,'Mutación sin objetivo: '+name);
 assert(!mutant.includes(needle),'Mutación no detectada por control: '+name);
}
console.log('BASELINE 18/18 marcadores de contrato presentes');
console.log('5/5 mutaciones adversariales del código E2E detectadas en memoria');
console.log('NO se ejecutó PostgreSQL mutado ni Playwright RED en esta sonda');
```

**Resultados de inspección independiente efectivamente obtenidos:** baseline `18/18 present=true`; mutantes `5/5 changed=true && detected=true`. La sonda solo verifica presencia estructural y sensibilidad textual; la **ejecución real GREEN** se sostiene por el log del job anterior, no por la sonda. No se afirma haber copiado el script a un worktree o ejecutado localmente.

### Red funcional de este NUEVO spec: aún sin prueba

Para cerrar H02 hace falta una corrida de este mismo spec con una perturbación adversarial que lo haga fallar con el **error de aserción específico del valor cambiado** (p. ej., `cashChangeAmount` o `drops_count`), y luego restauración + corrida GREEN, con SHA/runs fechados. No alterar SQL o RLS del Supabase Develop compartido para obtener RED. Documentar expresamente que una mutación de EXPECTATIVA de test es un RED de aserción, no un mutante de comportamiento productivo. Si no se pudo ejecutar, decir «no ejecutado».

El revisor NO disparó Actions ni modificó datos/secretos; dejó todos los cambios en `docs/revision-pr/pr-318/**`. El autor debe actualizar su propia `docs/tasks/log/T-340.md`.

## Ronda 3 — Ciclo RED→GREEN AUTÉNTICO del E2E Gate 0

**SHA auditado de autor (antes de los commits documentales del revisor):** `e61fab677bb581272ee6ab541e3ce1f0c14d1ab2` · PR #318.  
**RED real (expectativa adversarial):** `4c4f26d6c2f1817f1cb51da280b163276ef2a8eb`  
**GREEN restaurado:** `c83c5e887611159526c8ee2c3df9517428e5b5d7`

**No confundir:** en esta ronda **NO se mutó SQL productivo**; se alteró transitoriamente una expectativa de Playwright para observar que el mismo spec detectaba una devolución distinta a la esperada. Los valores productivos siguieron siendo 5000.

### Acceso directo a los logs de Actions efectivamente leídos

- RED: https://github.com/cadeApp/cadeApp/actions/runs/38181178771/job/114593911361
- GREEN: https://github.com/cadeApp/cadeApp/actions/runs/38183724823/job/114601542342
- CI restaurado: https://github.com/cadeApp/cadeApp/actions/runs/38183659433
- CI posterior de docs (no sustituye RED/GREEN): https://github.com/cadeApp/cadeApp/actions/runs/38184897947

```text
# RED — HEAD is now at 4c4f26d
✘ [chromium] › e2e/specs/t340-legacy-checkpoint.spec.ts:29:7 ...
Error: expect(received).toBe(expected)
Expected: 6000
Received: 5000
> 192 | expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT + 1000)
(retry #1) mismo error
(retry #2) mismo error
1 failed
70 passed (15.4m)

# GREEN — HEAD is now at c83c5e8
✓ [chromium] › e2e/specs/t340-legacy-checkpoint.spec.ts:29:7 ... (23.7s)
71 passed (14.7m)
3 passed (58.5s)
```

### Detector independiente reproducible: comparar código RED, GREEN y SHA revisado

Crear `/tmp/pr318-r3-check.cjs` con este bloque y ejecutarlo **desde un clon local con los tres commits accesibles**, usando `node /tmp/pr318-r3-check.cjs`. El script NO llama Supabase, NO cambia el repositorio y solo usa la stdlib de Node. Si el clon no contiene los commits de la PR, `git fetch` normal primero (sin reset/force/rebase).

```js
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const path='e2e/specs/t340-legacy-checkpoint.spec.ts';
const red='4c4f26d6c2f1817f1cb51da280b163276ef2a8eb';
const green='c83c5e887611159526c8ee2c3df9517428e5b5d7';
const reviewed='e61fab677bb581272ee6ab541e3ce1f0c14d1ab2';
function get(ref){return execFileSync('git',['show',ref+':'+path],{encoding:'utf8'});}
const [mutant,restored,head]=[red,green,reviewed].map(get);
const bad="expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT + 1000);";
const good="expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT);";
assert(mutant.includes(bad),'RED no muta la expectativa exacta');
assert(!mutant.includes(good),'RED todavía contiene expectativa original');
assert(restored.includes(good),'Restauración no recupera 5000');
assert(!restored.includes(bad),'La expectativa adversarial persiste en GREEN');
assert.equal(restored,head,'El SHA revisado no mantiene el spec GREEN exacto');

const r=mutant.split('\n'),g=restored.split('\n');
assert.equal(r.length,g.length,'Mutación cambió estructura/longitud del spec');
const changed=r.map((x,i)=>({line:i+1,red:x,green:g[i]})).filter(x=>x.red!==x.green);
assert.equal(changed.length,1,'Mutación cambió más de una línea');
assert.equal(changed[0].line,192,'Cambió una línea distinta de la aserción objetivo');
assert.equal(changed[0].red.trim(),bad);
assert.equal(changed[0].green.trim(),good);

function isRestored(s){return s.includes(good)&&!s.includes(bad);}
assert(isRestored(restored),'GREEN de fuente no validó');
assert(!isRestored(mutant),'RED de fuente engañosamente pasó');
console.log('SHA exactos: source RED→GREEN cambió 1 línea (192) y fue restaurada');
console.log('5 controles independientes sobre el oráculo y SHA de código: PASS');
console.log('El RED real Playwright está en run 38181178771, NO lo ejecutó este script');
```

**Verificación propia efectivamente realizada:** mediante conector de GitHub se descargaron por SHA las tres versiones del archivo. Resultado: solo cambió la **línea 192**, restauración byte-idéntica al spec del HEAD auditado y `Expected 6000 / Received 5000` literal en **el log real** de la corrida RED, repetido en los dos retries. La ejecución GREEN posterior recuperó 5000 sin cambios adicionales. No se ejecutó el script /tmp en un checkout local; se ejecutó comprobación equivalente directamente sobre blobs fuentes recuperados.

### Bitácora de autor, correcciones mínimas del revisor y estado

- Bitácora ahora contiene sesiones `19:40` (GREEN Gate 0 del primer SHA), `20:15` (RED adversarial del nuevo E2E) y `20:35` (GREEN restaurado) con links a los jobs y errores exactos.
- La bitácora original contenía los SHA completos **incorrectos** `4c4f26d63a863ecfd188176882252a1290fa8b6d` y `c83c5e888470a7bb3ae2ec2bb371cb1cb9eb5d8c`, aunque los prefijos cortos y los run IDs eran verdaderos. El revisor corrigió ambas cadenas directamente a los SHA **reales** de GitHub en el commit `4caad04a4850b02395d4283656928c1faab076d5`. No se alteró código de E2E ni los resultados de CI.
- La PR fue encontrada con `draft=false` aun sin implementación de lectores y pese a su body; el revisor la convirtió nuevamente en **Draft**. También se actualizó el body para indicar que **Gate 0 está verificado**, pero faltan lectores completos del paso 2.

**Pendiente no-Gate:** implementar lectores de paso 2; completar sus propios tests, revisión, merge y checkpoint. **No se deben mezclar estos pasos con el cierre de Gate 0.**

## Ronda 4 — Lectores multi-drop — 2026-10-12

**SHA de código auditado:** `c7cab17491d49791dbb49d4b2e5696ff64a9495d`, base `develop` `267e9810f99343f2511473d76dddd4e5da740847`.

**Fuentes GitHub inspeccionadas:** `src/server/rpc/requests.ts`, `src/features/trips/schemas.ts`, ambas migraciones T-340, `src/features/trips/{queries,types}.ts`, vistas de viajes merchant/courier, `src/features/offers/queries.ts`, `src/server/live/t204.ts`, `src/features/requests/queries.ts`, los nuevos unit/pgTAP y bitácora. Se comprobaron 12 condiciones estáticas sobre estos archivos (sin clonar repo ni DB local).

### Evidencia de fallos CI reales

- CI run `38194520264` sobre HEAD `c7cab174`: `db-tests` job `114634153789` falla *después* de aplicar la nueva migración `20261012010000_t340_readers.sql` en Postgres efímero de CI. Mensaje literal: `duplicate key value violates unique constraint "delivery_requests_pkey"`, ID `30000000-0000-4000-8000-000000003430` (dos fixtures del mismo SQL, líneas 295 y 1279). Planificados 83, ejecutados 77; `Result: FAIL`.
- `unit` job `114634153773`: `src/domain/testing/rpc-fake.ts` cobertura statements `88.78%`, branches `84.88%`, ambas bajo umbral obligatorio `90%`: exit 1. Se verificó desde el log interno, no por color de badge.
- Checks técnicos en ese HEAD: typecheck/lint/build/audit/bundle-budget PASS; db-tests/unit FAIL; `e2e-preview=error` (no GREEN de este SHA); `approval-policy=fail`. No afirmar el estado del HEAD tras commits de revisión sin revalidarlo.

### Matriz de hallazgos estructurales del SHA

| ID | Prueba por inspección | Oráculo que falta |
|---|---|---|
| H03 | `callRequestRpc` añade `p_request_id` por tener `requestId`; SQL `mark_drop_delivered(uuid)` / `mark_drop_failed(uuid,text)` no lo acepta | spy real de client.rpc con args EXACTOS por operación |
| H04 | nueva SQL usa `d.position = 1` y `coalesce(..., v_request.notes/cash_change_amount)`; sin `drops[]` | 3 drops en posiciones mezcladas y columnas legacy NULL |
| H05 | feed/live aún seleccionan destino del request padre; solo añaden `dropsCount` | 1/3 drops con zonas, tipos, tramos y sin PII pre-match |
| H06 | vista comercio usa `trip.recipientPhone` único; courier muestra solo `trip.dropoffAddress`; historial padre | UI 3 destinatarios + WhatsApp individual y total/cobrable |
| H07 | mismo `v_req_id` en dos fixtures transaccionales | `db-tests` PASS con `plan(83)` íntegro |
| H08 | fake incorpora muchas ramas nuevas y coverage del CI falla | tests de cada branch sin manipular umbrales |
| H09 | nuevos pgTAP solo insertan 1 drop y unit prueba fake; no hay E2E N lectora | SQL N real + Playwright 3 drops por fixtures + RED propio |

### Sonda reproducible de lectura de fuentes (no es un test runtime)

En un checkout limpio del SHA auditado, copiar el siguiente bloque a `/tmp/pr318-r4-probe.cjs` y ejecutarlo con `node /tmp/pr318-r4-probe.cjs`. Las sustituciones son **en memoria**. Ni el script ni el revisor modifican SQL remoto ni el worktree. Este harness NO sustituye las pruebas RED→GREEN de la implementación:

```js
const fs=require('node:fs'), assert=require('node:assert/strict');
const paths={rpc:'src/server/rpc/requests.ts',sql:'supabase/migrations/20261012010000_t340_readers.sql',feed:'src/features/offers/queries.ts',view:'src/features/trips/components/trip-merchant-view.tsx',tap:'supabase/tests/t340_multi_drop.sql'};
const f=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
const duplicate="v_req_id uuid := '30000000-0000-4000-8000-000000003430'";
const checks={
 H03:x=>x.rpc.includes("if ('requestId' in input)"),
 H04:x=>x.sql.includes('and d.position = 1;'),
 H05:x=>!x.feed.includes('delivery_request_drops'),
 H06:x=>x.view.includes('buildWhatsAppUrl(trip.recipientPhone, customerMsg)'),
 H07:x=>x.tap.split(duplicate).length-1===2
};
Object.entries(checks).forEach(([id,fn])=>assert(fn(f),'Baseline ausente: '+id));
const fixes={
 H03:["rpc","if ('requestId' in input)","if ('requestId' in input && !rpcName.startsWith('mark_drop_'))"],
 H04:['sql','and d.position = 1;','and d.position >= 1;'],
 H06:['view','buildWhatsAppUrl(trip.recipientPhone, customerMsg)','buildWhatsAppUrl(trip.drops[0].recipientPhone, customerMsg)']
};
for(const [id,[k,a,b]] of Object.entries(fixes)){
 const mutant={...f,[k]:f[k].replace(a,b)};
 assert.notEqual(mutant[k],f[k]); assert(!checks[id](mutant),'Detector inmune: '+id);
}
const mFeed={...f,feed:f.feed+'\ndelivery_request_drops'};
assert(!checks.H05(mFeed),'Detector inmune: H05');
const at=f.tap.lastIndexOf(duplicate); assert(at>=0);
const mTap={...f,tap:f.tap.slice(0,at)+duplicate.replace('003430','003440')+f.tap.slice(at+duplicate.length)};
assert(!checks.H07(mTap),'Detector inmune: H07');
console.log('5/5 deficiencias fuente encontradas; 5/5 mutantes in-memory detectados');
console.log('NO se ejecutó Playwright, pgTAP ni Supabase por esta sonda');
```

**Resultado de la revisión efectivamente ejecutada:** 12/12 condiciones estáticas sobre fuentes GitHub son positivas (deficiencia presente). Los jobs de CI citados aportan los fallos runtime; la sonda no se ejecutó en un checkout local por el revisor y se propone como herramienta reproducible, NO como GREEN/RED runtime acreditado.

**Decisión A tomada por Lautaro073:** `get_trip_details` devuelve array `drops[]` tipado por posición, con contactos privados solo post-match; mantiene campos escalares de salida derivados de primer drop, pero **nunca lee** columnas legacy de DB. Autorización en ficha de la rama. No tocar limpieza del paso 3 ni escritor del paso 4.

## Ronda 5 — Código SHA `58811a3038dc819c5e0e6e3136f450bf5fb47b7c` (2026-10-12)

**Comparado contra ronda 4 `9ad7c333`:** 2 commits, 27 archivos. Rama `behind=0`, Draft. La ficha de `develop` se leyó **antes** del código. Opción A adicional para fixtures históricos se registró en ficha de la rama por el revisor en `ea4ab8ce` y NO modifica el SHA productivo auditado.

### CI realmente ejecutado en Actions

- [CI run 38271482164](https://github.com/cadeApp/cadeApp/actions/runs/38271482164) — SHA exacto `58811a30`.  
- [db-tests job 114886529374](https://github.com/cadeApp/cadeApp/actions/jobs/114886529374) — **FAIL**. Migración `20261012010000_t340_readers.sql` instalada en Postgres EFÍMERO de job antes de ejecutar suites; no en Develop remoto por el revisor.
- [unit job 114886529521](https://github.com/cadeApp/cadeApp/actions/jobs/114886529521) — **PASS**. `rpc-fake.ts` columns: statements `95.32`, branches `91.35`, functions `100`.
- typecheck/lint/build/audit/bundle-budget PASS, approval-policy FAIL, Supabase Preview SKIPPED. **No E2E Preview GREEN observado** en el commit; una carpeta/spec no acredita ejecución.

**Errores exactos en db-tests (tres suites):**
```text
supabase/tests/cc008_trip_details.sql:117: ERROR: NOT_FOUND
Bad plan. You planned 13 tests but ran 2.

supabase/tests/cc023_private_columns.sql:403: ERROR: NOT_FOUND
# Failed test 7: "owner merchant receives requestId, notes and cashChangeAmount"
Bad plan. You planned 42 tests but ran 36.

supabase/tests/t340_multi_drop.sql:1358:
ERROR: insert or update on table "delivery_requests" violates foreign key constraint
"delivery_requests_accepted_offer_fk"
Bad plan. You planned 90 tests but ran 77.
Files=21, Tests=1963, Result: FAIL
```

### Evidencia cruzada propia en código de GitHub

| Hallazgo | Fuente exacta comprobada y conclusión |
|---|---|
| H03 | `src/server/rpc/requests.ts:44–49` manda payloads por firma; `requests.test.ts:257–334` usa `toHaveBeenCalledExactlyOnceWith` y key set. Unit job PASS. Arreglado-verificado. |
| H04 | `20261012010000_t340_readers.sql:109–143,165–193` usa jsonb_agg ordenado y scalar desde primer drop sin legacy fallback. Tests `cc008_trip_details.sql:75–94`, `cc023_private_columns.sql:89–119` no siembran children requeridos; CI falla en ruta runtime. |
| H05 | `src/features/offers/queries.ts:120–180,190–237`, `src/server/live/t204.ts:124–190,195–236`: consulta batch públicas sí; validación obligatoria de parents nullable y fallback ficticio de 1 drop N no. |
| H06 | `src/features/requests/queries.ts:261–280,432–445,648–720` no consume `delivery_request_drops`; tipos de listas siguen scalar. Las vistas de viaje tienen `(trip as any).requestId` y `packageType:'chico'` fake. |
| H07 | `supabase/tests/t340_multi_drop.sql:1286–1306`: el INSERT request asigna `accepted_offer_id=v_offer_id` ANTES del INSERT offers. FK falla genuinamente en job. UUID repetido anterior ya no está. |
| H08 | Log unit job `114886529521`: `rpc-fake.ts 95.32 / 91.35 / 100`; PASS sin tocar thresholds. |
| H09 | `e2e/specs/multi-drop.spec.ts`: 218 líneas pero no run verde de Preview, solo aserciones DOM de privacidad, todos los drops misma zona, no chequea error de `update({drops_count:3})`, ni courier extraño, ni RED documentado. |
| H10 | `trip-courier-container.tsx:30–49` llama `markTripDeliveredAction({requestId})` para in_transit y `trip-courier-view.tsx:271–285` expone el mismo único botón, aunque existen acciones `markDropDeliveredAction`/`markDropFailedAction` en `actions.ts:184–222`. No existe UI para completar drop 2. |

**Comprobación adversarial propuesta a Asako (NO ejecutada por el revisor):**
- H04: antes del fixture, `get_trip_details` de request sin children debe fallar NOT_FOUND; tras crear child debe devolver datos sin tocar columnas DB legacy. **No cambiar assertions**.
- H05: cambiar parent nullable con 3 child drops válidos hace FALLAR código actual. Después no debe fallar. Borrar todos los child de N en fixture controlado nunca debe producir `dropsCount=1` ficticio.
- H07: POSTGRES FK falla antes del INSERT oferta. Cambiar orden de operaciones resuelve la FK preservando registros.
- H10: test unit de TripCourierContainer en `in_transit` con 3 child pendientes inicialmente invocará `markTripDeliveredAction`, lo que debe dar RED contra expect de `markDropDeliveredAction({dropId:...})`, GREEN tras corregir. No se ejecutó porque no existe checkout local, registrado como pendiente.

**Limitaciones expresas:** el revisor leyó resultados reales de CI y código remoto, no ejecutó un Docker, Postgres local, SQL mutante, E2E ni red/green nuevos. No afirmar «hallazgo verificado runtime» para H05/H06/H09/H10; clasificados por inspección, por confirmar con pruebas del autor. No utilizar un check verde viejo de Gate 0 como PASS del Step 2.

**Sin decisión abierta:** Lautaro073 aprobó A, dos tests legacy tienen autorización puntual en ficha, no se modifican aserciones ni CC-022. No avanzar al Paso 3 de Kira hasta merge/gate del Paso 2.


### Nota de entorno sobre H09 — límite real para E2E de Paso 2 ANTES del merge

Inspección independiente de `.github/workflows/e2e-preview.yml:3–4,22,53,60` y `.github/workflows/migrate.yml:3–7,17–18`: el Vercel Preview de las PRs se prueba contra **Supabase Develop COMPARTIDO**, pero las migraciones de feature se aplican a Supabase Develop **exclusivamente después del merge/push a la rama `develop`**. Por ello, aunque `e2e/specs/multi-drop.spec.ts` tuviera oráculos correctos, la RPC remota `get_trip_details` todavía carece de `drops[]` de Paso 2 hasta desplegar `20261012010000_t340_readers.sql`. **No exigir GREEN E2E nuevo premerge sobre ese backend viejo ni declarar falla de implementación por esa incompatibilidad de entorno**. **No autorizar a Asako a ejecutar `db push` manual sobre Supabase Develop**, y no inventar un nuevo workflow ni conexiones remotas.

Orden técnicamente seguro de validación: (1) obtener `db-tests` del SHA (migraciones nuevas probadas en DB efímero) + unit/typecheck/lint/build en verde, (2) auditar a nivel código/fixture los asserts del E2E nuevo con pruebas negativas unitarias/in-memory y dejar anotado **E2E POST-MIGRACIÓN PENDIENTE**, (3) resolver explícitamente el gate de release/premerge con Lautaro073 antes del eventual merge, (4) tras el merge y migración automática Develop, ejecutar el checkpoint E2E real contra ese backend y **NO** empezar Paso 3 con Kira hasta que esté verde. **Este informe NO autoriza el merge saltándose el gate ni convierte un spec no ejecutado en «verificado»**.

