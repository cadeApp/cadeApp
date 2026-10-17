# PR #403 — T-367 · Avatar aprobado del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/403 |
| Autor implementación | @asako669 |
| Rama | `feat/T-367-avatar-perfil` → `develop` |
| SHA revisado R1 | `d1af180bbe7a0ac562dfe20fd5ed919aca3aa3c3` |
| Estado | **CON BLOQUEANTES (4)**; no mergear |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d1af180bbe7a0ac562dfe20fd5ed919aca3aa3c3` | 4 bloqueantes, 1 incidencia de proceso remediada por el revisor, 1 mejora | [ronda 1](revisiones/ronda-1.md) |

## Hallazgos

| ID | Estado | Severidad | Motivo |
|---|---|---|---|
| PR403-H01 | Abierto | alto | Path de selfie/DNI puede firmarse como avatar |
| PR403-H02 | Abierto | alto | E2E insuficiente y cancelada |
| PR403-H03 | Abierto | medio | `any` nuevos |
| PR403-H04 | Separado por revisor, pendiente de revalidación de commit | medio | Autorrevisión de agy |
| PR403-H05 | Abierto | medio | DoD/RED no respaldados por evidencia |
| PR403-H06 | Abierto (mejora) | bajo | Filtrar `is_current` en DB |

Datos estructurados en [hallazgos.jsonl](hallazgos.jsonl). Método y comandos en [evidencia/comandos.md](evidencia/comandos.md).
El informe creado por el autor se conserva exclusivamente como [autorrevision-agy-r1.md](revisiones/autorrevision-agy-r1.md).

## Próximo paso

El agy arregla código, tests y bitácora con el prompt del comentario de PR; no puede editar esta carpeta. Tras su push, la revisión ejecuta una ronda 2 independiente. No hay decisiones de alcance pendientes.
