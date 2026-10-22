# Evidencia reproducible — PR #510 · Ronda 1

**Código inspeccionado:** `2270c2f47a2e3fa1e04d159338236771ae73c179`. **Commits documentales posteriores:** `017da834` y el commit propio de esta carpeta.

## Lo que se comprobó (CI remoto)

- CI: https://github.com/cadeApp/cadeApp/actions/runs/39732982955 (SHA `2270c2f47a2e3fa1e04d159338236771ae73c179`).
- `unit` job 119672045460: **164** suites y **3239** tests pasan, pero `src/domain/testing/rpc-fake.ts` branches **88.08 %** contra **90 %**; exit 1.
- `db-tests` job 119672045324: `cc037_admin_list_trips.sql ... ok`, `Files=36`, `Tests=3101`, `Result: PASS`; verificar también `git diff --exit-code -- src/types/database.types.ts` del log.
- RED del autor contrastado: PR aislada #511, run 39729848417, job 119662128006: sin la migración, la RPC `admin_list_trips` no existe; `Files=36`, `Tests=3057`, `Result: FAIL`.
- **No ejecutado por el revisor:** tests/mutaciones en clon local, comparación git merge-tree. Intento de conexión de GitHub desde el contenedor: `Could not resolve host: github.com`. Ningún RED de H02/H03 se presenta como confirmado.

## Comandos de línea base (en clon limpio; no ejecutados aquí)

```bash
git fetch origin
git switch feat/T-410-admin-trips
git pull --ff-only origin feat/T-410-admin-trips
git status --short
pnpm typecheck && pnpm lint && pnpm test
pnpm test:coverage
node docs/revision-pr/analizar.mjs verificacion
```

## Mutaciones negativas independientes que debe ejecutar el agy

1. **H01-M1:** hacer que `admin_list_trips` del fake deje de reconocer `row.failedDrops > 0`; test nuevo de `problems` con failed drop debe ser RED. Restaurar y GREEN.
2. **H01-M2:** alterar la comparación de cursor de `admin_list_trips`; test de empate `createdAt/id` debe ser RED; restaurar y GREEN.
3. **H02-M1:** volver temporalmente al render `trip.drops.length === 0 ? null`; test nuevo con legacy `drops=[]`, `delivered`, debe ser RED; restaurar y GREEN.
4. **H03-M1:** quitar de la lectura de drops la condición `.eq('request_id', requestId)`; test de aislamiento/filtros debe ser RED; restaurar y GREEN.

No cambiar expectations, inventar asserts tautológicos, usar `.skip`, introducir `if(test)`, excluir del coverage o cambiar umbrales. Scripts auxiliares bajo `/tmp` y mutaciones revertidas **desde copia en memoria**, sin `git checkout`; nunca commitear mutantes. Guardar resúmenes RED y GREEN por comando y SHA.

### Harness completo de anclajes (in-memory, no sustituye tests RED)

Copiar exactamente a `/tmp/pr510-mutation-anchors.mjs` y ejecutar `node /tmp/pr510-mutation-anchors.mjs` desde la raíz del repositorio. No escribe archivos; verifica que cada mutación encuentra el código objetivo. **No ejecutado en esta ronda**.

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
const variants = [
  ['src/domain/testing/rpc-fake.ts', 'row.failedDrops > 0', 'false'],
  ['src/features/admin-trips/components/admin-trip-detail.tsx', 'trip.drops.length === 0 ? null', 'false ? null'],
  ['src/features/admin-trips/queries.ts', ".eq('request_id', requestId)", ''],
];
for (const [filename, needle, replacement] of variants) {
  const source = fs.readFileSync(filename, 'utf8');
  assert.ok(source.includes(needle), 'Anclaje ausente: ' + filename);
  assert.notEqual(source.replace(needle, replacement), source);
  assert.equal(fs.readFileSync(filename, 'utf8'), source);
  process.stdout.write('ANCHOR OK: ' + filename + '\n');
}
```

El harness anterior solo verifica anclajes: hay que ejecutar las suites de test de verdad con el mutante temporal y guardarlo en evidencia del agy.

## Verificación posterior a los arreglos

```bash
pnpm exec vitest run src/domain/cc037-admin-list-trips.test.ts src/features/admin-trips/queries.test.ts src/features/admin-trips/components.test.tsx
pnpm test:coverage
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git ls-remote origin feat/T-410-admin-trips
```

Revisar `db-tests` del SHA nuevo por log; **no levantar Supabase/Docker local**. E2E real queda pendiente de `migrate-develop`, antes de promover (decisión expresa en T-410).

---

## Ronda 2 · HEAD `99ab7a8361be54e551a5986d18d4b865b878d86a`

- Consulta GitHub CI run 39737258624; `unit` job 119686111134 **success**, `Test Files 164 passed`, `Tests 3254 passed`, `rpc-fake.ts` branches **90.96 %**. La bitácora había informado 3251 en una corrida previa; el CI del HEAD revisado ejecutó 3254.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success en ese run. `db-tests` job 119686110835: seguía in_progress en la consulta. `approval-policy` falló con `Falta el informe completo de revisar-pr sin bloqueantes` y se subsana publicando esta revisión.
- Análisis directo de `cc037-admin-list-trips.test.ts`, `components/admin-trip-detail.tsx`, `problems.ts`, `problems.test.ts`, `components.test.tsx`, `queries.test.ts` y `queries.ts` en `99ab7a83` confirma el diseño de los controles para H01–H03.
- La bitácora del autor documenta las mutaciones M6–M15, pero **el revisor no las ejecutó**. `git ls-remote` desde el contenedor devuelve `Could not resolve host: github.com`. No inventar RED ni green local.
- `mergeable=true` es un dato reportado por GitHub, no sustituto de `git merge-tree --write-tree` local.

### Revalidación independiente posible en clon (NO ejecutada en esta revisión)

```bash
git fetch origin
git worktree add /tmp/pr510-99ab 99ab7a8361be54e551a5986d18d4b865b878d86a
cd /tmp/pr510-99ab
pnpm install --frozen-lockfile
pnpm exec vitest run src/domain/cc037-admin-list-trips.test.ts src/features/admin-trips/components.test.tsx src/features/admin-trips/queries.test.ts src/features/admin-trips/problems.test.ts
pnpm test:coverage
node docs/revision-pr/analizar.mjs verificacion
```

El revisor no exigirá un nuevo CI completo solo por este commit documental. Para mutaciones RED independientes usar copia temporal en memoria y corroborar la falla de las aserciones, no de imports, luego restaurar; no tocar Docker ni Supabase remoto.

### Confirmación posterior al informe inicial (mismo SHA)

- CI `db-tests` run `39737258624`, job `119686110835` **success** sobre `99ab7a83`.
- Log: `supabase/tests/cc037_admin_list_trips.sql ... ok`, `Files=36, Tests=3101`, `Result: PASS`; paso `git diff --exit-code -- src/types/database.types.ts` ejecutado sin diferencias, exit 0. El job volvió a correr la suite al final y mantuvo PASS.
- El estado `in_progress` anotado arriba fue una lectura intermedia de la misma ejecución, no un fallo ni un resultado final distinto.
