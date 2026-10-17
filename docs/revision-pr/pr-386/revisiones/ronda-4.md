# Revisión independiente — PR #386 / T-363 — Ronda 4

**Fecha:** 2026-10-16 (Argentina). **SHA examinado:** `f91a414ea424f9262de89be458a5b21b10c1cba5`. **develop desde GitHub:** `cc7fb54bf24b33f00d06801025bae7f07429e9e4`.
**Dictamen:** **SIN BLOQUEANTES DE CÓDIGO**. **Integración de develop completada, PR #385 mergeada**. **No mergear #386 hasta concluir y verificar los checks del HEAD final después de este commit documental de revisión.** No se aprueba ni se mergea.

## Sincronización e integridad del proceso

- La PR #385 fue mergeada a develop. En PR #386 se hizo **merge sin rebase** `278c11fb014d6c983f39dbc856b01390223860fc` con padres `7e55ba0` y `cc7fb54` (= develop actual). El merge resolvió la eliminación de `docs/tasks/log/T-363.md` conservando la bitácora de T-363; mantuvo la ampliación de alcance del 16/10 en `docs/tasks/T-363.md`, expresamente autorizada por Lautaro073 en la implementación. No se encontró otro conflicto reportado.
- Después del merge, el agente añadió **un único commit documental** `f91a414` (`docs/tasks/log/T-363.md`) con evidencia y una prueba local de timeout. No alteró `docs/revision-pr/pr-386/**`. Comparación `7e55ba0...f91a414` muestra imports de otros PRs desde develop y 33 líneas de bitácora T-363; **no son nuevas modificaciones propias de la feature**.
- Comparación `develop cc7fb54...f91a414`: 26 archivos de esta tarea y del registro independiente, incluidos los 17 renglones de ampliación de ficha. Se cruzaron todos con los permitidos originales y la **ampliación explícita** autorizada por Lautaro073. Sin nuevas dependencias, secretos, RPC, RLS, migraciones ni modificaciones de workflows/domino/UI en el diff de T-363.
- Por comparación de **SHA de blob** en ambos HEAD (`7e55ba0` y `f91a414`) son idénticos `src/features/trips/route-points.ts`, `src/features/trips/components/trip-route-map.tsx`, `e2e/specs/map-privacy.spec.ts`, `src/features/offers/queries.ts`, `src/features/requests/components/request-offers-list.tsx`, `src/server/live/t204.ts`, `src/lib/live-contracts.ts` y `docs/revision-pr/pr-386/hallazgos.jsonl`. No se detectó alteración de las pruebas H01/H02, sus aserciones ni resultados artificiales.

## Hallazgos y decisiones

- **PR386-H01: arreglado-verificado** en `99e3b2a`. La navegación sigue segmentando a máximo 3 waypoints y 2048 caracteres, con continuidad y fallback manual. El código no se modificó en el merge. Mutaciones propias RED de R2 siguen documentadas; no se registran como ejecutadas otra vez.
- **PR386-H02: arreglado-verificado** en `99e3b2a`. `fitBounds` y bounds de todos los puntos se mantienen; el código sigue idéntico. La E2E de 5 entregas pasó en el merge integrado.
- **D01 (2-A)**: vigente la excepción D15 de Google Maps voluntario, solo actor autorizado post-match; sin ampliarla a prematch, logs, push o URLs internas. No hay decisiones nuevas.
- **Bloqueantes nuevos:** 0. **Mejora no bloqueante:** la nota heredada de `docs/tasks/T-363.md` que afirma «esta PR solo publica fichas» quedó obsoleta respecto de una PR que implementa código; no cambia el DoD ni la autorización dada. Corregirla opcionalmente en un mantenimiento documental separado, sin frenar la integración.
- **Flake observado, no atribuible a T-363 sin investigación adicional:** E2E `main-flow.spec.ts:585` T-360 excedió timeout 60000 ms en intento 1 y pasó en retry #1. La PR T-363 no modifica ese archivo ni ese flujo. No maquillar como «81 passed sin incidentes»: especificar `1 flaky`.

## Evidencia del código integrado y HEAD documental

- **CI merge SHA `278c11f`** [run 38982843048](https://github.com/cadeApp/cadeApp/actions/runs/38982843048): todos los jobs relevantes SUCCESS; unit job 117247444555 **135 archivos / 2492 tests PASS**; db-tests job 117247444915 **Files=26, Tests=2341, Result: PASS**; build, typecheck, lint, audit y bundle-budget también SUCCESS. `approval-policy` run 38982843149 SUCCESS.
- **E2E merge SHA `278c11f`** [run 38982914091](https://github.com/cadeApp/cadeApp/actions/runs/38982914091), job 117247720073: el runner hizo checkout real de `278c11f`. **81 Chromium PASS, 1 flaky por retry de T-360** y **3 global-settings PASS**; T-363 PR386-H01/H02 de cinco entregas PASS. Se leyeron los logs, no solo el resumen del workflow `repository_dispatch`.
- **CI HEAD documental `f91a414`** [run 38985572731](https://github.com/cadeApp/cadeApp/actions/runs/38985572731): al último chequeo `approval-policy`, build, lint, typecheck, audit, bundle-budget y unit SUCCESS; **db-tests todavía IN_PROGRESS**. No se declara PASS hasta terminar. Los nuevos commits de la carpeta de revisión dispararán CI otra vez; comprobar ese SHA también.
- **Local del autor** sobre merge `278c11f`: `pnpm test` inicialmente **1 failed / 2491 passed** por timeout 5 s en el barrido de `clients.test.ts`; ejecución aislada **10/10 PASS** y CI sobre merge completo **2492/2492 PASS**. Se contrastó el resumen de CI; no se fabricó una excepción silenciosa. `merge-tree` y `tools/verify-fichas.test.ts` fueron **declarados por el autor** con exit 0 y 7/7; el revisor **no los ejecutó localmente** al no disponer de clon.
- **Bundle** en CI: `/trips/[id]` ≈225 kB y `/merchant/requests/[id]` ≈192 kB frente al threshold 180 kB; warning no bloqueante ya presente, no se atribuye aumento a T-363 sin medición de base.

## Resultado y condiciones de cierre

**Técnicamente apta para merge en el árbol integrado `278c11f`**, con la salvedad E2E flaky **no reproducida como defecto de T-363**. La PR #385 ya no bloquea. La PR #386 tiene HEAD documental posterior `f91a414` (sin cambios de código), y este informe añadirá otro commit: **verificar CI y E2E del SHA resultante** antes de integrar. No disparar workflows manualmente ni generar commits vacíos. No mergear por iniciativa del revisor.

**Limitaciones:** lectura remota de GitHub, logs de CI/E2E y comparación de blobs, no clon local. No se corrió un `git merge-tree`, `pnpm`, Docker, SQL ni SDK Maps real por esta sesión. Batería independiente previa R2 sigue trazada en `99e3b2a` y no se vuelve a adjudicar como si se hubiera ejecutado en `f91a414`. 
