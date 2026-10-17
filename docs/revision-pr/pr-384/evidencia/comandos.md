# Evidencia reproducible — PR #384 · T-357 · Ronda independiente 1

**Código inspeccionado:** `d7347c9f1e37d6c6c350389228f88a9aa6c25722`. Todas las referencias son al árbol anterior al commit de revisión. Los archivos del autor no se modificaron durante estas comprobaciones.

## Resultados observados, sin extrapolación

1. CI de `07966a2`: `build` FAIL por `Type 'PageProps | undefined' does not satisfy constraint 'PageProps'`, pero `typecheck`, `lint` y `unit` PASS.
2. CI de `07966a2`: job `db-tests` PASS, `Files=26, Tests=2341, Result: PASS`, y verificación `git diff --exit-code -- src/types/database.types.ts` terminada correctamente. No hubo tests SQL específicos añadidos por T-357.
3. El siguiente SHA de código `1abebcd` modificó sobrecargas de `page.tsx` y el job `build` resultó **success**. No se considera bloqueante el error anterior. Su `unit` y `db-tests` figuraban **cancelled** por el avance de la rama.
4. SHA `d7347c9` modifica solo `docs/tasks/log/T-357.md`; el código funcional coincide con `1abebcd`. `approval-policy` del SHA `1abebcd` falla por falta de aprobación de Lautaro073, no por un test funcional.
5. No se ejecutó E2E Preview verde de T-357 ni `git merge-tree` local en esta revisión; no inventar evidencia.

Links CI:
- https://github.com/cadeApp/cadeApp/actions/runs/38947674739 (07966a2)
- https://github.com/cadeApp/cadeApp/actions/runs/38949506203 (1abebcd)

## Harness independiente de mutación estática, COMPLETO

Ejecutar desde raíz del repositorio al SHA revisado (o copiar el bloque a `/tmp/pr384-static-mutations.cjs` y ejecutar `node /tmp/pr384-static-mutations.cjs` estando en la raíz). El script **no escribe en el árbol**, aplica mutaciones en memoria y no necesita dependencias:

```bash
cat > /tmp/pr384-static-mutations.cjs <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/features/courier-onboarding/actions.ts', 'utf8');
const marker = 'export async function updateCourierVehicleAction(';
assert(source.includes(marker), 'Falta la action a verificar');
const action = source.slice(source.indexOf(marker));
function controls(s) {
  return {
    auth: /if\s*\(userError\s*\|\|\s*!user\)/.test(s),
    role: /roleParsed\.data\s*!==\s*'courier'/.test(s),
    owner: /\.update\(courierUpdatePayload as never\)\s*\.eq\('profile_id', user\.id\)/.test(s),
    schema: /courierUpdateVehicleSchema\.safeParse\(input\)/.test(s),
    redirect: /redirectTo:\s*'\/courier\/profile'/.test(s),
  };
}
const base = controls(action);
assert(Object.values(base).every(Boolean), 'GREEN original falló');
console.log('GREEN original: 5/5 controles estáticos');
const cases = [
  ['auth OR -> AND', 'userError || !user', 'userError && !user', 'auth'],
  ['rol negado -> invertido', "roleParsed.data !== 'courier'", "roleParsed.data === 'courier'", 'role'],
  ['retirar filtro por dueño', ".update(courierUpdatePayload as never)\n    .eq('profile_id', user.id)", ".update(courierUpdatePayload as never)", 'owner'],
  ['eliminar validación especializada', 'courierUpdateVehicleSchema.safeParse(input)', 'courierOnboardingSchema.safeParse(input)', 'schema'],
  ['redirigir a onboarding', "redirectTo: '/courier/profile'", "redirectTo: '/onboarding/status'", 'redirect'],
];
for (const [name,needle,replacement,assertion] of cases) {
  assert(action.includes(needle), 'Mutación sin objetivo: ' + name);
  const mutant = action.replace(needle, replacement);
  assert.notEqual(mutant, action, 'Mutación no aplicada: ' + name);
  const failed = !controls(mutant)[assertion];
  assert(failed, 'MUTACIÓN CIEGA: ' + name);
  console.log('RED mutante: ' + name + ' (aserción ' + assertion + ')');
}
console.log('Resultado: 5 mutaciones detectadas; NOTA: instrumento ESTÁTICO, no Vitest/PG/E2E');
NODE
node /tmp/pr384-static-mutations.cjs
```

**Resultado de ejecución equivalente del revisor sobre contenido devuelto por GitHub en `1abebcd`** (mismo código en `d7347c9`):
- `GREEN original: 5/5` (auth, role, owner, schema, redirect).
- `RED mutante: 5/5`: OR→AND (auth), invertir courier (role), retirar filtro (owner), quitar schema (schema), redirección equivocada (redirect).
- Esto demuestra sensibilidad **del analizador estático**. No demuestra por sí solo los hallazgos funcionales H01-H05 ni constituye la evidencia RED→GREEN runtime del DoD. No atribuirle esas pruebas.

## Invariantes aún NO defendidos por tests del autor

- `updateCourierVehicleAction` debe rechazar vehículo inicial nulo **sin cambios**.
- El payload de edición con `documents` no puede mutar `courier_documents` ni aceptar paths arbitrarios.
- UPDATE sin fila devuelta no puede retornar `ok`.
- Fallo SQL de lectura de vehículo no equivale a onboarding incompleto.
- E2E con seed verificado, refresh y comprobación real de persistencia, con 4 modalidades y consulta desde perfil/viaje.
- No hay evidencia reproducible de 10 RED iniciales de action + 6 form + 2 page: la bitácora los enumera pero no provee commits de tests RED o logs de esa fase. **No se reejecutaron aquí**.

## Comandos para próxima ronda, solo tras arreglo

```bash
git fetch origin
git rev-parse HEAD
git ls-remote origin feat/T-357-actualizar-vehiculo-perfil
git diff origin/develop...HEAD --stat
git merge-tree --write-tree origin/develop HEAD
node /tmp/pr384-static-mutations.cjs
pnpm exec vitest run src/features/courier-onboarding/actions.test.ts
pnpm exec vitest run src/features/courier-onboarding/schemas.test.ts
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx
pnpm exec vitest run "src/app/(courier)/courier/onboarding/vehicle/page.test.tsx"
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node docs/revision-pr/analizar.mjs verificacion
```

Para E2E se usa la infraestructura Preview / Supabase Develop y fixtures segregados; **no** iniciar Docker/Supabase local ni lanzar workflows manuales sin autorización. E2E solo se acredita con identificador de run y resultado real posterior al SHA del arreglo.

## Alcance de la revisión

Limitada a lectura de GitHub/CI, inspección de SQL/contratos y cinco mutaciones estáticas independientes. No se dispone de checkout local del proyecto en este entorno. Todas las afirmaciones de SQL son **por inspección**, respaldadas por CI `db-tests` preexistente; ninguna mutación de SQL/RLS ejecutada. En la próxima ronda, el revisor debe sumar **mutaciones runtime propias**.
