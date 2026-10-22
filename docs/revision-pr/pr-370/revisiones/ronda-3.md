# Revisión independiente — PR #370 / T-366 — ronda 3

Fecha: 2026-10-15. HEAD funcional inspeccionado: `26dbe51220000ae2f84696c2aa94d49089568561`. Base PR: `develop` @ `d947031a13ee19a725a1a024ef3eeb5f70ba4682`. Autora: @KiraK72. Comparación desde revisor R2 `07281133`: 5 commits de autor, 5 rutas (queries, tests, E2E, ficha y bitácora); sin edición por Kira de `docs/revision-pr/pr-370/**`.

**Resultado: CON BLOQUEANTES (2: H03 cobertura E2E residual y H04 gate documental). H01 y H02 están corregidos por inspección y CI del SHA revisado. H05 es mejora de disponibilidad, no integridad. NO APROBAR NI MERGEAR.**

## H01 + H02 — corregidos por inspección y CI
`src/features/requests/queries.ts:25-50` ya no retorna éxito con `expiredCount=0 && hasMore=true`: reintenta hasta `MAX_CONSECUTIVE_LOCK_RETRIES=3` y si no se libera el lock arroja error antes de SELECT. `src/features/requests/queries.test.ts:2486-2607` comprueba 0/true persistente para historial y activas, ausencia de SELECT y éxito de 0/true→1/false. La mutación RED del autor no fue reproducida por el revisor; estados de hallazgos `arreglado-sin-verificar` y `verificado_en_sha=null`.

## H03 — PARCIAL / BLOQUEANTE residual
El E2E real ya pasó: [run #38809405892](https://github.com/cadeApp/cadeApp/actions/runs/38809405892), job `e2e-preview` #116678610937; el log hizo checkout del HEAD `26dbe51`, ejecutó **79/79 Chromium (25.0m) y 3/3 global-settings (1.1m)**. El caso T-366 de `request-states.spec.ts:955` pasó (#68). Cubre dos comerciantes separados, aislamiento tenant, `matched` intacto, navegación real en Historial/Todas y Vencidas y ausencia en Activas, así como `delivery_requests.status` y `offers.status` expired en BD.
**Lo que NO demuestra:** nunca navega `/merchant/requests/<id>` («Ver ofertas») antes de reconciliar, ni verifica una oferta vencida no aceptable en ese recorrido. La segunda sesión de merchant ejecuta RPC secuencial para aislamiento, no lectura simultánea de dos sesiones del mismo dueño; la concurrencia sí tiene pruebas SQL/harness en CC-026, no en este E2E. La prueba de cursor >50 existe en Vitest fake, no en Preview. La ficha develop DoD exige «Ver ofertas» y dos sesiones. Extender el test con navegación de detalle antes del historial y un escenario de dos lectores concurrentes sobre fixture propia; verificar cursor >50 con infraestructura E2E real o un test de integración de consultas que no se base solo en un fake, o documentar formalmente el alcance cubierto sin afirmar uno no probado. Reejecutar Preview E2E en el HEAD final.

## H04 — PARCIAL / BLOQUEANTE de coordinación
Kira abrió la [PR documental #377](https://github.com/cadeApp/cadeApp/pull/377) con un único cambio en `docs/tasks/T-366.md`: referencia explícita al CC-026 y mandato prescriptivo `deben invocar`, lo cual es correcto. **Sigue OPEN y sin merge a develop**: `develop` todavía conserva la ficha que dice abrir CC por RPC faltante. El gate acordado en R1/R2 no se satisface con una PR documental abierta. El build de #377 falló en `next/font` con `TypeError: Cannot read properties of null (reading '1')` (job #116635875603); el diff es exclusivamente texto y no se probó relación causal con esa falla. `approval-policy` de #377 sigue sin aprobación vigente de Lautaro073. Requiere revisión/aprobación/merge legítimos de #377, luego merge normal de `origin/develop` a la rama #370, conservando ficha de develop; no rebase/force.

## H05 — mejora, no bloqueante
Test fake `src/features/requests/queries.test.ts:2609-2670`: 500 filas se concilian en 10×50 y 501 fallan cerradas antes del SELECT; no hay corrupción del estado de negocio. Límite rígido reduce disponibilidad con backlog >500 y `3` reintentos rápidos pueden fallar por lock prolongado. El microbenchmark con fake no mide latencia de red/BD: la aserción es `<500ms`, no garantía productiva de `<100ms`. Mantener presupuesto seguro, medir en entorno adecuado antes de refactor mayor.

## CI y método de verificación
- [CI #38809253455](https://github.com/cadeApp/cadeApp/actions/runs/38809253455): lint, typecheck, build, unit, db-tests, audit y bundle-budget SUCCESS en SHA `26dbe512`. Log unit: **133/133 archivos, 2379/2379 tests**; log db-tests: **Files=24 Tests=2283 Result PASS**; pgTAP CC-026 54 PASS, mutante SQL RED 8 fallos y original GREEN 54 PASS. No hay nuevos SQL en PR370.
- Vercel Preview y e2e-preview GREEN en el SHA revisado. `approval-policy` FAILURE por falta de aprobación de P1, coherente mientras haya bloqueantes.
- No pude ejecutar `git ls-remote` por DNS `Could not resolve host: github.com`, por lo tanto no hubo clon para `git merge-tree`, pnpm, E2E independiente, mutaciones propias ni scripts del repo. No fingir resultados. `verificado_en_sha=null` para H01/H02; evidencias son inspección remota y CI real ejecutada por Actions.

## Informe revisar-pr — T-366 — 2026-10-15 — R3
**Resultado: CON BLOQUEANTES (2)**.
Checks locales del revisor: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (se verificaron jobs CI y E2E por sus logs).
BLOQUEANTES:
- H03 `e2e/specs/request-states.spec.ts:955`: agregar navegación «Ver ofertas», dos sesiones concurrentes de lectura y oráculo de ofertas, y respaldo >50 para la capa de consulta; E2E existente sí pasó pero no cubre esos casos.
- H04 `docs/tasks/T-366.md:14`: merge de PR documental #377 a develop pendiente; build de esa PR rojo en next/font no debe silenciarse ni imputarse sin prueba.
MEJORAS: H05 `queries.ts:10` backlog >500 fail-closed documentado; latencia real pendiente de medición.
No revisado / dudas para Lautaro073: mutaciones del revisor, ejecución local Vitest/psql, git merge-tree. No se aprobó ni mergeó.