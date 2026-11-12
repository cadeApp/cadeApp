# PR #708 — T-433 · SEC-08: secretos independientes para cron y push

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/708 |
| **Tarea** | T-433 / #666 · SEC-08 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-433-sec08-cron-secret` → `develop` |
| **Base verificada** | `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1` |
| **Código productivo** | `d0096c1df7c2d27225c4cb901675cdfefadad1d3` (no cambió en R2) |
| **SHA R2 revisado** | `0d5616b8e7efa85325a2ddeda31a773f4cb838a0` |
| **Estado** | **Ronda 2: SIN BLOQUEANTES DE CÓDIGO**. H01 corregido y contrastado por revisión independiente limitada; **D3-A pendiente bloquea merge**. CI `db-tests` aún corriendo al documentar. |

## Rondas

| Ronda | SHA revisado | Hallazgos / estado | Informe |
|---|---|---|---|
| 1 | `e61a9e31` | H01 alto / abierto | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `0d5616b8` | H01 `arreglado-verificado` por inspección independiente, Node aislado y CI unit exact-head; **0 nuevos** | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR708-H01 | Rechazos solo por longitud, sin comprobar contenido | alto | **arreglado-verificado** en `0d5616b8` (alcance de verificación en R2) |

[Datos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Pendientes ajenos al código

1. **D3-A — humano obligatorio**: Lautaro073 registra en [#666](https://github.com/cadeApp/cadeApp/issues/666) sí/no de la doble verificación de Vercel Develop y el secreto efectivo de GitHub Actions `develop` (ambos ≥32 caracteres y coincidentes; cron sin 401 tras rotación, si aplica). No leer ni imprimir valores.
2. `db-tests` de GitHub CI para `0d5616b8` figuraba `in_progress` durante la observación. Antes del merge corroborar su conclusión. No exigir un CI nuevo solamente por la incorporación de los archivos de revisión.
3. Staging y producción tienen checkpoints D3-A separados antes de sus promociones.

No aprobar ni mergear desde la revisión.
