# Evidencia — PR #295 / T-338

## Ronda 1

HEAD funcional revisado:

```text
PR      = #295
branch  = feat/T-338-pwa-standalone
HEAD    = 6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a
develop = a773c05cc488a1fc60bfb36512cdca35d12d1271
base    = a773c05cc488a1fc60bfb36512cdca35d12d1271
draft   = true
mergeable = true
```

El HEAD de `develop` coincide con el base del PR. No hay drift que resolver en esta ronda.

### Archivos modificados

```text
docs/tasks/log/T-338.md
e2e/specs/pwa-standalone.spec.ts
src/app/manifest.test.ts
src/app/sw.test.ts
src/features/notifications/install/is-standalone.test.ts
src/features/notifications/install/is-standalone.ts
src/features/notifications/install/standalone-back-link.tsx
src/features/notifications/install/standalone-navigation.test.tsx
src/features/notifications/install/standalone-redirect.tsx
```

Los 9 están permitidos por la ficha. No hay `docs/revision-pr/pr-295/**` previo del autor, ni reviews/threads previos.

### H01 — implementación ausente

Inspección exact-head:

```text
src/app/manifest.ts                  start_url: '/'
public/sw.js                         CACHE_NAME = cadeapp-shell-v1
public/sw.js                         STATIC_ASSETS incluye '/'
public/sw.js                         fallback navegación consulta cache.match('/')
public/sw.js                         notificationclick fallback = origin + '/'
src/features/.../is-standalone.ts   return false
standalone-redirect.tsx             devuelve children sin detectar modo
standalone-back-link.tsx            ignora standaloneMode
Home/Login/Register/Legal           no están en el diff
is-ios.ts                            no está en el diff
```

### H02 — el test no alcanza las páginas

Imports de `standalone-navigation.test.tsx`:

```text
./is-standalone
./standalone-back-link
./standalone-redirect
```

No hay import de:

```text
src/app/page.tsx
src/app/(public)/login/page.tsx
src/app/(public)/register/page.tsx
src/app/(public)/legal/page.tsx
```

Prueba discriminante requerida para R2: con helpers correctos, restaurar una por vez las cuatro integraciones productivas al código anterior. Cada caso debe quedar RED.

### H03 — evidencia de bitácora no corresponde al grafo del test

La bitácora atribuye cuatro RED a Home/Login/Register/Legal, pero H02 muestra que el archivo no importa esas páginas. La próxima entrada debe copiar los nombres/salidas realmente ejecutados.

### H04 — reutilización de `isStandalone()` sin control

`is-ios.ts` actual contiene su propia expresión:

```ts
('standalone' in navigator && ...)
|| window.matchMedia('(display-mode: standalone)').matches
```

El test existente `ios-install-guide.test.tsx` cambia `navigator.standalone` directamente y por lo tanto puede seguir verde sin que `is-ios.ts` llame al helper nuevo.

Mutación R2: volver `is-ios.ts` a esta lógica duplicada. Un test con `isStandalone` mockeado debe quedar RED.

### H05 — respuesta offline

El test nuevo afirma 503 + «Sin conexión» + no shell + no `cache.match('/')`, pero no afirma HTML.

Mutación R2:

```js
return new Response('Sin conexión', {
  status: 503,
  statusText: 'Offline',
});
```

Con el fallback de cache eliminado, esta variante no debe poder quedar verde.

### H06 — flash de landing

Secuencia actual del E2E standalone:

```text
page.goto('/')
waitForURL('/login')
expect(heading landing).not.toBeVisible()
```

La observación empieza después de alcanzar `/login`. R2 debe incluir una sonda que marque si el heading llegó a estar visible antes del redirect y una mutación de guard que haga render + redirect tardío para demostrar RED.

## CI y runtime

No se abrieron logs de CI en Ronda 1 porque existen bloqueantes estáticos. Según el procedimiento, CI se revisa recién cuando la ronda está para cerrar sin bloqueantes.

No se levantó Supabase ni Docker. T-338 no toca DB/server.

## Gate manual pendiente

Antes del cierre final, una persona debe probar en Android real:

1. PWA instalada con estado previo/start_url viejo → abrir icono y confirmar que no se ve landing y termina en /login/gateway.
2. PWA instalada/actualizada con manifest nuevo → abrir icono y confirmar /login/gateway.
3. Navegación común en Chrome → / sigue mostrando la landing.
4. Registrar resultado en una nueva entrada de `docs/tasks/log/T-338.md`.

## Ronda 2 — 2026-10-07

### Identidad, autoría, alcance

```text
PR funcional revisado      43e5945f1d2519db37e260c114df51071bb3fe94
R1 commit revisión         ca5421a50bb3f43867116efd4e2d623135fddf22
Ficha actualizada P1       f5d1393f0391a9f5ff03741a9bec1728b2cb2fd7
develop consultado         cd023e3453ead76983d54982df1548cb97aa57eb
base original PR           a773c05cc488a1fc60bfb36512cdca35d12d1271
GitHub mergeable           true
PR draft                   true
Cambio autor desde R1      43e5945: 17 archivos sin tocar docs/revision-pr/**
Decisiones P1              0-A y 1-A
```

`docs/tasks/T-338.md` se actualizó en la rama con la ampliación **estricta** de `src/features/notifications/index.ts` y el DoD de 180 kB. No es una modificación de código funcional.

### Evidencia de builds (no estimaciones)

```text
Baseline develop a773c05, CI run 37582604006, build job 112665469344
/          107 kB
/legal     107 kB
/login     162 kB
/register  162 kB

PR functional 43e5945, CI run 37699020056, build job 113057721190
/          194 kB
/legal     194 kB
/login     224 kB
/register  224 kB

bundle-budget job 113058233763:
las cuatro = "Supera el límite"; job success (warning advisory).
```

### CI general y E2E

```text
CI run 37699020056: success (SHA funcional 43e5945)
unit job 113057721008: Test Files 125 passed (125); Tests 1961 passed (1961)
typecheck/lint/build/db-tests: success
Vercel status: success
e2e-preview status: error, TARGET_SHA=43e5945
Preview run 37699126807: resolve-preview success; e2e-preview job 113058120541 cancelled
report-preview-status job 113058483691: RESULT=cancelled -> state=error
```

No inferir causa de `cancelled` sin logs adicionales. La ejecución de E2E no sucedió en este run, así que H06 no se da por verificado.

### Revisión de los anteriores H01–H06

- Se inspeccionó manifest, SW v2, helper, is-ios, wrappers, las cuatro páginas y tests de consumidores reales.
- La bitácora sesión 2026-10-07 19:55 relata mutaciones RED y GREEN. Son afirmaciones del autor; **no se reprodujeron por el revisor**.
- H01–H05 se dejan `arreglado-sin-verificar`, H06 `parcial`; no se atribuyen ejecuciones independientes inexistentes.
- No hubo shell/worktree local, Supabase local ni Docker para esta Ronda 2. `git merge-tree` local queda pendiente aunque GitHub dice mergeable=true.

### Control reproducible y que falla cerrado para R01 (NO EJECUTADO por revisor)

El siguiente harness debe guardarse solo en `/tmp/t338-budget-check.mjs` por el agy, no en el repositorio. Verifica **todas** las rutas y aborta si falta una o supera 180:

```js
import { readFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) throw new Error('Uso: node /tmp/t338-budget-check.mjs /tmp/t338-build.log');
const build = readFileSync(input, 'utf8');
const sizes = new Map();
for (const line of build.split(/\r?\n/)) {
  const match = line.match(/[○ƒ]\s+(\/(?:legal|login|register)?)\s+[\d.]+\s+(?:B|kB)\s+([\d.]+)\s+kB/);
  if (match) sizes.set(match[1], Number(match[2]));
}
const routes = ['/', '/legal', '/login', '/register'];
let bad = false;
for (const route of routes) {
  const value = sizes.get(route);
  const ok = value !== undefined && Number.isFinite(value) && value <= 180;
  process.stdout.write(`${route}: ${value ?? 'MISSING'} kB -> ${ok ? 'OK' : 'RED'}\n`);
  if (!ok) bad = true;
}
if (bad) process.exitCode = 1;
```

Para reproducir RED con el HEAD de R2 se debe hacer en un **worktree limpio** del commit funcional:

```bash
git worktree add /tmp/wt-t338-r2 43e5945f1d2519db37e260c114df51071bb3fe94
(
  cd /tmp/wt-t338-r2
  pnpm install --frozen-lockfile
  set -o pipefail
  pnpm build 2>&1 | tee /tmp/t338-r2-build.log
  node /tmp/t338-budget-check.mjs /tmp/t338-r2-build.log
)
# Debe salir exit 1 por rutas >180: demostrar RED real con los números.
```

Para GREEN en la rama posterior al arreglo:

```bash
set -o pipefail
pnpm build 2>&1 | tee /tmp/t338-fixed-build.log
node /tmp/t338-budget-check.mjs /tmp/t338-fixed-build.log
pnpm exec vitest run src/app/manifest.test.ts src/app/sw.test.ts src/features/notifications/install/is-standalone.test.ts src/features/notifications/install/ios-install-guide.test.tsx src/features/notifications/install/standalone-navigation.test.tsx
pnpm typecheck && pnpm lint && pnpm test
```

**IMPORTANTE:** Este harness se entrega para ejecutar en la siguiente iteración; no se presentó salida fabricada. Para H06 se exige un E2E en Preview real GREEN y una mutación que muestre la landing antes de redirigir, en aislamiento temporal, con prueba RED. Si el E2E se cancela, informarlo sin cambiar el resultado del test.

### Gate Android

PWA en Android real: **no ejecutado y no acreditado**. Ver pasos humanos en `revisiones/ronda-2.md`.
