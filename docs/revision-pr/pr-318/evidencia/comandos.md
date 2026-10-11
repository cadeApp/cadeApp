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
