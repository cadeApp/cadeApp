# Comandos reproducibles — PR #688 · f7e2dc35

Los RED R1–R3 de [red.md](red.md) pertenecen al **autor** y no fueron reproducidos por el revisor. El siguiente harness es propio, diseñado para encontrar mutaciones que los tests nuevos no cubren. Su sintaxis Bash se validó localmente; no pudo ejecutarse contra la PR porque el entorno no tiene un clon utilizable y git no resuelve GitHub por DNS.

## Script completo (copiar a /tmp/pr688-review.sh y ejecutarlo desde un clon con dependencias)

~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="f7e2dc359491a56b4d4a54b2a703c788a7f32653"
TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$TMP/wt" "$SHA"
if [[ -d "$ROOT/node_modules" ]]; then ln -s "$ROOT/node_modules" "$TMP/wt/node_modules"; fi
cd "$TMP/wt"
TEST1="src/app/(merchant)/merchant/plan/notifications/page.test.tsx"
TEST2="src/features/notifications/push/components/push-permission-prompt.test.tsx"
pnpm vitest run "$TEST1" "$TEST2" > "$TMP/baseline.log" 2>&1 || { tail -40 "$TMP/baseline.log"; exit 1; }
echo "BASELINE:"
grep -E '^ *Tests |^ *Test Files ' "$TMP/baseline.log" | tail -2
node --input-type=module - "$TMP" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tmp = process.argv[2];
const tests = [
  'src/app/(merchant)/merchant/plan/notifications/page.test.tsx',
  'src/features/notifications/push/components/push-permission-prompt.test.tsx'
];
const mutations = [
  {
    id: 'M01-error-boundary',
    file: 'src/features/notifications/push/push-prompt-entry.tsx',
    needle: 'PushPromptErrorBoundary,\n    null,',
    replacement: 'React.Fragment,\n    null,'
  },
  {
    id: 'M02-personalized-error',
    file: 'src/features/notifications/push/components/push-permission-prompt.tsx',
    needle: 'return PUSH_COPY.prompt.statusNetworkError;',
    replacement: "return 'MUTACION: error sin copy';"
  }
];
for (const item of mutations) {
  const original = readFileSync(item.file, 'utf8');
  if (original.split(item.needle).length !== 2)
    throw new Error(item.id + ': objetivo ausente o repetido');
  writeFileSync(item.file, original.replace(item.needle, item.replacement));
  let result;
  try {
    result = spawnSync('pnpm', ['vitest', 'run', ...tests], { encoding: 'utf8' });
  } finally {
    writeFileSync(item.file, original);
  }
  if (result.error) throw result.error;
  const output = result.stdout + '\n' + result.stderr;
  writeFileSync(tmp + '/' + item.id + '.log', output);
  const matches = output.match(/Tests\s+[^\n]*/g);
  const summary = matches?.at(-1) ?? 'sin resumen';
  console.log(item.id + ': exit=' + result.status + '; ' + summary);
  console.log(result.status === 0
    ? 'CONTROL CIEGO: la mutación quedó verde'
    : 'El control detectó la mutación: revisar causa real del RED');
}
NODE
~~~

M01 elimina un boundary que el wrapper nuevo ya no invoca: la falta de test de falla debería quedar expuesta. M02 altera la salida de network_error sin que un test de copy personalizado la observe. **No se declara ninguna salida de ejecución de esas mutaciones**.

## RED→GREEN requerido en el arreglo

**H03:** agregar un test en la prueba de la página merchant que provoque una excepción del componente lazy y exija fallback local role="alert" «No se pudo cargar el control de notificaciones» con botón «Recargar la página». Probar ambos roles; debe fallar ANTES de envolver en PushPromptErrorBoundary y pasar después. Mutación posterior: quitar el boundary y volver a rojo.

**H04:** mockear requestNotificationPermission con ok:true, subscribeToPush con ok:false/error:network_error, renderizar el prompt con copy.statusNetworkError personalizado, click en «Activar avisos», esperar role="alert" y comparar el texto personalizado. Debe fallar antes del arreglo, pasar después. Mutación posterior: sustituir text.statusNetworkError por PUSH_COPY.prompt.statusNetworkError, y rojo.

## Comandos finales de la próxima sesión

~~~bash
pnpm vitest run "src/app/(merchant)/merchant/plan/notifications/page.test.tsx" "src/features/notifications/push/components/push-permission-prompt.test.tsx" "src/app/(merchant)/merchant-nav.test.tsx"
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git status --short
git ls-remote origin feat/T-431-merchant-push-whatsapp
~~~

No correr Supabase ni Docker para esta tarea. El SHA de las correcciones se revisa por separado; los resultados autorreportados 3764/3764 no se atribuyen al revisor.

---

## Batería independiente R2 — cinco mutaciones nuevas (no son M1/M2 del autor)

**Objetivo:** evaluar las propiedades que los arreglos introdujeron: texto y acción del error boundary, y ramas distintas de la función que recibe copy. El script siguiente se diseñó por el revisor, no se basa en las mutaciones M1/M2 del autor. Fue copiado a /tmp/pr688-r2-harness.sh y pasó bash -n y node --check (solo verificación sintáctica); **no se ejecutó Vitest** porque el runtime no tiene checkout de GitHub y git no resuelve github.com.

**Script completo y autocontenido:** desde un clon que contiene el commit 93a08afc, copiar todo el bloque a /tmp/pr688-r2-harness.sh y ejecutar bash /tmp/pr688-r2-harness.sh. Instalar las dependencias antes si el clon no tiene node_modules; el script no instala, ni toca .env, Docker o Supabase. Trabaja en worktree temporal limpio y restaura mutaciones desde contenidos en memoria, sin git checkout.

~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="93a08afce1d1f36f78eab6f9828ff969539c0183"
TMP="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TMP/wt" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$TMP/wt" "$SHA"
if [[ -d "$ROOT/node_modules" ]]; then ln -s "$ROOT/node_modules" "$TMP/wt/node_modules"; fi
cd "$TMP/wt"
TEST_PAGE='src/app/(merchant)/merchant/plan/notifications/page.test.tsx'
TEST_PROMPT='src/features/notifications/push/components/push-permission-prompt.test.tsx'
pnpm vitest run "$TEST_PAGE" "$TEST_PROMPT" > "$TMP/baseline.log" 2>&1 || {
  tail -40 "$TMP/baseline.log"
  echo 'ERROR: baseline rojo; no se ejecutan mutaciones' >&2
  exit 1
}
echo 'BASELINE:'
grep -E 'Test Files|Tests ' "$TMP/baseline.log" | tail -3
node --input-type=module - "$TMP" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const temp = process.argv[2];
const testPaths = [
  'src/app/(merchant)/merchant/plan/notifications/page.test.tsx',
  'src/features/notifications/push/components/push-permission-prompt.test.tsx'
];
const mutations = [
  { id:'H03-fallback-title', file:'src/features/notifications/push/push-prompt-entry.tsx',
    find:'No se pudo cargar el control de notificaciones.', replace:'MENSAJE ERRÓNEO DE MUTACIÓN',
    expected:'si el componente falla al renderizar' },
  { id:'H03-retry-label', file:'src/features/notifications/push/push-prompt-entry.tsx',
    find:"'Recargar la página'", replace:"'MUTACION SIN RECARGAR'",
    expected:'si el componente falla al renderizar' },
  { id:'H04-permission-blocked', file:'src/features/notifications/push/components/push-permission-prompt.tsx',
    find:"case 'permission_blocked':", replace:"case 'mut_permission_blocked':",
    expected:'con el alta fallida por permission_blocked' },
  { id:'H04-missing-keys', file:'src/features/notifications/push/components/push-permission-prompt.tsx',
    find:"case 'missing_keys':", replace:"case 'mut_missing_keys':",
    expected:'con el alta fallida por missing_keys' },
  { id:'H04-default', file:'src/features/notifications/push/components/push-permission-prompt.tsx',
    find:'return text.statusSubscriptionError;', replace:'return text.statusGenericError;',
    expected:'con el alta fallida por otro_codigo' }
];
let missed = 0;
for (const m of mutations) {
  const original = readFileSync(m.file, 'utf8');
  if (original.split(m.find).length !== 2) throw new Error(m.id + ': objetivo ausente o repetido');
  let result;
  try {
    writeFileSync(m.file, original.replace(m.find, m.replace));
    result = spawnSync('pnpm', ['vitest','run',...testPaths], {encoding:'utf8'});
  } finally {
    writeFileSync(m.file, original);
  }
  if (result.error) throw result.error;
  const output = result.stdout + '\n' + result.stderr;
  writeFileSync(temp + '/' + m.id + '.log', output);
  const caught = result.status !== 0 && output.includes(m.expected) && /Tests\s+\d+ failed/.test(output);
  const summary = output.match(/Tests\s+[^\n]*/g)?.at(-1) ?? 'sin resumen';
  console.log(m.id + ': ' + (caught ? 'RED esperado' : 'NO detectado / rojo ajeno') +
    '; exit=' + result.status + '; ' + summary);
  if (!caught) missed++;
}
if (missed) process.exitCode = 1;
NODE
~~~

**Criterio**: baseline verde y cada mutación con test identificable en rojo. Si la prueba falla por import/mocking/entorno en vez de la expectativa, no cuenta como detección. El script evita establecer un resultado sin haberlo ejecutado. Al copiar a un clon, conservar el output de cada log en el directorio temporal antes del cleanup si se quiere un registro permanente; no adjuntar .env ni tokens.

**Advertencia:** el script R1 anterior atacaba el boundary del entry point, no el wrapper nuevo. M01 de R1, por sí solo, no podía probar que la extracción conservara el boundary. Esta batería R2 cambia el contenido del boundary **que ya quedó conectado**, por lo que sí mediría que la UI muestra texto y botón reales de su fallback.

## CI observado en la ronda 2

- Workflow: https://github.com/cadeApp/cadeApp/actions/runs/43094486231, SHA 93a08afc.
- Jobs build, typecheck, lint, audit, bundle-budget, unit: SUCCESS al momento de consultar.
- db-tests: todavía en ejecución en esa consulta.
- La descarga del log unit devolvió timeout; **no se copiaron cifras del log**. Los 3775/3775 provienen de la bitácora del autor.
- approval-policy falló antes de publicarse el informe formal SIN BLOQUEANTES en el cuerpo de la PR; no es una falla técnica de los componentes.
