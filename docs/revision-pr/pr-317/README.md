# PR #317 — T-340 · Paso 1/4 — Esquema y puente legacy

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · **Autor:** @asako669 (P2)  
**Rama:** `feat/T-340-varias-entregas` → `develop`  
**Estado:** 🔴 **CON BLOQUEANTES (H13 residual, H14 nuevo)**. NO MERGEAR.

## Rondas independientes

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `d2b3285a` | 2 bloqueantes | [Ronda 4](revisiones/ronda-4.md) |
| 5 | `09d2a920` | 2 bloqueantes | [Ronda 5](revisiones/ronda-5.md) |
| **6** | **`00ec6a77`** | **2 bloqueantes (H13 y H14)** | **[Ronda 6](revisiones/ronda-6.md)** |

## Estado acumulado al terminar ronda 6

| ID | Estado |
|---|---|
| H01–H12 | ✅ Arreglados/verificados, incluido **H08** (8/8 carreras en CI de 2 sesiones con `publish_request` real y locks por PID). H09/H10 conservaron rectificación contractual del revisor. |
| **H13** | 🔴 **Parcial:** dos falsos oráculos de R5 corregidos, pero falta probar **actor ilegítimo/no aprobado/suspendido de `mark_drop_failed`**, y elegibilidad de `mark_drop_delivered`. |
| **H14** | 🔴 **Abierto nuevo:** faltan **dos marcas concurrentes** de las últimas entregas y cierre global exactamente una vez, exigidos por CC-022 §6 y el DoD. |

**CI del SHA R6**: run `38162310109`, `db-tests` ✅ 21 archivos/1.972 tests, runner H08 ✅ 8/8; demás jobs técnicos verdes, `approval-policy` ❌. No se ejecutó DB mutada propia; los hallazgos nuevos son omisiones de pruebas por inspección contractual independiente, no bugs productivos demostrados.

[Hallazgos](hallazgos.jsonl) · [Evidencia y sondas](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Siguiente acción

Corregir H13/H14 en `supabase/tests/t340_multi_drop.sql` y `supabase/tests/integration/t340_concurrency.mjs` (archivos autorizados para paso 1), CI verde del nuevo SHA y siguiente ronda independiente. **No hay nueva decisión de alcance**; la opción A de Lautaro073 ya autorizó el harness y CI. No aprobar, mergear ni empezar paso 2 sin revisión sin bloqueantes + checkpoint post-merge en Develop.
