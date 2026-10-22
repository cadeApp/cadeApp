# PR #411 — revisión independiente ronda 2 · T-369, paso 3/3

**Fecha:** 2026-10-18 · **HEAD revisado:** `7d8ed48a63753e37f3a838738eefedf2ccbcd699` · **Resultado: CON BLOQUEANTES (1), de integración; sin regresión funcional T-369 identificada.**

## PR411-H01 — arreglado-verificado

La corrección del DNI fijo T-302 fue implementada y mergeada por PR #416/T-372 en develop (`e266a2f2`). La PR #411 trajo ese commit en merge `c1224841cd9348798dc96d802abda36f60abdda2`.

**E2E real:** [run 39103489668](https://github.com/cadeApp/cadeApp/actions/runs/39103489668), [job 117604421950](https://github.com/cadeApp/cadeApp/actions/runs/39103489668/job/117604421950) hizo checkout exacto `c1224841`, completó **88 Chromium PASS** y **6 global-settings PASS**. Incluye: piloto activo sin cargos, T-302 DNI deduplicado y los tres casos T-369 con piloto apagado (acreditación admin AAL2→reserva→consumo, reintegro por vencimiento, plan ilimitado). El commit `c1224841..7d8ed48` solo añadió bitácora T-369: el código E2E revisado es idéntico.

**Chequeo propio:** cinco propiedades de código del test T-302 y cinco mutaciones negativas de texto en memoria fueron detectadas sobre el SHA revisado; es un chequeo **estático** del oráculo, no ejecución de Playwright propia. El runtime real fue CI. La suite T-369 utiliza `withPilot(false)` con restauración en `finally` y verifica `pilot_active`; la corrida serial de 6 tests aprobó.

[CI sobre c1224841](https://github.com/cadeApp/cadeApp/actions/runs/39103421344): 145 archivos/2765 unit PASS, 29 pgTAP/2764 PASS, T-369 multisesión 8/8 PASS, build/typecheck/lint/audit/bundle-budget PASS.

## PR411-H02 — bloqueante de integración, no bug de créditos

GitHub compare `develop...7d8ed48` confirma **7 commits adelante y 13 atrás**. `develop` está en `29a44225513621ca9430924cd90d4c929c219e8d` e incorpora CC-031, migración forward-only `20261018043250_cc031_courier_display_name_guard.sql`, cambios en `.github/workflows/ci.yml` y nuevas pruebas SQL. No existe una corrida de E2E validando el árbol resultante de fusionar la PR actual con esos commits.

**Corrección:** agy debe hacer `git fetch origin`, `git switch feat/T-369-e2e`, `git pull --ff-only origin feat/T-369-e2e`, `git merge origin/develop`; sin rebase/amend/force. Si hay conflictos, preservarlos por ámbito; no cambiar migraciones/SQL/CI de CC-031 para pasar tests. Validar `git diff --check` sobre código, checks CI completos y E2E en Preview del **nuevo SHA**, y documentar resultado y restauración del piloto en la bitácora. Solo entonces otra ronda rápida.

## Mejora — no bloqueante

El test `publication-credits.global-settings.spec.ts` guarda un plan por UI y recién después de releerlo por SQL lo registra en `trackEntityForCleanup`. Si la lectura posterior falla, podría quedar un plan creado sin ID registrado para limpiar. **Es una hipótesis de falla condicional por secuencia comprobada, no una fuga observada en CI.** Para endurecimiento futuro, registrar el código único de la corrida antes del save y probar cleanup ante lectura fallida; no modificar fuera de alcance en esta ronda.

## Límites y pendientes posteriores

Del HEAD `7d8ed48` typecheck, lint, unit, build, audit y bundle-budget estaban en SUCCESS; `db-tests` continuaba en progreso al cierre. `approval-policy` de ese SHA seguía FAIL por informe de ronda anterior; se actualizará el body sin cambiar política.

Mutación `t369-pilot-plan-copy` con `e2e-mutation` **todavía no ejecutada**: después de merge #411 sobre `develop`, solo vale `RED_CONFIRMED`. El acta de staging en la bitácora es una guía pendiente, se ejecuta manualmente después del release autorizado `develop → staging`. **No** cerrar #356 ni cambiar el piloto hasta los gates y decisión humana.

**DICTAMEN:** CON BLOQUEANTES (1) por integración pendiente. No se aprobó ni mergeó.