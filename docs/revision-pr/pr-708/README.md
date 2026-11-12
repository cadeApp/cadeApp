# PR #708 — T-433 · SEC-08: secretos independientes para cron y push

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/708 |
| **Tarea** | T-433 · #666 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-433-sec08-cron-secret` → `develop` |
| **Base** | `dba3314f17f2068b6ff0c7596476d81c2c92e1c1` |
| **Código** | `d0096c1df7c2d27225c4cb901675cdfefadad1d3` |
| **Head examinado** | `e61a9e318208cf3385f80f4eadb8af95c304799e` (solo agrega bitácora al código anterior) |
| **Tamaño** | 7 archivos, +157 / -32 |
| **Estado** | **Ronda 1 con un bloqueante de test (H01)**; no mergear. Gate D3-A independiente pendiente. |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e61a9e31` (`d0096c1d` código) | 1 alto / 1 bloqueante | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR708-H01 | Los negativos de autorización solo ejercen diferencia de longitud; la comparación de contenido puede desaparecer sin fallar | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y arnés](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Para cerrar

1. Corregir H01 **solo en `src/app/api/push/send/route.test.ts`**: secretos de igual longitud y un token erróneo de igual longitud; probar mutación RED antes de GREEN.
2. Registrar los resultados reales en `docs/tasks/log/T-433.md`, sin marcar hallazgos de revisión como verificados.
3. Revisión independiente ronda 2, con ejecución real del arnés en un worktree limpio; si el entorno lo impide, dejarlo dicho.
4. **Gate D3-A ajeno a este review:** Lautaro073 registra en [#666](https://github.com/cadeApp/cadeApp/issues/666) la doble verificación de Develop (Vercel y secret efectivo de Actions), sin revelar valores, antes del merge. Staging/producción antes de cada promoción.
