# Revisión independiente PR #323 — Ronda 3

**Fecha:** 2026-10-13. **SHA auditado:** `ab66689fb736a7d482d788e977c98e8f2d750785`, base `875f8621fa727c115326cc2f83036e44859ad52e`.

## Resultado: CON BLOQUEANTE DE EVIDENCIA (1). Decisión B resuelta y ejecutada.

**Código de T-352:** los únicos cambios en `src/` siguen siendo `src/features/requests/actions.ts` (retorna `redirectTo:'/merchant/dashboard'` al publicar) y las dos expectativas de `actions.test.ts`. No hubo cambios de seguridad, permisos, RPC, middleware, alias, E2E o workflow en PR #323 entre R2 y este SHA; su último commit `ab66689` solo añadió evidencia a `docs/tasks/log/T-352.md`.

## H01 — BLOQUEANTE todavía ABIERTO

La bitácora `docs/tasks/log/T-352.md:112–191` aporta comparación real de logs: runs #323 `38345452343` y `38346169980` cancelados, ambos dentro de Chromium antes de `global-settings`. La línea base sin el arreglo T-352 (run `38343556554`, PR #322) también se canceló y falló en grupos equivalentes. Se verificó el estado de cancelación en GitHub Actions y los nombres repetidos de fallos en los logs. **No se ha demostrado cuál es el error primero de cada suite**, porque el job se cancela sin imprimir los stacks completos ni subir el reporte. La causa relativa a seeds sin drops sigue siendo hipótesis compatible; inspección de `develop` muestra el helper `seedDeliveryRequestInState` que inserta la solicitud con status no-draft sin crear los hijos, mientras #320 altera ese procedimiento. No se atribuye todo fallo a esa causa sin ejecución de integración.

Los dos casos de creación UI `main-flow.spec.ts:187` y `:249` pasaron al primer intento en los logs del baseline y en #323. La medición del autor es de **duración de test completo**: 33.2→17.0/21.1 s y 31.9→19.8/20.5 s. No demuestra segundos entre clic y URL, ni cantidad de consultas Auth posteriores; falta ese DoD de rendimiento.

## DECISIÓN Lautaro073: Opción B (autorizada explícitamente)

Crear PR temporal `REVIEW ONLY / NEVER MERGE` combinando #320 y #323 sobre `develop` para ejecutar el E2E completo sin ampliar el alcance productivo de T-352. La decisión es **distinta de aceptar un gate E2E acotado** y no autoriza mergear #320, #323 ni el PR temporal.

**Acción realizada:** [PR temporal #324](https://github.com/cadeApp/cadeApp/pull/324), rama `review/T-340-T-352-checkpoint-320-323`, Draft, HEAD combinado `13658242a4074ec491d417a3c90f152189f6e463`. Fuente #320 `2e0872e8b11410f5f0a880fec30346e17025e240`, fuente #323 `ab66689fb736a7d482d788e977c98e8f2d750785`, base develop `875f8621fa727c115326cc2f83036e44859ad52e`. Se contrastaron 22 blobs exactos en árbol Git, sin archivos superpuestos ni cambios conflictivos con Develop. El resultado funcional combinado y la medición están pendientes del runner confiable Preview. **No se hizo merge**.

## H02 — mejora documental atendida

Desde `087d5c6` la bitácora distingue lo demostrado (el literal redirectTo), la predicción de consultas evitadas y la medición no disponible. Se mantiene `arreglado-sin-verificar` hasta disponer de mediciones reales, sin atribuir mejoras no demostradas.

## Checks y alcance revisado

- CI de #323 HEAD `ab66689`: **unit 129 suites / 2116 tests PASS**, **db-tests 21 suites / 1995 tests PASS**, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` PASS, observados por logs GitHub (run `38350025278`).
- `approval-policy` no queda verde sin informe **SIN BLOQUEANTES**; el bloqueo H01 es legítimo y no se elude.
- No se ejecutó pnpm/Docker ni SQL remoto local; integración de PR #324 verificada por contenido SHA y comparación GitHub, no por E2E.
- En #324 CI/e2e-preview estaba comenzando al documentar; no se declara como PASS.
- El checkpoint Step 3/4 de T-340 sigue sin autorizar.

## Seguimiento y cierre

El agente **no debe** tocar `docs/revision-pr/**`, `src/`, fixtures ni E2E de las PR originales para «hacerlo verde». Leer únicamente resultado real del workflow E2E de PR #324, incluidos ambos proyectos, flaky/retries, SHA exacto de Preview y métricas; registrar en bitácora T-352 evidencias válidas. Si no hay trace de PASS no inventar números ni cambiar specs; proponer alternativa aislada para medición con autorización. Si la integración falla, identificar el stack real y corregir en PR de origen responsable, tras nueva revisión. Cerrar #324 **sin merge** solo tras guardar conclusiones. Para mergear #320 y #323 harán falta revisiones individuales y autorización de Lautaro073.
