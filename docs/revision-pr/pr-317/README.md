# PR #317 — T-340 · Paso 1/4 — Esquema y puente legacy

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · **Autor:** @asako669 (P2)  
**Rama:** `feat/T-340-varias-entregas` → `develop`  
**Estado actual:** 🔴 **CON BLOQUEANTES (2 parciales) — NO MERGEAR**

## Rondas independientes

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `d2b3285a` | 2 bloqueantes | [Ronda 4](revisiones/ronda-4.md) |
| **5** | **`09d2a920`** | **2 pendientes/parciales: H08 y H13** | **[Ronda 5](revisiones/ronda-5.md)** |

## Estado de los hallazgos

| Hallazgo | Estado al cerrar ronda 5 |
|---|---|
| H01–H07 | Arreglados y verificados |
| **H08** | **Parcial, bloqueante:** runner de 2 sesiones integrado y 8/8 CI, pero en 4 órdenes B reemplaza `publish_request` por `UPDATE status` manual; detectar lock por PID y exigir fail-fast SQL. |
| H09–H12 | Arreglados y verificados; corrección contractual de H09/H10 documentada |
| **H13** | **Parcial, bloqueante:** RPC reales bajo prueba, pero tests `not in_transit` y legacy `drops_count>1` admiten causas de error ajenas a sus guardas. |

**Evidencia real de CI para SHA de ronda 5:** run `38156727884`, `db-tests` PASS: 21 archivos, 1.972 pruebas y runner 8/8; approval-policy FAIL. Los ocho escenarios del runner no son equivalentes a ocho llamadas reales a `publish_request`. El código de ronda 5 se limitó a archivos autorizados por Lautaro073 (opción A para H08).

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Próximo paso

Sin decisiones de producto o ampliación de alcance: el agy debe corregir H08 y H13 dentro de los dos tests ya autorizados, manteniendo `ci.yml` solo para ejecución y la bitácora. CI del **nuevo SHA**, mutaciones negativas reales en Postgres efímero y ronda 6 independiente. No aprobar, no mergear ni empezar paso 2 hasta cerrar y luego completar checkpoint Develop.
