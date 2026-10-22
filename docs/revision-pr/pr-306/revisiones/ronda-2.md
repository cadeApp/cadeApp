# PR #306 — Ronda 2 · Revisión independiente T-351

**Fecha:** 2026-10-08.
**SHA revisado de arreglos:** `742bcf1936228432038b436876e53825926323b8`.
**Comparación con ronda 1:** solo `docs/tasks/T-351.md` (+104/-25) y `docs/tasks/log/T-351.md` (+37/-1), 1 commit desde `9b59dd16fb0cc3de97d40b4021725107a295a122`.
**Resultado: CON BLOQUEANTES (1 nuevo).** Los 3 originales y la mejora se corrigieron en la ficha; el bloqueo es ahora la integración con `develop`.

## Contratos y alcance

Se conservaron los controles: issue #297, T-309 del branch `feat/T-309-uploads-a11y`, la ficha T-351 (ausente en develop), las reglas `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, y las lecciones históricas citadas en ronda 1. La PR sigue siendo **solo documental**: no se alteraron producción, `src/**`, `e2e/**`, deps, tests ni `docs/revision-pr/pr-306/**` desde el lado del autor.

## Verificación de arreglos

- **PR306-H01, alto — arreglado-verificado en ficha:** `docs/tasks/T-351.md:77-84,102-130,183-198`. Matriz explícita de cinco casos en cuatro estados de `DocumentUploadCard`, `compressing=true/false`, tokens positivos, contraste de cada texto sobre el fondo real, asterisco DNI y axe temporal por cuatro snapshots `idle/uploading/error/success` con interacción real + cleanup. RED especificado en el color success/error sin tocar expectativas. Verificación estructural independiente **13/13**.
- **PR306-H02, medio — arreglado-verificado en ficha:** `docs/tasks/T-351.md:168-181,200-202`. Cuatro controles accesibles `getByLabel`, `toBeAttached`, `toHaveCount(4)` de «Subir» y mutación adversarial de `htmlFor`; `data-status` queda auxiliar. Verificación **8/8**.
- **PR306-H03, medio — arreglado-verificado en ficha:** `docs/tasks/T-351.md:200-216`. El RED ya no cambia la expectativa a un estado inexistente; suprime temporalmente el render real de DNI frente en la PR aislada y conserva las expectativas. Mutaciones temporales sólo `review/T-351-onboarding-axe` con commits + revert, nunca en la PR definitiva. Verificación **4/4**.
- **PR306-H04, bajo — arreglado-verificado en ficha:** `docs/tasks/T-351.md:32`, bitácora `docs/tasks/log/T-351.md:14`; `src/features/courier-onboarding/copy.ts` confirma `btnUploaded: 'Cargado'`. Verificación **3/3**.

Esos 28 controles de texto son **verificación de contenido documental**, no RED/GREEN de Playwright ni evidencia de contraste runtime. La PR futura de implementación debe ejecutar de verdad las pruebas y mutaciones.

## Bloqueante nuevo

### PR306-H05 — ALTO · No se puede mergear contra develop actualizado

**Ubicación:** `docs/implementation-plan.md` fila a continuación de T-349.
**Origen:** modificación concurrente de `develop`, no defecto de los arreglos H01–H04.

La PR #305 (T-350) se fusionó después de la ronda 1, llevando `develop` al commit `fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f`. El informe REST de PR #306 devuelve `mergeable=false`, `mergeable_state="dirty"`. La comparación GitHub informa **behind_by=1**; las ramas divergen en el mismo hunk del plan:

- `origin/develop`: contiene fila **T-350**, aún no **T-351**.
- `docs/T-351-ficha`: contiene fila **T-351**, aún no **T-350**.

El autor anticipó correctamente esta posibilidad en la descripción de la PR, pero **la reconciliación todavía no está hecha**. Se requiere merge normal de `origin/develop` sobre la rama y resolución del conflicto reteniendo **ambas filas** con exactamente un registro cada una. No hacer rebase, amend ni force-push. La reconciliación no autoriza tocar producción. Registrar el commit merge, revisión del diff y HEAD remoto; correr `pnpm vitest run tools/verify-fichas.test.ts`, `git diff --check`, `pnpm typecheck && pnpm lint && pnpm test`. Esperar checks y confirmar `mergeable=true`.

**Sonda de control para ronda 3:** verificar las dos filas T-350/T-351 en el plan de la rama, `git merge-base --is-ancestor origin/develop HEAD`, comparar con `origin/develop` y observar `mergeable_state` en GitHub. RED de ahora = `dirty`, GREEN futuro = integración sin conflicto.

## Checks observados

- HEAD de cambios `742bcf1936228432038b436876e53825926323b8`: GitHub expuso `Vercel Preview Comments = success`, `Supabase Preview = skipped`, `approval-policy = failure` porque aún no hay informe completo sin bloqueantes. No había resultados de `unit/typecheck/lint/build/db-tests` publicados al consultar ese SHA; no se asumen verdes de otro SHA.
- No se clonó ni ejecutó tests localmente en un workspace de GitHub; el conector permitió inspeccionar contenido y ejecutar en memoria la lógica estática de comprobación 28/28. `git merge-tree` no se corrió, pero GitHub informa explícitamente `dirty` y las dos versiones del plan demuestran la fuente del conflicto.
- La validación de T-351 es solo documental. No ejecutar migraciones remotas, no atribuir resultados E2E que no existen.

## Siguiente paso

Corregir **únicamente el conflicto de integración**, actualizar la bitácora y pedir **ronda 3**. No hay decisiones para Lautaro073: conservar ambas filas ya es la única solución compatible con los dos contratos. No aprobar, no mergear.
