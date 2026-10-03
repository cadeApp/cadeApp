# Informe de revisión — PR #228 / T-327 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/228<br>
**SHA revisado:** `a3d13d72a440f2523698b83ce93d5330469cc3af`<br>
**Base:** `develop@2e43d71` · 1 ahead / 0 behind<br>
**Fecha:** 2026-10-03

## Resultado

**CON BLOQUEANTES (3).** Los tres se arreglan con poco trabajo. El cambio de los workflows es correcto: lo que falla
es que el test no protege lo que la PR dice proteger, y falta el respaldo documental.

## Qué hace la PR

Agrega a `e2e-preview.yml` y `e2e-staging.yml`:

```sh
if [ -f e2e/specs/notifications.spec.ts ]; then
  specs+=(e2e/specs/notifications.spec.ts)
fi
```

entre `request-states` y la invocación `pnpm exec playwright test "${specs[@]}" --project=chromium --workers=1`.
Copia el patrón de la #207 (request-states). `verify-workflows.test.mjs` suma una aserción por gate.

## Lo que se verificó y está bien

- **El modelo de confianza no cambia.** El workflow sigue saliendo de la rama por defecto y los specs salen del SHA
  probado, igual que antes: la #180 no puede reescribir el gate que recibe los secretos. No hay permisos, environments,
  secretos, `concurrency` ni `continue-on-error` nuevos.
- **El spec funciona con el entorno que le da el gate.** `notifications.spec.ts` (head de la #180 `0666c26`) usa
  `stagingContext`, `loginAsMerchant`, `createAdminClient` (`SUPABASE_SERVICE_ROLE_KEY` está en el env del step) y
  `context().setOffline()`. No necesita VAPID, permisos de navegador ni un proyecto de Playwright propio: el permiso
  denegado se simula con `addInitScript`. Entra bien en `--project=chromium --workers=1`.
- **La condición por existencia es correcta.** `develop` no tiene el spec, así que las demás PR siguen corriendo
  solo smoke + main-flow + request-states.
- **Tests de workflows en el SHA:** 46/47 en local. El que falla (`workflow lint rejects unused code…`) falla porque el
  worktree de revisión no tiene `node_modules` (ESLint devuelve vacío). En CI, `unit` pasó.

## BLOQUEANTES

### PR228-H01 · La aserción nueva no detecta que el spec quede fuera de la invocación

`.github/workflows/verify-workflows.test.mjs:673` y `:993`

La regex `if [ -f …notifications… ]; then[\s\S]*specs+=(…notifications…)` solo pide que el bloque exista en el job,
en cualquier lugar. No pide que esté **antes** de `pnpm exec playwright test "${specs[@]}"`. Si el bloque se mueve
debajo de la invocación, el spec se agrega al array cuando ya corrió todo: **nunca se ejecuta**, y el test sigue en verde.

Mutaciones ejecutadas sobre `a3d13d7` (`node --test --test-name-pattern=E2E …`):

| Mutación | Resultado esperado | Resultado real |
|---|---|---|
| M1 · borrar el bloque en preview | test 3 rojo | **rojo** ✅ |
| M2 · mover el bloque debajo de la invocación en preview | test 3 rojo | **verde** ❌ |
| M3 · mover el bloque debajo de la invocación en staging | test 1 rojo | **verde** ❌ |

La PR dice que el test «exige semánticamente» el spec, y la ficha T-327 pide que `verify-workflows` «falle ante
mutaciones reales». M2 y M3 son la regresión más probable si alguien reordena el step. La aserción de request-states
(#207) tiene el mismo hueco.

**Qué hacer:** en los dos tests, exigir que cada bloque opcional (`request-states` y `notifications`) aparezca antes de
la invocación chromium. Por ejemplo, comparar índices (`indexOf(bloque) < indexOf(invocación)`), o una sola regex
anclada `if … notifications … fi[\s\S]*pnpm exec playwright test "\$\{specs\[@\]\}" --project=chromium`.

**Verificación:** M2 y M3 tienen que poner en rojo los tests 3 y 1. Hay que mostrar el rojo antes de arreglar y el
verde después, y repetir con `request-states`.

### PR228-H02 · `e2e-staging.yml` está fuera del alcance de T-327 y falta anotar la excepción

`.github/workflows/e2e-staging.yml:62`

La ficha T-327 (`develop`) pone en «Fuera de alcance»: «`e2e-staging.yml` y `deploy.yml`: staging y producción no
cambian». Además, la rama es `fix/e2e-notifications-gate` y no `feat/T-327-…`, y los commits llevan `[T-327]`.

**🔵 DECISIÓN tomada por Lautaro073 (2026-10-03): autorizar y anotar.** El cambio en staging se queda, como en la #207.

**Qué hacer:** agregar a `docs/tasks/T-327.md` una sección «Excepción de alcance autorizada» que diga: (1) la #228
agrega `notifications.spec.ts` a ambos gates y además toca `e2e-staging.yml`; (2) lo autorizó Lautaro073 el
2026-10-03 en la Ronda 1 de la PR #228; (3) el precedente es la #207 (request-states, anotada en la ficha de T-304).
Los dos archivos (`T-327.md` y la bitácora) están en «Archivos permitidos».

**Verificación:** `pnpm vitest run tools/verify-fichas.test.ts` en verde.

### PR228-H03 · Falta evidencia: sin informe en el cuerpo, sin checks pegados y la bitácora no registra la sesión

Cuerpo de la PR · `docs/tasks/log/T-327.md`

- El cuerpo no tiene la sección «Informe de revisión de agy», así que **`approval-policy` está en rojo**: «Falta el
  informe completo de revisar-pr sin bloqueantes».
- No hay salida de `typecheck`/`lint`/`test` ni de los workflow tests (AGENTS.md §4).
- La bitácora `docs/tasks/log/T-327.md` termina en la Ronda 2 de la #206 y no menciona esta PR.

**Qué hacer:** agregar a la bitácora la sesión de esta PR (qué se hizo, la decisión de H02, las mutaciones de H01 en
rojo y en verde, y lo que falta: la corrida real en la #180). En el cuerpo, pegar los checks con su alcance y el
bloque literal del informe.

## No es de esta PR

- **`build` rojo:** `next/font` falló al bajar la fuente de Google (`TypeError: Cannot read properties of null
  (reading '1')`, `src/app/layout.tsx`). Es la red del runner: las corridas recientes de `develop` y de otras ramas no
  tienen este error. **Re-ejecutar el job.**
- **`audit` rojo:** `braces` high, por `eslint-config-next`. Es ajeno y es el mismo en `develop`. El job dice
  «advisory until contracts-v1».
- **`e2e-preview` pendiente** sobre esta PR: corre smoke + main-flow + request-states (este SHA no tiene
  `notifications.spec.ts`). Flow 4 de `main-flow` sigue bloqueado por #200, así que el color del status no dice nada
  sobre notifications. Eso se ve recién en la #180, leyendo el log por dentro.

## Decisiones P1

- H02 → **autorizar y anotar** (2026-10-03).

## No revisado

- La lógica de `notifications.spec.ts` en sí: es de la #180 y tiene su propia revisión (`docs/revision-pr/pr-180/`).
- Una corrida real del gate con notifications: solo puede pasar después del merge, sobre la #180 sincronizada.
