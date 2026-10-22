# PR #63 — T-103 · Ciclo de solicitud

> ✅ **Mergeada a pedido de Lautaro073 · 18 de 20 registros verificados, 2 aceptados (`A01` y `H15`, este sin verificación independiente)**
> Rondas 1–3 con base local; ronda 4 y cierre con CI leído por dentro (`8bec19e`: `db-tests` 1.385/1.385, 8/8 checks).

| | |
|---|---|
| **PR** | [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop` |
| **Tarea / issue** | [`T-103`](../../tasks/T-103.md) · Issue #13 |
| **Autor** | Lautaro073 (Codex, después Antigravity) |
| **Revisión** | independiente — no es el agente que implementó |
| **SHA revisado** | ronda 1 `9f2e42e` · ronda 2 `37014bd` · ronda 3 `93cc3c5` · ronda 4 `0327282` · la rama sale de `b6b5f39`; develop ya está en `53bd0ef` |
| **Alcance** | 10 archivos en la ronda 2 · la ficha amplía a `src/domain/**` y `CC-005`: **aceptado** por Lautaro073 (`A01`) |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `9f2e42e` | ❌ 7 bloqueantes · 2 mejoras · 3 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `37014bd` | ❌ 5 bloqueantes · 1 mejora · 9 cerrados · 1 desvío aceptado | [`ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `93cc3c5` | ❌ 1 bloqueante de texto (`R01`) · 1 mejora · 7 cerrados | [`ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `0327282` | ❌ 1 bloqueante de coordinación (`H15`) · 2 cerrados · CI 9/9 leído | [`ronda-4.md`](revisiones/ronda-4.md) |

La ronda 1 la empezó otra sesión, de forma estática, y no llegó a commitearse. Esta la terminó sobre el mismo SHA,
con cada hallazgo corrido contra la base local.

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `report_incident`: elegibilidad antes que participación | medio | ✅ verificado en `37014bd` |
| D01 | Precedencia de las ocho RPC; RPC y fake divergían en 14/15 | decisión | ✅ verificado: 27/27 coinciden |
| H02 | Republicar una publicada vencida dependía del cron | alto | ✅ verificado |
| H03 | `cancel_reason` libre legible por cualquier repartidor | alto | ✅ verificado |
| D02 | Tabla de motivos solo para admin | decisión | ✅ verificado (su RLS la controla `H11`) |
| H04 | Aserción de `pg_locks` que no podía fallar | medio | ✅ verificado |
| H05 | Cuerpo y bitácora no correspondían al head | medio | ✅ verificado en `93cc3c5` (residuo en `R01`) |
| H06 | Efectos de transición sin aserción | alto | ✅ verificado en `93cc3c5`: 9/9 |
| H09 | Motivo libre en el `audit_log` sin control | medio | ✅ verificado en `93cc3c5` |
| D03 | `aal2` en la rama admin de `cancel_request` | decisión | ✅ verificado |
| H07 | Distancia 0 para puntos cercanos distintos | bajo | ✅ verificado |
| H08 | Dos puntos ciegos del control estático | bajo | ✅ verificado |
| A01 | CC-005 dentro de la PR | decisión | 🔵 aceptado por Lautaro073 |
| H10 | «M06a/M06b» no pueden fallar | alto | ✅ verificado en `93cc3c5` |
| H11 | La tabla de motivos sin test de RLS | alto | ✅ verificado en `93cc3c5` |
| H12 | Efectos de republicar una vencida sin aserción | medio | ✅ verificado en `93cc3c5` |
| R01 | Cuerpo y bitácora describen código que no existe | medio | ✅ verificado en `0327282` |
| H13 | Policy `for all` donde alcanza `for select` | bajo | ✅ verificado en `93cc3c5` |
| H14 | «P4b» corre con `aal2` y no fija el orden que dice | bajo | ✅ verificado en `0327282` (lado SQL por inspección + CI) |
| H15 | `CC-005` duplicado con develop (#79): conflicto | medio | 🔵 aceptado: lo arregló esta sesión a pedido (`8dff50e`, `e5ce192`); CI de `8bec19e` verde |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Cierre

Lautaro073 pidió que la sesión de revisión hiciera el renombre `CC-005` → `CC-006` y mergeara. El merge de develop
(`8dff50e`), la renumeración (`e5ce192`) y el cuerpo de la PR los hizo esta sesión. CI de `8bec19e`, leído por
dentro: `db-tests` `Files=7, Tests=1385, Result: PASS`, tipos sin diff y los otros 7 checks en `success`. Como
quien arregló es quien revisa, `H15` queda **aceptado**, no verificado de forma independiente (`AG-36`).

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
