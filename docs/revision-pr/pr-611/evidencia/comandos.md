# Evidencia independiente — PR #611 / T-422 · Ronda 1

**SHA revisado:** `229a3d06c81a11b45a207a17f94d572eece41afc` · **Fecha:** 2026-11-05.

## Comprobaciones de procedencia

- Diff GitHub: un archivo `docs/tasks/log/T-422.md`, dos bloques nuevos, +19/-0, comparación contra `develop` con 2 commits adelante, 0 atrás. La ficha `docs/tasks/T-422.md` se leyó desde develop, no desde la rama.
- Run E2E: https://github.com/cadeApp/cadeApp/actions/runs/42075421860, job `127414325335`. Checkout y fetch de `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`. El log muestra `116 passed (32.6m)`, `6 passed (2.5m)` y `announcements.spec.ts:67` aprobado; job `127435190705` registra `TARGET_SHA=95f95eed...` para el commit status. Todos los tres jobs en `success`.
- CI del SHA de código: https://github.com/cadeApp/cadeApp/actions/runs/42073826935; los siete jobs son SUCCESS. Resumen de Vitest: 193 archivos y 3568 tests; workflows 85/85; db-tests `Files=42, Tests=3396, Result: PASS` y paso `git diff --exit-code` satisfactorio.
- #611 (SHA documental): CI run 42100320134 `cancelled` y `approval-policy` falló antes de publicar el informe. No atribuir este resultado a la corrida exitosa de #613.
- Vercel: el comentario de `vercel[bot]` en #611 registra `Ignored` para la rama `docs/T-422-cierre`. El valor completo de Ignored Build Step fue declarado por el autor, **no comprobado por esta revisión**; D01=A lo acepta con esta limitación.

## Contrato documental y seis mutaciones independientes

Copiá **todo** el bloque a `/tmp/pr611-doc-review.mjs` y ejecutá en un checkout que contenga el archivo del SHA `229a3d06` (o su descendiente sin alterar la bitácora). Se valida primero el documento original (GREEN); luego seis mutaciones en memoria deben ser rechazadas (RED). El script no ejecuta red, no lee secretos, no modifica el árbol ni usa tests del autor.

```bash
cat > /tmp/pr611-doc-review.mjs <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.cwd();
const source = readFileSync(join(root, "docs/tasks/log/T-422.md"), "utf8");
const tick = String.fromCharCode(96);
const q = (value) => tick + value + tick;
const SESSION_4 = "## 2026-11-05 — Sesión 4 (Lautaro073, agente): primera corrida del gate nuevo";
const SESSION_7 = "## 2026-11-05 — Sesión 7 (Lautaro073, agente): primer GREEN del gate nuevo y Vercel solo en develop";
const VERCEL = "[ \"$VERCEL_GIT_COMMIT_REF\" = develop ] && exit 1 || exit 0";

function control(s) {
  assert.equal(s.split(SESSION_4).length, 2, "sesión 4 ausente o duplicada");
  assert.equal(s.split(SESSION_7).length, 2, "sesión 7 ausente o duplicada");
  const block = s.split(SESSION_7)[1].split("\n## ")[0];
  const claims = [
    "run 42075421860 sobre " + q("95f95eed"),
    q("chromium") + " 116 passed",
    q("global-settings") + " 6 passed",
    q("announcements.spec.ts:67") + " al primer intento",
    VERCEL,
    "verificado\n  recargando la página",
  ];
  for (const claim of claims) assert.ok(block.includes(claim), "falta en sesión 7: " + claim);
}

function red(label, target, replacement) {
  assert.ok(source.includes(target), label + ": mutación sin objetivo");
  const mutant = source.replace(target, replacement);
  assert.notEqual(mutant, source, label + ": no cambió");
  assert.throws(() => control(mutant), undefined, label + ": control ciego");
  console.log(label + ": RED (rechazada)");
}
control(source);
console.log("CONTROL: GREEN (documentación del SHA revisado)");
red("M1 corrida incorrecta", "run 42075421860 sobre " + q("95f95eed"), "run 42075421861 sobre " + q("95f95eed"));
red("M2 SHA incorrecto", "run 42075421860 sobre " + q("95f95eed"), "run 42075421860 sobre " + q("034567bc"));
red("M3 Chromium 115", q("chromium") + " 116 passed", q("chromium") + " 115 passed");
red("M4 global-settings 5", q("global-settings") + " 6 passed", q("global-settings") + " 5 passed");
red("M5 condición Vercel invertida", VERCEL, VERCEL.replace(" = develop ", " != develop "));
red("M6 sesión 4 ausente", SESSION_4, SESSION_4.replace("Sesión 4", "Sesión cuarta"));
console.log("FIN: 6/6 mutaciones detectadas; árbol de trabajo inalterado");
NODE
node /tmp/pr611-doc-review.mjs "$PWD"
```

**Ejecución en esta revisión:** se aplicó exactamente el mismo contrato lógico sobre el contenido íntegro del archivo recuperado vía conector de GitHub en el SHA indicado. Resultado:

```text
CONTROL: GREEN (documentación del SHA revisado)
M1 corrida incorrecta: RED (rechazada)
M2 SHA incorrecto: RED (rechazada)
M3 Chromium 115: RED (rechazada)
M4 global-settings 5: RED (rechazada)
M5 condición Vercel invertida: RED (rechazada)
M6 sesión 4 ausente: RED (rechazada)
FIN: 6/6 mutaciones detectadas; árbol de trabajo inalterado
```

**Límite:** estos controles son aserciones documentales sobre cifras y texto. No se ejecutó Playwright por parte del revisor ni se mutó un workflow en un checkout local. La prueba de funcionamiento real procede de GitHub Actions y se atribuye a su SHA exacto. El acceso `git ls-remote` desde el contenedor falló por DNS (`Could not resolve host: github.com`), por lo cual no se corrieron typecheck/lint/test ni merge-tree localmente.

## Comandos de comprobación para un checkout limpio

```bash
git fetch origin
git diff origin/develop...229a3d06c81a11b45a207a17f94d572eece41afc --stat
git diff origin/develop...229a3d06c81a11b45a207a17f94d572eece41afc -- docs/tasks/log/T-422.md
git merge-tree --write-tree origin/develop 229a3d06c81a11b45a207a17f94d572eece41afc
node /tmp/pr611-doc-review.mjs "$PWD"
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git status --short
```

No levantar Docker/Supabase local, no leer `.env*`, no modificar secretos ni disparar workflows. La revisión commitea solo `docs/revision-pr/pr-611/`.
