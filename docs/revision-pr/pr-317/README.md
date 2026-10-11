# PR #317 — T-340 · Paso 1/4 — Esquema, puente legacy y backfill

**PR:** https://github.com/cadeApp/cadeApp/pull/317 · Autor: asako669 (P2)  
**Rama:** `feat/T-340-varias-entregas` → `develop` · **Estado: CON BLOQUEANTES (1: H15, evidencia RED funcional) — NO MERGEAR**

## Rondas independientes

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 bloqueantes | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `5e2a62c6` | 4 bloqueantes | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `d2b3285a` | 2 bloqueantes | [Ronda 4](revisiones/ronda-4.md) |
| 5 | `09d2a920` | 2 bloqueantes | [Ronda 5](revisiones/ronda-5.md) |
| 6 | `00ec6a77` | 2 bloqueantes | [Ronda 6](revisiones/ronda-6.md) |
| **7** | **`8b38d1a1`** | **1 bloqueante de evidencia (H15)** | **[Ronda 7](revisiones/ronda-7.md)** |

## Estado acumulado

- **H01–H14 arreglados-verificados** mediante inspección independiente y CI sobre SHAs documentados. H13 cierra ahora con 77 pgTAP y los siete controles negativos de actor/eligibilidad; H14 cierra con 3 carreras reales de dos sesiones, y conserva H08 con otras 8.
- **H15 ABIERTO (alto):** la ficha T-340 (en `develop`) exige demostrar RED de los nuevos tests por comportamiento faltante, y la PR lo da por completo, pero la bitácora/CI muestran solo GREEN sin mutaciones negativas ejecutadas de H13/H14. **No se afirma un bug funcional**; la evidencia de aceptación falta.

**CI exacto de R7:** run `38165347809`, `db-tests` job `114546652154`: ✅ 21 archivos / **1.980 tests pgTAP**, **11/11 carreras PostgreSQL** (8 H08 + 3 H14), tipos locales sin drift. Jobs técnicos verdes; `approval-policy` en rojo. Supabase Preview omitida.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia y sondas](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Próximo paso

Agy debe demostrar en CI efímera **mutaciones RED de funciones productivas** para H13/H14 y vuelta a GREEN, sin tocar infraestructura externa ni producción; registrar logs reales en bitácora. Se habilita por el alcance existente de pruebas de DB y workflow limitado a `db-tests`; no hay decisiones de producto nuevas. Luego, ronda 8 independiente. No aprobar/mergear/iniciar paso 2 antes de cierre sin bloqueantes y checkpoint post-merge en Develop.
