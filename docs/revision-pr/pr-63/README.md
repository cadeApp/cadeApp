# PR #63 — T-103 · Ciclo de solicitud

> ❌ **Con bloqueantes · 7 bloqueantes · 3 decisiones ya resueltas por Lautaro073 · 2 mejoras**
> Ronda 1 con la base local corrida (Docker); CI no consultado, por método.

| | |
|---|---|
| **PR** | [#63](https://github.com/cadeApp/cadeApp/pull/63) · `feat/T-103-request-lifecycle` → `develop` |
| **Tarea / issue** | [`T-103`](../../tasks/T-103.md) · Issue #13 |
| **Autor** | Lautaro073 (Codex, después Antigravity) |
| **Revisión** | independiente — no es el agente que implementó |
| **SHA revisado** | `9f2e42e` · base `origin/develop` = `b6b5f39` |
| **Alcance** | 7 archivos · **0 fuera** de «Archivos permitidos» · la ficha cambia solo anotaciones y tildes del DoD |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `9f2e42e` | ❌ 7 bloqueantes · 2 mejoras · 3 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |

La ronda 1 la empezó otra sesión, de forma estática, y no llegó a commitearse. Esta la terminó sobre el mismo SHA,
con cada hallazgo corrido contra la base local. Ver la nota al principio de `ronda-1.md`.

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `report_incident`: elegibilidad antes que participación, al revés de CC-002 §4 | medio | abierto |
| D01 | Precedencia de las ocho RPC sin escribir; RPC y fake divergen en 14/15 | decisión | decidido → CC antes del merge |
| H02 | Republicar una publicada vencida depende del cron | alto | abierto |
| H03 | `cancel_reason` libre legible por cualquier repartidor | alto | abierto |
| D02 | Dónde guardar el motivo libre | decisión | decidido → tabla solo admin |
| H04 | La aserción de `pg_locks` pasa sin llamar a la RPC | medio | abierto |
| H05 | Cuerpo de la PR y bitácora no corresponden al head | medio | abierto |
| H06 | Nueve efectos de transición sin aserción | alto | abierto |
| H09 | La promesa de `:194` sobre el `audit_log` sin control | medio | abierto |
| D03 | `cancel_request` de admin sin `aal2` | decisión | decidido → exigir `aal2` |
| H07 | Distancia 0 para puntos cercanos distintos | bajo | abierto (mejora) |
| H08 | Dos puntos ciegos del control estático | bajo | abierto (mejora) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. CC nuevo antes del merge (`D01`, `D03`).
2. En esta rama, después de traer el CC: `H01`, `H02`, `H03`/`D02`, `D03`, `H04`, `H06`, `H09`, gemela pgTAP de la
   tabla de doble falla, tipos regenerados con `--local`.
3. `H05`: cuerpo y bitácora al día con la corrida de `db-tests` del head.
4. `H07` y `H08` si entran.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
