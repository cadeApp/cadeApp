# Informe de revisión independiente — Ronda 5 · PR #361 / T-364

**Fecha:** 2026-10-15. **Autor:** @asako669 (P2). **Rama:** `feat/T-364-cancelar-desde-mis-solicitudes`. **HEAD exacto evaluado:** `0beec112e1d1b114b4e8480ff846c247dfb7421c`, base develop `14c28ed3c41cb2bde92705fc018c7dd0df73245b`.

## Resultado: SIN BLOQUEANTES para el SHA evaluado

La condición pendiente en Ronda 4 **PR361-H12**, que era obtener un E2E Browser confiable, quedó satisfecha en **una ejecución independiente de GitHub Actions** sobre este SHA. No hay nuevos defectos funcionales ni de alcance identificados en la única actualización del autor (solo bitácora). No hubo nuevos cambios de código desde la anterior revisión.

**Importante:** no ejecuté localmente Playwright ni reproduje mutaciones independientes: la verificación runtime es a través del runner confiable de GitHub Actions y sus logs, inspeccionados por esta revisión. Los hallazgos sobre los que solo hay lectura + pruebas de CI sin mutación propia mantienen el estado `arreglado-sin-verificar`; no se inflan a verificados.

## Evidencia exacta, verificada ahora

### E2E Preview + Supabase Develop: confirmado, no simulado

- **Run:** [38684930479](https://github.com/cadeApp/cadeApp/actions/runs/38684930479).
- **Jobs:** `resolve-preview` 116257499357 **success**; `e2e-preview` 116257546537 **success**; `report-preview-status` 116263773415 **success**.
- `resolve-preview` log: `PR interna #361 contra develop.` y `Preview listo para E2E.`
- **SHA confirmado por el reporter:** `0beec112e1d1b114b4e8480ff846c247dfb7421c`.
- **Deployment ID:** `dpl_6VTyStofwVUxbH1v1WwX7aejX3Am`; Preview: `https://cadeapp-develop-57xcy4uv5-lautaroj073.vercel.app`.
- **Environment:** `develop` de GitHub Actions, Supabase Develop explícitamente contrastado contra referencia de staging distinta; health check OK. Sin acceso ni cambios sobre producción por este revisor.
- **Chromium:** 75 casos enumerados, resultado `74 passed (20.0m)` + **1 flaky** que falló en primer intento y aprobó en retry. El único flaky fue `e2e/specs/map-privacy.spec.ts:438` (T-314): esperaba HTTP 200, pasó al reintento. **NO es un nuevo hallazgo de T-364 ni debe ocultarse.**
- **T-364:** `✓ 65 [chromium] › e2e/specs/request-states.spec.ts:827:7 › T-364 (§5.1): Cancelación rápida por comercio dueño en published: UI Playwright, oráculo SQL y rechazo ajeno (25.7s)`. Es el flujo introducido por la tarea, no un test RPC-only: fue inspeccionada la fuente en el SHA y se encontró login real, localizador por requestId, modal de dos pasos, solicitud activa, contador `-1`, historial por ID, SQL y segundo merchant con `UNAUTHORIZED_ACTOR`.
- **global-settings:** `3 passed (1.1m)`; final del workflow `success`.
- **Status del commit original:** `e2e-preview=success` con target_url del run citado. No hubo skip ni sustitución por check Vercel.

### CI general

- Run [38684858567](https://github.com/cadeApp/cadeApp/actions/runs/38684858567): **success**.
- `unit`: `Test Files 129 passed (129)`, `Tests 2180 passed (2180)`.
- `db-tests`: `Files=22, Tests=2205, Result: PASS`; incluye segunda pasada tras mutación de otro subsistema; db-types local comprobado en CI.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: **success**.
- La PR informa `mergeable=true` y solo incluye 19 paths autorizados por ficha T-364; no se alteraron `src/domain/**`, `src/ui/**`, migraciones, dependencias ni workflows.

## Corrección del diagnóstico anterior de agy

El último comentario del autor concluyó que faltaba alinear el secret `VERCEL_PROJECT_ID` porque tres eventos previos fueron descartados con `El deployment no pertenece al proyecto Vercel de develop.`. Esa inferencia **no era suficiente**: `.github/workflows/e2e-preview-target.mjs` dice explícitamente que eventos del proyecto staging **deben descartarse** por el gate develop. La corrida posterior `38684930479` seleccionó correctamente la PR 361, ejecutó E2E en Preview `cadeapp-develop...` y publicó `e2e-preview=success` para el SHA exacto, de modo que **no hay acción manual de modificación de secrets pendiente.**

La bitácora del autor `docs/tasks/log/T-364.md` contiene el diagnóstico histórico anterior a la corrida exitosa; su estado final se corrige en esta revisión y en el comentario de la PR, sin modificar la bitácora reservada a agy ni crear commits que alteren el código bajo prueba.

## Estado de hallazgos y grado de evidencia

- **H01/H05/H11/H12:** `arreglado-verificado` por Playwright real del runner confiable, con SHA/run y logs de esta ronda. `verificado_en_sha=0beec112e1d1b114b4e8480ff846c247dfb7421c`.
- **H02–H04/H06–H10/H13:** `arreglado-sin-verificar` **independientemente por mutación**: el código corregido y CI unit/typecheck GREEN constan, pero no se reprodujeron por esta revisión los mutantes autorales. Mantener `verificado_en_sha=null` hasta una ejecución independiente que corresponda.
- **🔵 DECISIONES:** ninguna. No es necesario cambiar secret ni ampliar ficha/CC.
- **MEJORA no bloqueante, ajena a T-364:** el flaky de T-314 y el diagnóstico de skip por proyecto merecen seguimiento, sin refactor ni nueva ronda de T-364 por sí solos.

## Cierre de la revisión

**SIN BLOQUEANTES sobre `0beec112e1d1b114b4e8480ff846c247dfb7421c`.** Esta ronda se commitea solo en `docs/revision-pr/pr-361/**` y, por eso, **mueve el HEAD a un commit de documentación distinto**. La CI y el status `e2e-preview` del **nuevo** SHA deberán observarse según los gates normales antes de hacer merge; no atribuir el PASS del SHA anterior al nuevo. El código aplicativo y de pruebas no se modifica en esta ronda.

**No aprobé ni mergeé.** Se informa el resultado en un único comentario de PR. No hay prompt de corrección para agy porque no quedan cambios obligatorios; no crear commits de bitácora innecesarios que reinicien nuevamente el gate.
