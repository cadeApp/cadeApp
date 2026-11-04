# Evidencia reproducible — PR #605, ronda 1

**Código revisado:** `159ecd097523c6d13918f31e00a9069000db8230`. Las herramientas de este entorno leen GitHub, pero no tienen clon descargable (`git ls-remote` devolvió «Could not resolve host: github.com»). No se levantó Docker, Supabase local ni remoto.

## E01 — Test independiente de la discriminación lógica H01

Script **completo y autocontenido**, original de la revisión; copia del mismo script se ejecutó en `/tmp` con Node 22. Esta es una **tabla de verdad**, no una prueba Vitest, pgTAP ni E2E sobre la aplicación.

```bash
cat > /tmp/pr605_h01_truth_table.cjs <<'JS'
'use strict';
const assert = require('node:assert/strict');
const pending = (courier) => courier.status === 'pending';
const correct = (courier) => pending(courier) && courier.application_submitted === true;
const mutant = (courier) => pending(courier) && courier.vehicle_type !== null;
const sent = {status:'pending', application_submitted:true, vehicle_type:'moto'};
const unsubmittedOld = {status:'pending', application_submitted:false, vehicle_type:null};
const unsubmittedA = {...unsubmittedOld, vehicle_type:'moto'};
assert.equal(correct(sent), true);
assert.equal(mutant(sent), true);
assert.equal(correct(unsubmittedOld), false);
assert.equal(mutant(unsubmittedOld), false);
console.log('Caso actual: ambos predicados devuelven [enviado=true, sin-envio=false]; test ciego.');
assert.equal(correct(unsubmittedA), false);
assert.equal(mutant(unsubmittedA), true);
console.log('D01=A: correcto excluye pendiente sin envío con moto; mutante lo incluye.');
console.log('Nota: tabla de verdad local; NO es test ejecutado contra SQL, UI ni E2E.');
JS
cp /tmp/pr605_h01_truth_table.cjs /tmp/pr605_h01_copia.cjs
node /tmp/pr605_h01_copia.cjs
```

**Salida comprobada:**
```text
Caso actual: ambos predicados devuelven [enviado=true, sin-envio=false]; test ciego.
D01=A: correcto excluye pendiente sin envío con moto; mutante lo incluye.
Nota: tabla de verdad local; NO es test ejecutado contra SQL, UI ni E2E.
```

El mutante deliberado es `pending && vehicle_type !== null`; se contrasta con `pending && application_submitted`. No altera repo ni base. **No se registró un RED real del test de producción**.

**Archivos para corroborar en un clon cuando esté disponible:**
- `e2e/specs/admin-applicants-search.spec.ts:80–85` (crea la cuenta sin envío).
- `src/server/e2e/staging-seed.ts:597–606` (vehículo null del seed).
- `supabase/migrations/20261104200100_cc044_admin_list_applicants.sql:83–85` (filtro correcto).
- `supabase/migrations/20261104200000_cc043_courier_application.sql:213–218` (guarda que permite vehículo con DNI nulo y sin envío).

## E02 — CI del SHA revisado (fuente independiente)

Run: https://github.com/cadeApp/cadeApp/actions/runs/41908208390

- `unit`: `Test Files 192 passed (192)` y `Tests 3532 passed (3532)`.
- `db-tests`: `Files=42, Tests=3396` y `Result: PASS`. Incluye `pnpm db:types --local` y comparación final de tipos.
- `typecheck`, `lint`, `build`, `audit` y `bundle-budget`: success.
- `bundle-budget`: advertencia para `/admin/applicants` (265 kB vs 180 kB); el job no convierte esas advertencias en error.
- `e2e-preview` del mismo SHA: pendiente al capturar la evidencia; no se confunde con los jobs del workflow CI.

## E03 — Verificaciones a repetir en un worktree limpio del SHA de arreglo

No ejecutadas en esta ronda por falta de clon y por no contar con credenciales de prueba. No pegar su salida como si se hubiera corrido.

```bash
# En un clon propio, sin leer .env ni secretos:
git fetch origin
git ls-remote origin feat/T-403-postulantes-a01
pnpm exec vitest run src/features/admin/queries.test.ts src/features/admin/schemas.test.ts src/features/admin/components/applicants-queue.test.tsx src/lib/format/format.test.ts > /tmp/pr605-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr605-unit.log
pnpm typecheck > /tmp/pr605-typecheck.log 2>&1
pnpm lint > /tmp/pr605-lint.log 2>&1
```

Para E2E **no** usar variables secretas locales ni Supabase remoto con claves privilegiadas. Confirmar `e2e-preview` disparado por el despliegue del SHA del arreglo y revisar su log, no solo su color. El test de mutación SQL de CC-044 se hará en entorno aislado mediante el seguimiento #606; nunca cambiar esa migración en T-403.

**M1–M3 del autor:** declaradas en bitácora pero no reproducidas por la revisión. No se declara ningún `verificado_en_sha`.

---

## E04 — Ronda 2 (SHA de código 5ea4c55): auditoría independiente y estado de CI

**Control independiente ejecutado contra los archivos de GitHub en dos SHAs:** un script JavaScript auditó el contenido real de `e2e/specs/admin-applicants-search.spec.ts` leído por el conector, no el texto de la bitácora. Afirmó dentro del bloque anterior a `admin.searchApplicants(searchTerm)` la presencia conjunta de: `.update({vehicle_type:'moto', vehicle_plate:'AE 002 EE', dni_hmac:null})` sobre `unsubmitted.id`; `.select('status, vehicle_type, vehicle_plate, dni_hmac, application_submitted, submitted_at').single()`; rama que falla ante `partialError || !partialCourier`; `toMatchObject({status:'pending',vehicle_type:'moto',vehicle_plate:'AE 002 EE',dni_hmac:null,application_submitted:false,submitted_at:null})`; y aserciones UI de `0 pendientes`, `1 pendiente` y `not.toContainText('sin envío')`.

- Entrada SHA `8a16d2c`: **RED estructural**, falta el bloque nuevo.
- Entrada SHA `5ea4c55`: **GREEN estructural**, todas las propiedades localizadas en el spec real.
- Ablación en memoria: se elimina el bloque añadido entre `const { data: partialCourier` y `const { credentials, totpSecret }`; el control vuelve a **RED estructural**. No se cambió repo, DB, tests ni expectativas.

Este resultado verifica **existencia y ubicación de la aserción**, NO la semántica en runtime. **La mutación de SQL y su RED E2E no se ejecutaron**. Reproducir el test E2E real solo contra el Preview legítimo con el workflow `e2e-preview`; no usar Supabase Develop para mutaciones.

**CI de código [41913324153](https://github.com/cadeApp/cadeApp/actions/runs/41913324153):** `unit` → `Test Files 192 passed (192)`, `Tests 3532 passed (3532)`; `typecheck`, `lint`, `build`, `audit`, `bundle-budget` successes. `db-tests` estaba in_progress al consultar (NO se consigna PASS). `bundle-budget`: /admin/applicants 264 kB / 180 kB advisory. **[E2E run 41913467285](https://github.com/cadeApp/cadeApp/actions/runs/41913467285):** resolve-preview success, e2e-preview in_progress y status pendiente, sin log terminado. Fecha de revisión: 2026-11-04.

**Entorno:** `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` dio exit 128 (`Could not resolve host: github.com`); no se ejecutaron clones locales, `pnpm test`, `node docs/revision-pr/analizar.mjs verificacion`, Supabase o Docker. La evidencia del propio agente (397 tests locales) no es control independiente.
