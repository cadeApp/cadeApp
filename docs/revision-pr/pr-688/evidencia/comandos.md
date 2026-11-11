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