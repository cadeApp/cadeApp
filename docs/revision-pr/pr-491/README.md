# PR #491 — T-312 · Checklist de release staging → main

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/491 |
| Tarea / fase | T-312 · Fase 3 |
| Autor | @Lautaro073 |
| Rama → base | `feat/T-312-release-checklist` → `develop` |
| Base / implementación revisada | `6b1aba74283ab5560f8be875fecd8ea4b35a7bb2` / `3b6810858ead3c7a22b3d365437fb85edd9419b7` |
| Alcance | 2 archivos documentales, +359 / -0 líneas al abrir esta revisión |
| Resultado R1 | **0 bloqueantes de esta PR**; H03/H04 verificados, H01/H02 diferidos por decisión |

## Rondas

| Ronda | SHA de código/documentación revisado | Informe |
|---|---|---|
| 1 | `3b6810858ead3c7a22b3d365437fb85edd9419b7` | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Hallazgos

| ID | Estado | Alcance |
|---|---|---|
| H01 | D1=A — aceptado **fuera de esta PR**, pendiente operativo | Separar health-cron a `production-monitoring` antes del required reviewer |
| H02 | D2=A — aceptado **fuera de esta PR**, pendiente manual | Proteger `main`, `staging`, `develop` |
| H03 | arreglado-verificado | Documentar actor original de re-run |
| H04 | arreglado-verificado | URL fija del health cron y sección de operación |

Datos: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · [`lecciones.md`](lecciones.md).

**No se aprobó ni mergeó la PR.** CI principal del SHA revisado verde; e2e-preview cancelado y sin ejecución de E2E. Pendientes humanos y operativos no están cerrados por este informe.
