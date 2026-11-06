# PR #624 R1 — evidencia, comandos y límites

SHA revisado: 2c6ae940a0215886b8567e64609aad866570027c. Base develop: b5ceef11e4f227d87f438ff7d686e9355a6daac9.

## Evidencia existente observada por el revisor

- GitHub Actions https://github.com/cadeApp/cadeApp/actions/runs/42247329813: lint ✅, typecheck ✅, unit ✅ (195 files, 3665 tests), db-tests ✅ (43 files, 3545 tests; Result: PASS), build ✅, audit ✅, bundle-budget ✅. Logs: Job unit 127992869973, Job db-tests 127992869997. Al terminar db-tests aparece git diff --exit-code -- src/types/database.types.ts.
- PR aisladas del autor #625 no-migration, #626 no-reflection, #627 no-switch-block, #628 no-frozen-columns, todas cerradas sin merge. **No fueron reejecutadas de forma independiente**.
- La bitácora reporta U1–U8 RED unitarios. No se contó como reproducción independiente.
- No se corrió ningún comando contra Supabase remoto, no se levantó Docker ni se dispararon workflows.
- E2E no ejecutado: BLOCKED / REQUIRES DEVELOP MIGRATION. El E2E se hará contra develop tras migrate-develop, no se inventa un resultado.
- Clon y herramientas Git no disponibles en la misma máquina de ejecución que el conector GitHub; no se corrieron localmente pnpm, merge-tree ni git diff. Comparación equivalente de ficha por parche API de GitHub y estado mergeable=true, no sustituyen un merge-tree real.

## Comandos de CI a reproducir cuando se disponga de un worktree limpio

~~~bash
git fetch origin
git diff origin/develop -- docs/tasks/T-419.md
git diff --check origin/develop...origin/feat/T-419-vehiculos
git merge-tree --write-tree origin/develop origin/feat/T-419-vehiculos
pnpm typecheck
pnpm lint
pnpm test > /tmp/pr624-unit.log 2>&1
grep -E 'Test Files|Tests |All files' /tmp/pr624-unit.log | tail -8
node docs/revision-pr/analizar.mjs verificacion
~~~

No ejecutar pnpm test:db ni Docker/Supabase local por la regla de la revisión. La batería de pgTAP la ejecuta db-tests en CI. No disparar manualmente workflows.

## Oráculos SQL nuevos (diseño, **NO ejecutados en esta revisión**)

Los escenarios deben incorporarse al pgTAP de CC-042 y ser comprobados en RED con mutaciones locales temporales **en memoria** o en PR aislada REVIEW ONLY que no se mergea. No reescribir el test para obtener un RED.

- H01: postulación no enviada con license e insurance actuales submitted; finalize → ambos estados submitted en courier_vehicles y couriers, doc_level según activo. Mutar el cálculo de estados y reemplazarlo por valores viejos de couriers => RED.
- H02: legacy_bike con license_status en couriers verified, backfill → bici y reflejo none, doc_level 0, fila histórica aún presente. Mutar eliminación de la normalización de reflejo => RED.
- H03: finalize moto, guardar submitted_at; add bike + set_active; repetir finalize moto/patente original => idempotent=true, submitted_at idéntico y activo continúa bike. Tipo, patente o DNI originales distintos → INVALID_STATE_TRANSITION. Editar la patente de moto después y verificar mismo resultado. Mutar comparación del snapshot por el reflejo => RED. Mutar trigger/guard del snapshot => RED ante UPDATE directo.
- H04: para add_courier_optional_document y replace_courier_document: misma idempotencyKey+storagePath en moto y después en auto, mismo actor → VALIDATION_ERROR, sin tocar documento del auto ni de la moto. Mismos valores en misma moto → idempotent=true. Mutar comparación vehicle_id => RED.
- H05: con bike activa, licencia histórica is_current=true y vehicle_id=null no debe salir en perfil ni status; con active_vehicle_id=null (onboarding inicial), conservar compatibilidad de documento sin asociar; DNI siempre visible. Mutar a !row.vehicle_id => RED.
- H06: interrupción después de activar bici y antes de withdraw: la limpieza debe retirar oferta si existe, reactivar moto y borrar bici; el guard no debe impedir limpieza. Test aislado con el mismo error original preservado. No correr contra develop sin migración.
- H07: mismo tipo y misma patente en vehículos con IDs distintos (uno archivado): no unir historiales en admin.

## Sonda de mutaciones independiente de texto (harness completo, NO prueba semántica de PostgreSQL)

El siguiente script es una comprobación **estructural** y no sustituye los RED pgTAP. Toma el SQL del repositorio y perturba dos guardas de propiedades que SÍ están presentes. El fixture no se modifica; las mutaciones quedan en memoria. Copiar el bloque completo como script a /tmp y ejecutarlo desde la raíz del repo con node. No atribuir a este instrumento la verificación de H01–H07.

~~~bash
cat > /tmp/pr624-structural-probe.mjs <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file = process.argv[2];
assert.ok(file, 'usage: node /tmp/pr624-structural-probe.mjs <migration.sql>');
const source = fs.readFileSync(file, 'utf8');
function scope(begin, end) {
  const i = source.indexOf(begin);
  const j = source.indexOf(end, i + begin.length);
  assert.ok(i >= 0 && j > i, 'no se pudo aislar SQL: ' + begin);
  return source.slice(i, j);
}
function mutateAndCatch(label, original, needle, replacement) {
  assert.ok(original.includes(needle), label + ': guard baseline no encontrado');
  console.log('GREEN estructural ' + label + ': guard presente');
  const mutated = original.replace(needle, replacement);
  assert.notEqual(mutated, original, label + ': la mutación no impactó');
  assert.ok(!mutated.includes(needle), label + ': mutación no removió guarda');
  console.log('RED estructural ' + label + ': mutación detectada (solo texto)');
}
const switching = scope('create or replace function public.set_active_courier_vehicle', '-- ============================================================================\n-- 7. Documentos');
mutateAndCatch('M1 bloqueo del cambio activo', switching,
  'if app_private.cc042_vehicle_switch_blocked(v_actor) then', 'if false then');
const policy = scope('create policy couriers_update_self', '-- ============================================================================\n-- 4. Backfill');
mutateAndCatch('M2 columna active_vehicle_id congelada', policy,
  'and active_vehicle_id is not distinct from (select c.active_vehicle_id from public.couriers c where c.profile_id = auth.uid())',
  '-- MUTACION: sin comparacion de active_vehicle_id');
JS
node /tmp/pr624-structural-probe.mjs supabase/migrations/20261106120000_cc042_courier_vehicles.sql
~~~

La sonda NO se ejecutó sobre el checkout del SHA en esta sesión. Antes de reportar que se ejecutó, el futuro revisor debe correrla y comprobar que también falla correctamente si la guarda se elimina. Los RED semánticos nuevos continúan pendientes de CI/db-tests o de ejecución que Lautaro073 autorice.

## Validación documental

El script docs/revision-pr/analizar.mjs verificacion se debe ejecutar en el worktree con la carpeta ya descargada. No marcar arreglado-verificado desde la bitácora del autor. En hallazgos.jsonl cada verificado_en_sha = null mientras el revisor no ejecute la comprobación independiente.
