# PR #63 — T-103 · Ciclo de solicitud

> ❌ **Con bloqueantes · ronda 2 · 5 bloqueantes, todos de control o documentación · 9 de 12 de la ronda 1 cerrados y verificados**
> Las dos rondas corrieron la base local (Docker); CI no consultado, por método.

| | |
|---|---|
| **PR** | [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop` |
| **Tarea / issue** | [`T-103`](../../tasks/T-103.md) · Issue #13 |
| **Autor** | Lautaro073 (Codex, después Antigravity) |
| **Revisión** | independiente — no es el agente que implementó |
| **SHA revisado** | ronda 1 `9f2e42e` · ronda 2 `37014bd` · base `origin/develop` = `b6b5f39` |
| **Alcance** | 10 archivos en la ronda 2 · la ficha amplía a `src/domain/**` y `CC-005`: **aceptado** por Lautaro073 (`A01`) |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `9f2e42e` | ❌ 7 bloqueantes · 2 mejoras · 3 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `37014bd` | ❌ 5 bloqueantes · 1 mejora · 9 cerrados · 1 desvío aceptado | [`ronda-2.md`](revisiones/ronda-2.md) |

La ronda 1 la empezó otra sesión, de forma estática, y no llegó a commitearse. Esta la terminó sobre el mismo SHA,
con cada hallazgo corrido contra la base local.

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `report_incident`: elegibilidad antes que participación | medio | ✅ verificado en `37014bd` |
| D01 | Precedencia de las ocho RPC; RPC y fake divergían en 14/15 | decisión | ✅ verificado: 27/27 coinciden |
| H02 | Republicar una publicada vencida dependía del cron | alto | ✅ verificado |
| H03 | `cancel_reason` libre legible por cualquier repartidor | alto | ✅ verificado |
| D02 | Tabla de motivos solo para admin | decisión | ✅ verificado (su control falta: `H11`) |
| H04 | Aserción de `pg_locks` que no podía fallar | medio | ✅ verificado |
| H05 | Cuerpo y bitácora no correspondían al head | medio | ⚠️ parcial → `R01` |
| H06 | Efectos de transición sin aserción | alto | ⚠️ parcial: 8/9 → `H10` |
| H09 | Motivo libre en el `audit_log` sin control | medio | ⚠️ parcial: falta el `before` |
| D03 | `aal2` en la rama admin de `cancel_request` | decisión | ✅ verificado |
| H07 | Distancia 0 para puntos cercanos distintos | bajo | ✅ verificado |
| H08 | Dos puntos ciegos del control estático | bajo | ✅ verificado |
| A01 | CC-005 dentro de la PR | decisión | 🔵 aceptado por Lautaro073 |
| H10 | «M06a/M06b» no pueden fallar | alto | abierto |
| H11 | La tabla de motivos sin test de RLS | alto | abierto |
| H12 | Efectos de republicar una vencida sin aserción | medio | abierto |
| R01 | Cuerpo y bitácora describen código que no existe | medio | abierto |
| H13 | Policy `for all` donde alcanza `for select` | bajo | abierto (mejora) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

Todo en `supabase/tests/rpc_requests.sql`, la bitácora y el cuerpo de la PR: `H10` (M06), `H11` (M21), `H12`
(M20), `H09` (M13) y `R01`. Cada uno se demuestra con la mutación que trae al lado. `H13` si entra.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
