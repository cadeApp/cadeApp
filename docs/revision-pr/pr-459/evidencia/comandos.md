# Evidencia y comandos — PR #459 / T-382 — Ronda 1

**SHA fijo examinado:** `1b24455f37b845b6b1e53ba672b459b62853ae06`. Esta sesión usó lectura GitHub; sin clon local, entorno Supabase, test runner ni acceso a credenciales. Nada en esta sección afirma ejecución de Vitest/Playwright por la revisión.

## Sondas propias realizadas sobre blobs del SHA (ESTÁTICAS)

El revisor obtuvo dos archivos por GitHub y ejecutó en memoria tres predicados originales, seguidos de reemplazos hipotéticos del texto en memoria **sin modificar la rama**. Resultado:

```text
S1-H01: baseline defect detected = true; hypothetical-fix defect detected = false
S2-H02: baseline defect detected = true; hypothetical-fix defect detected = false
S3-H03: baseline defect detected = true; hypothetical-fix defect detected = false
```

Son evidencias de **rutas de código que faltan**, no de efectos reales ni de que el arreglo propuesto sea completo. Las mutaciones de la ficha M1–M7 fueron del autor, no de la revisión.

### Harness completo reproducible en una copia limpia del SHA

Copiar el bloque desde la raíz del repo. No toca el código fuente ni entorno remoto:

```bash
cat > /tmp/pr459-static-probes.cjs <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const ui = fs.readFileSync(path.join(root, 'src/features/notifications/push/components/push-permission-prompt.tsx'),'utf8');
const sub = fs.readFileSync(path.join(root, 'src/features/notifications/push/subscription.ts'),'utf8');
function h1(s) {
  return /const result = await unsubscribeFromPush\(\);[\s\S]{0,160}if \(!result\.ok\) \{\s*setErrorMessage\(PUSH_COPY\.prompt\.statusDeactivateError\);\s*return;/.test(s);
}
function h2(s) {
  return s.includes("error: err instanceof Error ? err.message : 'subscription_failed'") &&
   s.indexOf("let subscription = await registration.pushManager.getSubscription()") <
    s.indexOf("error: err instanceof Error ? err.message : 'subscription_failed'");
}
function h3(s) { return s.includes('message: cause.message'); }
const probes = [
 ['S1-H01', h1, ui, ui.replace('setErrorMessage(PUSH_COPY.prompt.statusDeactivateError);',"setAccountState('pending_unsubscribe');\n      setErrorMessage(PUSH_COPY.prompt.statusDeactivateError);")],
 ['S2-H02', h2, sub, sub.replace("error: err instanceof Error ? err.message : 'subscription_failed'","error: classifySubscribeException(err)")],
 ['S3-H03', h3, sub, sub.replace('message: cause.message','message: sanitizePushErrorMessage(cause.message)')]
];
let fail = false;
for (const [label, check, original, mutated] of probes) {
 const baseline = check(original);
 const after = check(mutated);
 console.log(label + ': baseline defect detected=' + baseline + ', hypothetical-fix defect detected=' + after);
 if (!baseline || after || mutated===original) fail=true;
}
if(fail) process.exitCode=1;
NODE
node /tmp/pr459-static-probes.cjs
```

**Aviso:** que el script dé PASS no verifica el arreglo nuevo. Es detector específico de tres patrones del SHA original; las pruebas de comportamiento serán obligatorias durante el arreglo.

## Pruebas funcionales requeridas y mutaciones — NO ejecutadas por esta revisión

Desde un worktree limpio del SHA funcional (sin ejecutar contra producción):

```bash
git fetch origin
git worktree add --detach /tmp/pr459-wt 1b24455f37b845b6b1e53ba672b459b62853ae06
cd /tmp/pr459-wt
pnpm install --frozen-lockfile
pnpm exec vitest run src/features/notifications/push.test.ts src/app/api/push/subscriptions/status/route.test.ts src/features/courier-onboarding/components.test.tsx
pnpm typecheck
pnpm lint
pnpm test
# No se corrió nada de lo anterior en esta revisión.
```

Pruebas faltantes para el agy (todas necesitan GREEN tras fijar el comportamiento):
- H01 RED inicial: el caso `unsubscribe()` true + `DELETE 500` debe fallar por falta de «baja pendiente» y «Reintentar baja»; segundo intento `DELETE 200` con `getSubscription() === null` y el endpoint pendiente debe funcionar. Mutaciones locales: quitar UI pendiente y quitar el fallback del pending endpoint; ambos deben provocar RED.
- H02 RED inicial: `navigator.serviceWorker.ready` rechaza con `NotAllowedError` y `pushManager.getSubscription()` con `AbortError`; debe fallar la expectativa de código estable, sin POST. Mutación: devolver `err.message` como código; RED.
- H03 RED inicial: `new Error`/`DOMException` con URL-capacidad, `p256dh`, `auth` en `message` debe fallar «log sin secretos». Mutación: reponer `message: cause.message`; RED.

Usar copia local temporal del archivo en worktree para cada mutación; **restaurarla sin `git checkout`**, confirmar GREEN sobre el mismo test. Registrar en bitácora comandos completos, extractos del resumen y hashes del archivo restaurado. Nunca dejar mutaciones, mocks engañosos, `.skip` ni expectations debilitadas en commit.

## Evidencia declarada por el autor; no certificada por la revisión

Bitácora `docs/tasks/log/T-382.md` a este SHA: RED inicial `21 failed`; GREEN unitarios `164 passed`, mutaciones M1–M7 RED/GREEN; Playwright local contra Preview `a61ecd10` y Supabase Develop, T-382 `3 passed`; gate completo con `CI=true`/`--workers=1`, Chromium `93 passed` y dos flaky (reintento exitoso), global-settings `6 passed`. El autor canceló `e2e-preview` oficial durante las rondas por decisión expresa de Lautaro073. Esta revisión **no reejecutó** esas pruebas ni inspeccionó una corrida CI completa como evidencia de ausencia de bloqueantes.

## Rama y alcance

GitHub `compare(develop, feat/T-382-push-errors-status)`: `ahead 3`/`behind 0`; `mergeable=true`. 14 archivos del diff, todos dentro de los permitidos de la ficha de develop. `git merge-tree` y `node docs/revision-pr/analizar.mjs verificacion` **no ejecutados aquí** por falta de clon. El comentario final de PR referencia la carpeta y el SHA; el commit exclusivamente documental que agrega esta revisión no exige un nuevo gate E2E por sí mismo.
