# PR #370 / T-366 — Revisión independiente R5

**Fecha:** 2026-10-15 (Argentina; ejecución CI cruza al 16/10 UTC). **HEAD de código inspeccionado:** `ecc879294c5d9fab2eb9c63154cb3fd3f62a6362`. **Comparación:** `adf1aac2af315ad5833d29b94e96df68f48a5e02` → `ecc87929` = 1 commit de Kira, cambios SOLO en `e2e/specs/request-states.spec.ts` y `docs/tasks/log/T-366.md`; `docs/revision-pr/pr-370/**` intacta por la autora. **PR sigue OPEN, no mergeada**; responsable @KiraK72, issue #355 `en-review`.

## Dictamen
**CON BLOQUEANTES (1): PR370-H04, coordinación documental externa.** Se reconoce R01 y H03 **corregidos por inspección y E2E real**, sin mutación independiente local; H01 y H02 permanecen corregidos por inspección y CI; H05 es una mejora de disponibilidad no bloqueante. **NO MERGEAR #370** mientras la ficha T-366 reconciliada no esté efectivamente en develop. Los checks de #370 están VERDES, pero no resuelven la PR #377.

## R01 + H03 — Arreglo encontrado y avalado por el E2E en el nuevo SHA
**Archivo `e2e/specs/request-states.spec.ts:955–1144`**. Kira preservó el login antes de sembrar, el recorrido «Ver ofertas» con `Expirada`, las dos llamadas RPC concurrentes del mismo dueño, aislamiento de otro merchant, `accept_offer` rechazando `REQUEST_EXPIRED`, preservación de `matched` y los oráculos de PostgreSQL. Corrigió el bucle de drenaje `hasMore` con presupuesto de **10** iteraciones y exige `expect(hasMore).toBe(false)`.

Después de terminar **todas** las RPC manuales y el drenaje, el test crea una NUEVA solicitud `lazyRequestId` vencida con oferta pendiente (líneas ~1086–1096). **Antes** de entrar a historial usa oráculo DB (1100–1102): `published` y al menos una oferta `pending`. Va por primera vez a `/merchant/history?status=expired` (1105) SIN RPC del test entre medio; exige enlace de `lazyRequestId` y badge `Vencida` (1106–1108), y oráculo DB inmediato `expired` + ofertas `expired` (1111–1113). Comprueba asimismo «Todas», ausencia de Activas y no alterar `matched`. **Así se elimina el falso oráculo R4**: la transición del registro tardío no la hicieron las RPC directas del test. El test no edita SQL/RPC/código productivo.

El autor **no entregó evidencia de una mutación adversarial de ese escenario ejecutada en Preview sobre código productivo**: la mutación solicitada (quitar temporalmente llamada del servidor a `reconcileMerchantExpiredRequests` sin alterar tests) **no la ejecutó este revisor** y no es seguro desplegarla a Preview sin harness trusted. Por regla de trazabilidad los hallazgos pasan a `arreglado-sin-verificar` (no `arreglado-verificado`, `verificado_en_sha=null`), a pesar del E2E real GREEN. Eso no se inventa como defecto funcional demostrado del HEAD.

## PR370-H04 — ÚNICO BLOQUEANTE residual: ficha CC-026 sin merge en develop
**PR documental #377**, SHA `4742aa95`, tiene un único archivo `docs/tasks/T-366.md` y corrige justamente la fuente de verdad para incluir CC-026 (ya mergeada/migrada). La redacción `deben invocar` es prescriptiva y el alcance es adecuado. **Pero al revisar la PR #377 estaba OPEN/no mergeada**: lectura `docs/tasks/T-366.md` desde `develop` aún conserva instrucciones antiguas de abrir contract-change cuando falta la RPC.

En #377, `build` sigue **FAIL** en `next/font` con TypeError `Cannot read properties of null (reading '1')` (job #116635875603), y `approval-policy` sigue **FAIL**. Dado que la PR #377 modifica solo Markdown y el build de PR #370 pasó sobre el mismo `develop`, el fallo **podría** ser de entorno/infraestructura; no se demostró que el Markdown lo cause, ni se puede declarar verde sin un rerun exitoso. **No saltar checks ni mergear #377 por inferencia.** El paso humano/operativo pendiente corresponde a @Lautaro073: gestionar/reintentar check de build, completar aprobación legítima y merge de #377; después Kira incorpora `origin/develop` por **merge normal**, conserva la ficha de develop, corre `tools/verify-fichas.test.ts`, CI y E2E del HEAD resultante. Sin ese gate, #370 no se cierra.

## H01/H02 y H05 — sin regresiones nuevas probadas
`src/features/requests/queries.ts`, `src/features/requests/queries.test.ts` y la migración CC-026 no cambiaron en R5. Sigue la semántica fail-closed ante `hasMore=true && expiredCount=0` y los tests de cero SELECT y recuperación `0/true→1/false`. H05 mantiene un límite de 10×50; frente a 501+ solicitudes puede fallar cerrado por presupuesto, que es peor disponibilidad pero **no** estado inconsistente servido. Se documentó con fake, no es benchmark real de Supabase. No pedir rehacer lógica productiva ni aumentar el límite sin datos.

## CI y E2E de SHA `ecc87929` — evidencias externas auténticas
- [CI #38836647443](https://github.com/cadeApp/cadeApp/actions/runs/38836647443): SUCCESS en unit, typecheck, lint, build, audit, db-tests y bundle-budget. `unit`: 133 archivos y **2379/2379** tests PASS; `db-tests`: **Files=24, Tests=2283 Result PASS**, CC-026 pgTAP 54/54 PASS y mutación esperada RED 8/54 / original GREEN 54/54, harness transaccional CC-026 GREEN. No se ejecutaron SQL ni Docker por el revisor.
- [E2E #38836718124](https://github.com/cadeApp/cadeApp/actions/runs/38836718124), job #116767440749: `HEAD is now at ecc8792` (la cabeza del evento `repository_dispatch` puede mostrar develop), 79/79 Chromium PASS (18.2m), 3/3 global-settings PASS (54.8s), y T-366 prueba #68 PASS. Vercel Preview SUCCESS.
- **Approval-policy #370 SUCCESS** en la ejecución reciente del SHA; es distinto de #377, donde todavía falla. No inferir aprobación de PR #377 a partir del estado de #370.

## Método, límites y honestidad
Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, catálogo, skill, ficha autoritativa de develop, bitácora y comentarios; se comparó HEAD con R4, archivo test completo, job CI y log E2E del SHA. El intento de `git ls-remote` externo falló `Could not resolve host: github.com`: sin clon/worktree no se ejecutaron `pnpm`, Playwright independiente, `git merge-tree`, `analizar.mjs` ni mutantes propios. Por eso los hallazgos técnicos corregidos mantienen `verificado_en_sha=null`. **No aprobar ni mergear PR370 en esta ronda.**

## Informe revisar-pr — T-366 — 2026-10-15 — revisión independiente R5
**Resultado: CON BLOQUEANTES (1: H04).**
**Checks locales:** typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (CI/E2E reales revisados por logs, no ejecutados localmente).
**BLOQUEANTES:**
- `[docs/tasks/T-366.md:14] PR370-H04`: falta incorporar PR documental #377 a develop; build/approval-policy de #377 están rojos. Regularizar checks/aprobación/merge legítimo de #377, después integrar origin/develop en #370, validar y re-pedir revisión.
**MEJORAS:** H05 (backlog >500 fail-closed, benchmark RPC real futuro).
**CORREGIDOS POR INSPECCIÓN Y CI:** H01/H02/H03 y R01; no autodeclarar `arreglado-verificado` sin mutación independiente.
**No revisado:** mutación independiente de `getMerchantHistoryRequests` contra E2E real, y test local en worktree limpio. Sin otras decisiones técnicas nuevas para Lautaro073; el paso #377 sigue siendo de coordinación humana/operativa.