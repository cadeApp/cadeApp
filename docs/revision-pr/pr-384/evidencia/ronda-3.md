# Evidencia R3 — PR #384 / T-357 (SHA `e873539624dbb454f987df5a1e9014baece825d3`)

## Ejecuciones verificadas directamente por la revisión

- CI: https://github.com/cadeApp/cadeApp/actions/runs/38994401631 — SUCCESS.
- Job unit `117283805471`: `Test Files 136 passed (136)`, `Tests 2527 passed (2527)`.
- Job DB `117283805550`: `Files=26, Tests=2341`, `Result: PASS`; la suite global también ejecuta mutaciones de otras tareas que tienen RED intencional. El éxito es del job global, no prueba específica de T-357.
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/38994460490 ; job `117283860571` concluyó SUCCESS; en el log `T-357: Flujo completo...` (28.1 s) y `T-357: E2E negativo...` (13.6 s) ambos llevan ✓; resumen `82 passed (18.8m)` y `3 passed (53.0s)`.
- Vercel `e8735396`: SUCCESS; commit status `e2e-preview: success`.
- Comparación: desde `bf1577e4` cuatro commits y cuatro archivos cambiados, todos permitidos. GitHub `mergeable_state=clean`; `develop` avanzó un commit ajeno (`cf65ce25`).
- No se leyó ni ejecutó secreto, Supabase remoto, Docker local ni pruebas contra producción.
- No había checkout Git completo disponible para ejecutar `pnpm`, `git merge-tree` ni los tests de mutación runtime de manera independiente. Eso queda **sin verificar**, no se presenta como PASS.

## Mutaciones estructurales PROPIAS de la revisión (independientes del autor)

Este harness es reproducible desde un checkout de `e8735396`. Es solo una comprobación **textual** de aserciones; no muta ni ejecuta el navegador ni prueba el comportamiento. Se ejecutó una comparación equivalente en memoria sobre el archivo devuelto por GitHub con **7/7 aserciones originales detectadas y 7/7 mutantes estructurales rojos**.

```bash
cat > /tmp/pr384-r3-static.cjs <<'NODE'
const fs=require('node:fs');
const assert=require('node:assert/strict');
const full=fs.readFileSync('e2e/specs/courier-onboarding.spec.ts','utf8');
const token="test('T-357: Flujo completo de actualización";
assert(full.includes(token),'no está el caso a auditar');
const src=full.slice(full.indexOf(token));
const cases=[
  ['recargas','await page.reload();',3],
  ['documentos sin mutación','expect(finalDocs).toEqual(initialDocs);',1],
  ['query edit adversarial',"await page.goto('/courier/onboarding/vehicle?mode=edit');",1],
  ['marca de alta nula','expect(courierRow?.vehicle_type).toBeNull();',1],
  ['persistencia car','expect(carPersisted).toMatchObject({',1],
  ['persistencia bike','expect(bikePersisted).toMatchObject({',1],
  ['persistencia walk','expect(walkPersisted).toMatchObject({',1],
];
function count(s,needle){return s.split(needle).length-1}
for(const [name,needle,min] of cases){
  assert(count(src,needle)>=min,'GREEN ORIGINAL FAIL: '+name);
  const mutant=src.replaceAll(needle,'/* removed on purpose */');
  assert(count(mutant,needle)<min,'RED NO DETECTADO: '+name);
  console.log('GREEN original / RED static mutant: '+name);
}
console.log('7/7 STATIC ONLY — not browser/runtime mutation');
NODE
node /tmp/pr384-r3-static.cjs
```

## Pruebas faltantes de verdad

**No hay evidencia de ejecución real** (RED/ GREEN) del mismo test bajo estos mutantes y no deben confundirse con `7/7` textual:
1. Omisión real de `updateCourierVehicleAction` guard `vehicle_type` → test de sesión courier incompleto debe FALLAR.
2. Sustitución de `couriers.update` por no-op `error:null,data:null` → test de persistencia debe FALLAR.
3. Acción con usuario A intentando modificar B → B mantiene tipo/patente; prueba server real, no solo `.eq` mock.
4. Quitar proyección `vehicle_type`/`vehicle_plate` de `get_trip_details` (solo test aislado seguro) → vista de viaje del comercio debe FALLAR.
5. Eliminar `page.reload()` o anular actualización real → el E2E del viaje debe FALLAR con oráculo DB no manipulado.

E2E mutations de seguridad: solo mecanismo `e2e-mutation` del proyecto, no push temporal de código vulnerable a Preview. Ejecutar localmente en un worktree aislado y revertir cambios únicamente en memoria. Si no es posible, registrar limitación sin declarar verificado.

## Comandos para siguiente ronda

```bash
git fetch origin
git rev-parse HEAD
git ls-remote origin feat/T-357-actualizar-vehiculo-perfil
git merge-tree --write-tree origin/develop HEAD
node /tmp/pr384-r3-static.cjs
pnpm exec vitest run src/features/courier-onboarding/actions.test.ts
pnpm exec vitest run src/features/courier-onboarding/schemas.test.ts
pnpm exec playwright test e2e/specs/courier-onboarding.spec.ts --project=chromium
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git diff --check
node docs/revision-pr/analizar.mjs verificacion
```

La ejecución E2E debe usar exclusivamente el mecanismo Preview+Supabase Develop administrado por la CI, **no** disparar pipelines a mano. `playwright` local requiere credenciales de fixture existentes en entorno autorizado; no escribir secretos ni trasladar datos.
