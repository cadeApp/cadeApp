# Evidencia R2 — PR #384 / T-357 — 2026-10-16

**Código:** `fddaca33a97445290aba2cb3f0f1feac5500aa43`, base `cc7fb54b`. No hubo clon ejecutable local; la CI de GitHub ejecutó tests en ese HEAD. No se ejecutó Supabase/Docker local ni se modificó remoto. La mutación propia se limita a análisis estático en memoria.

## Comprobaciones y jobs

- `git merge-tree --write-tree` **no se ejecutó en local**; se usó merge de 3 vías en memoria contra el ancestro real y merge commit de dos padres. GitHub: `mergeable=true` y `behind=0` contra develop.
- Job unit SHA fddaca33: `Test Files 136 passed (136)`; `Tests 2494 passed (2494)`, según su log real. No repetir estos valores para SHA futuro.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, audit y bundle-budget de la CI resultaron en PASS.
- DB-test y E2E Preview: pendientes al cerrar la evidencia; no inventar resultados.

## Harness estructural del revisor — reproducible y sin escritura

El control comprueba presencia de guardas y que mutaciones dirigidas borren la coincidencia. **ATENCIÓN: es estático, no una ejecución real del flujo**. No usar para marcar `verificado_en_sha`.

```bash
cat > /tmp/pr384-r2-static.cjs <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const action = fs.readFileSync('src/features/courier-onboarding/actions.ts', 'utf8').split('export async function updateCourierVehicleAction(')[1];
const schema = fs.readFileSync('src/features/courier-onboarding/schemas.ts', 'utf8');
const form = fs.readFileSync('src/features/courier-onboarding/components/vehicle-form.tsx', 'utf8');
const page = fs.readFileSync('src/app/(courier)/courier/onboarding/vehicle/page.tsx', 'utf8');
assert(action, 'Action missing');
const cases = [
  ['marker', action, 'existingCourier.vehicle_type === null', 'existingCourier.vehicle_type == "__never__"'],
  ['status', action, "['pending', 'approved'].includes(existingCourier.status)", "['rejected', 'suspended'].includes(existingCourier.status)"],
  ['marker-update', action, ".not('vehicle_type', 'is', null)", ''],
  ['status-update', action, ".in('status', ['pending', 'approved'])", ''],
  ['affected-row', action, '!updatedCourier || updatedCourier.profile_id !== user.id', 'false'],
  ['db-error', page, 'if (courierError) {', 'if (false) {'],
  ['route-guard', page, 'const isEditing = Boolean(courier?.vehicle_type);', 'const isEditing = true;'],
  ['schema-strict', schema, '  .strict()\n  .superRefine', '  .superRefine'],
  ['docs-UI', form, '{!isEditing && <section className="flex flex-col gap-3">', '{true && <section className="flex flex-col gap-3">'],
  ['no-doc-upsert', action, '  // 6. Actualización de vehículo en couriers', '  // 5. Inserción de documentos opcionales si fueron provistos'],
];
for (const [name, source, needle, replacement] of cases) {
  assert.equal(source.split(needle).length-1, 1, 'GREEN original failed / ambiguous ' + name);
  const mutated = source.replace(needle, replacement);
  assert(!mutated.includes(needle), 'mutation not detected ' + name);
  console.log('GREEN original => RED static mutant: ' + name);
}
console.log('10/10 STATIC probes; not tests of runtime, permission or persistence');
NODE
node /tmp/pr384-r2-static.cjs
```

**Observación real:** se ejecutaron 10 mutaciones estructurales sobre código leído de GitHub y 10/10 fueron detectadas. El harness de arriba permite reproducir la misma comprobación en un checkout del SHA original.

## Runtime todavía exigible antes de merge

```bash
git fetch origin
git rev-parse HEAD
git ls-remote origin feat/T-357-actualizar-vehiculo-perfil
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/courier-onboarding/actions.test.ts
pnpm exec vitest run src/features/courier-onboarding/schemas.test.ts
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx
pnpm exec vitest run "src/app/(courier)/courier/onboarding/vehicle/page.test.tsx"
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node docs/revision-pr/analizar.mjs verificacion
```

E2E Preview debe correr en el entorno dispuesto por el proyecto; usar run/resultado real y fixture segregada. Faltan los casos del DoD detallados en R2-H04. El agy no debe escribir `docs/revision-pr/**` ni saltar pruebas.
