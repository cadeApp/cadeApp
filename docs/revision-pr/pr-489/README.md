# PR #489 — Fase 4 admin · T-400 a T-409

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/489 |
| Autor | @Lautaro073 |
| Rama | `docs/T-400-407-fichas` → `develop` |
| Base revisada | `824c4fdb8a4277220e14b575eaf6a15e40df8406` |
| HEAD R1 | `25ad3cf36cf580bdc632448ad88d926220b1dec6` |
| HEAD R2 | `be515ec74e9f0da54e4f5f709c247250251db840` |
| Alcance | T-400 a T-409 + §8, solo documentos |
| Estado | **CON BLOQUEANTES** — revisión R2 (3 altos, 2 medios; 1 mejora baja) |

## Rondas
| Ronda | SHA de código/documentación revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `25ad3cf36cf5` | 7 altos, 3 medios, 2 bajos | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `be515ec74e9f` | 12 correcciones documentales de R1 y 6 hallazgos nuevos, 5 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |

## Estado
- **PR489-H01**: arreglado-verificado, CI 7/7 + control independiente 10/10 y mutaciones 10/10, SHA `be515ec7`.
- **PR489-H02 a H12**: corrección documental inspeccionada; tareas de implementación siguen pendientes y no se atribuye validación funcional.
- **PR489-H13, H14, H15 (alto)**: especificación incompleta de T-408 (bypass directo con aal2, notas privadas y auditoría append-only).
- **PR489-H16 (medio)**: movimientos de plan sin filtro de acción en T-405.
- **PR489-H17 (medio)**: tareas hijas fuera de permitidos / procedimiento ausente en T-409.
- **PR489-H18 (bajo)**: advertencia contractual para validar SEC-12 sin bloquear un flujo legítimo.

## Decisiones previas vigentes
- D01=C (#498), D02=C (#499), D03=C (tres pestañas). Sin decisiones adicionales de producto para la revisión documental. El futuro CC de T-408 deberá documentar explícitamente la solución de `admin_notes`; no se elige una arquitectura nueva como parte de esta PR.

## Qué falta
1. Corregir únicamente `docs/tasks/T-405.md`, `T-408.md`, `T-409.md` y `docs/implementation-plan.md`.
2. Conservar literalmente la coincidencia primer DoD/celda del plan para las 10 fichas.
3. CI/revisión independiente de R3 sin bloqueantes antes de merge. **No aprobar ni mergear todavía**.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comandos: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).
