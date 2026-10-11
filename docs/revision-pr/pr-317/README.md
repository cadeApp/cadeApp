# PR #317 — T-340 · Paso 1/4 — Esquema, puente legacy y backfill

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · **Autor:** @asako669 (P2) · **Rama:** `feat/T-340-varias-entregas` → `develop`  
**Estado:** 🔴 CON BLOQUEANTES — NO MERGEAR

## Rondas independientes

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 nuevos bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes vigentes (H08 + H10–H12) | [Ronda 3](revisiones/ronda-3.md) |

## Estado por hallazgo (ronda 3)

| ID | Estado | Tema |
|---|---|---|
| H01 | arreglado-verificado | Columna inexistente en backfill. |
| H02 | arreglado-verificado | Identidad y consentimiento ficticios. |
| H03 | arreglado-verificado | Aserciones `pass()` reemplazadas. |
| H04 | arreglado-verificado | PgTAP fixtures/plan reales. |
| H05 | arreglado-verificado | Lector reservado para paso 2. |
| H06 | arreglado-verificado | Guard `SECURITY INVOKER` + test estructural. |
| H07 | arreglado-verificado | Tests usan helper productivo. |
| **H08** | **abierto (ALTO)** | Faltan carreras de dos sesiones, no diferibles automáticamente al paso 4. |
| H09 | arreglado-verificado con residual H10 | Auditoría de no-draft sin drop; sin embargo la exclusión incumple CC-022. |
| **H10** | **abierto (ALTO)** | Backfill debía normalizar históricos inválidos, no omitirlos. |
| **H11** | **abierto (ALTO)** | `cash_change_amount` sensible copiado a `audit_log`. |
| **H12** | **abierto (MEDIO)** | `delivered_at` histórico fabricado con timestamps no equivalentes. |

**Rectificación del revisor:** la sugerencia de R2/H09 de excluir y auditar pagos históricos incompatibles resultó contraria a CC-022 §5b, que prescribe normalización y materialización. La ronda 3 identifica y corrige esa dirección técnica.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia/Comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué sigue

Corregir H08, H10, H11 y H12 sólo en el paso 1, aportar pruebas que fallen ante mutaciones del código productivo y CI del nuevo SHA. No mergear ni empezar las otras PR del rollout hasta superar revisión + merge/despliegue/checkpoint de la primera.
