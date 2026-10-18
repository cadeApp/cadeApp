# PR #416 — T-372, revisión independiente ronda 2

**2026-10-18 · SHA revisado `789284d50ca3393f5aec7de6c2be91bfa31d1bbc` · SIN BLOQUEANTES.** Rama `feat/T-372-dni-unico-onboarding` hacia `develop`.

## Cierre PR416-H01

**Estado: `arreglado-verificado`.** Desde el commit de revisión ronda 1 `2f3686d`, agy modificó únicamente `docs/tasks/T-372.md` y `docs/tasks/log/T-372.md`. La primera viñeta del DoD de la ficha ahora es literalmente idéntica a la columna DoD de la fila T-372 en `docs/implementation-plan.md`. La segunda viñeta conserva detalles `DNI_REGEX`, `testRunId`, azar, comprobación HMAC y límite 10 intentos. `tools/verify-fichas.test.ts` y las expectativas originales no cambiaron.

Se ejecutó una **comprobación independiente en memoria** sobre contenidos reales obtenidos por GitHub del HEAD: igualdad estricta de viñeta y columna = true; control negativo, sustituyendo texto de la viñeta, da igualdad = false. Esto **no** equivale a ejecución local de Vitest.

**CI real sobre el mismo SHA:** [run 39100808635](https://github.com/cadeApp/cadeApp/actions/runs/39100808635), [job unit 117596510267](https://github.com/cadeApp/cadeApp/actions/runs/39100808635/job/117596510267): `tools/verify-fichas.test.ts` 7/7 PASS, 145/145 archivos y 2765/2765 tests PASS. Typecheck, lint, build, audit, bundle-budget y db-tests SUCCESS. RED previo: [run 39099606622](https://github.com/cadeApp/cadeApp/actions/runs/39099606622), fallo único `Desincronizadas: T-372`.

## E2E y alcance

El archivo `e2e/specs/courier-onboarding.spec.ts` del HEAD revisado es idéntico a `b6396784`, comparado de manera independiente descargando ambos desde GitHub. El [run 39098068311](https://github.com/cadeApp/cadeApp/actions/runs/39098068311) de ese código fue GREEN: 87 Chromium (incluido flujo de DNI duplicado) y 3 global-settings **de T-306**, no T-369. Es una evidencia de código idéntico, **no** ejecución del gate sobre el SHA documental más reciente.

Al revisar, el nuevo [e2e-preview 39100878945](https://github.com/cadeApp/cadeApp/actions/runs/39100878945) seguía en progreso. **No se declara verde hasta que termine realmente.** La rama estaba 0 commits detrás de develop y el PR figura mergeable_state `unstable` por gates no resueltos, no por conflicto de código.

## Dictamen

**SIN BLOQUEANTES identificados** para T-372; H01 cerrado por verificación propia del oráculo literal más log CI válido del HEAD. `approval-policy` rojo por informe viejo: la sección del body se reemplaza por esta ronda sin modificar la política. **No se aprobó ni mergeó**. GitHub debe confirmar gates efectivos al hacer merge. PR #411 puede incorporar develop tras merge de #416, completar su propio gate y someterse a revisión. No cerrar #415 anticipadamente.