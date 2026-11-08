# Evidencia y comandos reproducibles — PR #491 / T-312 / R1

**SHA revisado:** `3b6810858ead3c7a22b3d365437fb85edd9419b7` · **Fecha:** 2026-11-07.

## Revisión del cambio y sus límites

- Fuente: API de GitHub (archivos completos del SHA indicado, diff, metadata y logs de CI). No hubo clon Git local disponible en este entorno; no se ejecutaron tests locales ni `git merge-tree`.
- `compare develop...3b681085`: ahead 6, behind 0; solo `docs/runbooks/release.md` y `docs/tasks/log/T-312.md`, ambos permitidos por ficha de develop. Metadata PR: mergeable=true.
- `docs/revision-pr/pr-491/README.md` no existía al empezar la revisión (404 en SHA base).
- `health-cron.yml` usa `environment: production` y `APP_URL: https://cadeapp.online`. `migrate.yml` comprueba `GITHUB_ACTOR`; `deploy.yml` lee `github.event.workflow_run.actor.login`.
- API GitHub: `develop`, `staging`, `main` indican `protected:false`; `/rulesets` devolvió `[]`. Estado de protección del environment `production` reportado en la bitácora; no revalidado por API administrativa.

## Prueba propia de documentación, GREEN y mutaciones RED

La siguiente prueba no usa controles escritos por el autor: se diseñó por separado. Las mutaciones se aplican a una cadena **en memoria**, sin tocar archivos. Copiar el bloque en una terminal situada en la raíz de un checkout limpio del SHA.

```bash
cat > /tmp/pr491-r1.mjs <<'NODE'
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";
const root = process.cwd(); // ejecutar desde el checkout del SHA revisado
const read = p => readFileSync(join(root,p),"utf8");
const release = read("docs/runbooks/release.md");
const cron = read(".github/workflows/health-cron.yml");
const mig = read(".github/workflows/migrate.yml");
const dep = read(".github/workflows/deploy.yml");
const prod = cron.split("\n  production:\n")[1] ?? "";
function checks(doc) {
  return {
    H03_GATE: mig.includes(`if [ "$GITHUB_ACTOR" != 'Lautaro073' ]; then`),
    H03_DOC: doc.includes("Un re-run **no** lo") && doc.includes("GitHub conserva el actor original"),
    H03_NUEVO_PUSH: doc.includes("de Lautaro073 a `main`"),
    H03_DEPLOY: dep.includes("github.event.workflow_run.actor.login"),
    H04_JOB: prod.includes("name: health-cron-production") && prod.includes("environment: production"),
    H04_URL_JOB: prod.includes("APP_URL: https://cadeapp.online"),
    H04_SIN_VAR: !prod.includes("vars.PRODUCTION_APP_URL"),
    H04_URL_DOC: doc.includes("https://cadeapp.online` cada 10 minutos"),
    H04_SECCION_4: doc.includes("`health-cron-production` (corre siempre, con la URL fija del workflow)"),
    H04_SIN_CONDICION_VIEJA: !doc.includes("existe la variable `PRODUCTION_APP_URL`")
  };
}
const baseline = checks(release);
for (const [name, pass] of Object.entries(baseline)) assert.equal(pass, true, `GREEN falló: ${name}`);
console.log(`GREEN ${Object.keys(baseline).length}/${Object.keys(baseline).length}`);
const mutations = [
  ["H03_re_run", "Un re-run **no** lo", "Un re-run lo", "H03_DOC"],
  ["H04_url", "https://cadeapp.online` cada 10 minutos", "https://otro.example` cada 10 minutos", "H04_URL_DOC"],
  ["H04_operacion", "`health-cron-production` (corre siempre, con la URL fija del workflow)", "`health-cron-production` habilitado (existe `PRODUCTION_APP_URL`)", "H04_SECCION_4"]
];
for (const [name, before, after, target] of mutations) {
  assert.ok(release.includes(before), `${name}: mutación sin objetivo`);
  const mutated = release.replace(before, after);
  assert.notEqual(mutated, release, `${name}: no mutó`);
  assert.equal(checks(mutated)[target], false, `${name}: falso verde`);
  console.log(`RED ${name}: ${target}`);
}
NODE
node /tmp/pr491-r1.mjs
```

**Ejecución independiente sobre contenido real leído del conector:** 9/9 verificaciones del primer arnés GREEN; mutación `H03_re_run` → RED; mutación `H04_operacion` → RED; `H04_url` → RED tras ajustar el objetivo exacto. El bloque anterior amplía ese arnés a 10 verificaciones, conserva las propiedades y valida explícitamente que cada mutación encuentre objetivo. No se afirma haberlo ejecutado dentro de un clon.

## CI del SHA original

- [`CI` run 42429001614](https://github.com/cadeApp/cadeApp/actions/runs/42429001614): **success**, SHA `3b681085`; 7 jobs verdes (`lint`, `unit`, `typecheck`, `audit`, `db-tests`, `build`, `bundle-budget`).
- Log `unit`: Vitest **199 archivos / 3755 tests passed**; controles adicionales workflow **86 pass, 0 fail**, ADR **6 pass, 0 fail**.
- Log `db-tests`: antes de mutaciones **43 archivos / 3582 tests, Result: PASS** y al final otra vez **43 archivos / 3582 tests, Result: PASS**; hay `Result: FAIL` intermedios de mutaciones deliberadas, no del estado base.
- [`e2e-preview` 42429745093](https://github.com/cadeApp/cadeApp/actions/runs/42429745093): **cancelled**, job detenido durante setup y prueba E2E omitida; status `e2e-preview: error`. No equivale a E2E verde ni a regresión probada. No se disparó workflow manual.
- No hay cambios de aplicación/SQL ni secretos inspeccionados. `pnpm typecheck/lint/test` locales: **no ejecutados** por falta de clon; se usa CI del SHA original.

## Comandos Git recomendados para verificación complementaria

```bash
git fetch origin
git rev-parse origin/feat/T-312-release-checklist
git diff --name-only origin/develop...3b6810858ead3c7a22b3d365437fb85edd9419b7
git merge-tree --write-tree origin/develop 3b6810858ead3c7a22b3d365437fb85edd9419b7
node docs/revision-pr/analizar.mjs verificacion
```

Esos comandos no se afirman ejecutados aquí. Después del commit de revisión, la carpeta `pr-491` es el único cambio propio de esta ronda.
