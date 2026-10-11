# PR #317 — T-340 · Paso 1/4 — Esquema, puente legacy y backfill

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · **Autor:** @asako669 (P2) · **Rama:** `feat/T-340-varias-entregas` → `develop`  
**Estado:** 🔴 CON BLOQUEANTES — NO MERGEAR

## Rondas independientes

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes vigentes | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `d2b3285a` | **2 bloqueantes: H08 y H13** | [Ronda 4](revisiones/ronda-4.md) |

## Estado acumulado

| ID | Estado después de R4 |
|---|---|
| H01–H07 | arreglados-verificados |
| **H08** | **ABIERTO (alto)** — falta concurrencia de dos sesiones contra `publish_request`; se requiere decidir ampliación mínima de tests/CI. |
| H09–H12 | arreglados-verificados (H09 se rectificó por la interpretación contractual corregida en H10). |
| **H13** | **ABIERTO (alto)** — `mark_drop_delivered` / `mark_drop_failed` solo se verifican con `has_function` en pgTAP. |

**Rectificación de revisión previa:** la recomendación de la ronda 2 de excluir históricos con medios de pago anómalos fue contraria a CC-022 §5b y se corrigió explícitamente en ronda 3. La implementación actual normaliza históricos como dicta el CC, comprobado en CI de R4.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia/Comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Próximo paso

H08 requiere autorización de Lautaro073 para extender la prueba concurrente a un runner autónomo y su invocación de CI; H13 se corrige en la suite pgTAP ya permitida. No mergear ni comenzar paso 2 hasta cerrar ambas y comprobar rollout post-merge en Develop.
