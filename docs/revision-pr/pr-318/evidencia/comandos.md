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
