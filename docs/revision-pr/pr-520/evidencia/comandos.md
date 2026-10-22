# Evidencia reproducible — PR #520 / T-411 / Ronda 1

Este documento **no declara pruebas propias ejecutadas**. La conexión GitHub permitió auditar el código y los logs de CI; el contenedor local no puede resolver github.com para crear un clon, y está prohibido levantar Supabase/Docker local.

## Logs exactos observados

- `https://github.com/cadeApp/cadeApp/actions/runs/39814079345/job/119947807622` — SHA `3a33aff`, CC038 RED del harness del autor, GREEN tras restaurar y pgTAP `Files=37 Tests=3131 Result: PASS`.
- `https://github.com/cadeApp/cadeApp/actions/runs/39814079345/job/119947807578` — SHA `3a33aff`, `Test Files 165 passed`, `Tests 3261 passed`.
- `https://github.com/cadeApp/cadeApp/actions/runs/39816084844/job/119954909638` — SHA `d7e1de3`, segundo RED aislado CONFIRMADO: pgTAP 37/3131 PASS seguido de E8 AssertionError, job FAIL.
- Job **119947923443** de primer RED — SHA `744bc70`, `Files=37 Tests=3102 Result: FAIL`; solo 1 aserción de 30 ejecutada en `cc038_publication_plan_code.sql` por helper faltante.

## Verificaciones no destructivas, desde una copia limpia de la rama

```bash
git fetch origin
git status --short
git merge-tree --write-tree origin/develop HEAD
git diff --check origin/develop...HEAD
pnpm typecheck
pnpm lint
pnpm exec vitest run src/domain/cc038-publication-plan-code.test.ts src/features/admin/components/publication-plans-manager.test.tsx src/server/rpc/admin.test.ts
node docs/revision-pr/analizar.mjs verificacion
```

La prueba `pnpm test:db` **no** se ejecuta con Docker local; usar el job `db-tests` del SHA evaluado y leer el resumen `Files=… Tests=… Result:…`.

## Harness independiente propuesto: mutación real de generación de sufijos

El siguiente script es autocontenido y usa un worktree efímero desde un SHA concreto. Lo podés copiar a `/tmp/pr520-check.sh` para ejecutarlo **solo si tenés el repo y dependencias**, sin Docker. Corre GREEN sin mutar, quita el comportamiento de sufijos en el fake temporal, exige RED en el test real y restaura el código **desde memoria**, no con `git checkout`. No se ejecutó desde esta revisión, por lo que no cuenta como evidencia de mutación independiente.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="c8e546c0afe5db7ea9b036e8a732671660bbe6d9"
TMP="$(mktemp -d)"
cleanup() {
  cd "$ROOT"
  git worktree remove --force "$TMP/wt" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$TMP/wt" "$SHA"
cd "$TMP/wt"
pnpm install --frozen-lockfile
TARGET="src/domain/cc038-publication-plan-code.test.ts"
FAKE="src/domain/testing/rpc-fake.ts"
pnpm exec vitest run "$TARGET" > "$TMP/green-before.log" 2>&1
node - <<'NODE'
const fs = require('node:fs');
const path = 'src/domain/testing/rpc-fake.ts';
const original = fs.readFileSync(path,'utf8');
const needle = /const code = nextPublicationPlanCode\(\s*publicationPlanCodeBase\(input\.name\),\s*\[\.\.\.plans\.values\(\)\]\.map\(\(p\) => p\.code\)\s*\);/;
if (!needle.test(original)) throw new Error('Sin objetivo de mutación: FAIL (no cuenta como RED)');
const mutated = original.replace(needle, 'const code = publicationPlanCodeBase(input.name);');
fs.writeFileSync('/tmp/pr520-rpc-fake-original.ts',original);
fs.writeFileSync(path,mutated);
NODE
if pnpm exec vitest run "$TARGET" -t 'el mismo nombre lleva -2 y -3' > "$TMP/red.log" 2>&1; then
  echo "FAIL: mutación pasó en verde"; exit 1
fi
# Diagnóstico: la aserción de sufijos debe ser exactamente el error (no timeout o fallo de setup).
grep -E -e 'AssertionError' -e 'expected.*cc038-basico-20-2' -e 'FAIL ' "$TMP/red.log" > "$TMP/red-summary.log" || { echo "No se puede atribuir el RED"; exit 1; }
node - <<'NODE'
const fs = require('node:fs');
fs.writeFileSync('src/domain/testing/rpc-fake.ts', fs.readFileSync('/tmp/pr520-rpc-fake-original.ts','utf8'));
fs.unlinkSync('/tmp/pr520-rpc-fake-original.ts');
NODE
pnpm exec vitest run "$TARGET" > "$TMP/green-after.log" 2>&1
grep -E -e 'Test Files' -e 'Tests' "$TMP/green-before.log" "$TMP/red.log" "$TMP/green-after.log" || true
```

> El harness es una propuesta para una ejecución independiente, no una salida obtenida. En una ejecución real hay que endurecer la atribución del RED leyendo la aserción concreta: el texto de resumen no alcanza. Tampoco modificar las expectativas del test.

## Prueba E8 mutante de CI

- En rama aislada `review/T-411-red` el commit `d7e1de3` elimina `perform pg_advisory_xact_lock(hashtext('cc038:publication-plan-code'))` de la función sin alterar las aserciones.
- Inspeccionado el log `119954909638`: escenario `E8 altas de plan con el mismo nombre` en RED con aserción `las dos altas responden sin error`; las 37 suites pgTAP pasan y el job falla al ejecutar E8.
- PR #521 ya cerrada sin mergear; nunca traer el SQL mutado a `develop` o `feat/T-411-plan-code`.

## Archivos locales de esta revisión

No se corrió ni se dejó un worktree local: estas evidencias provienen de GitHub y la inspección de los diffs. No imprimir ni abrir `.env*`, credenciales ni tokens.
