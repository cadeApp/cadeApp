# PR #304 — T-349 · Control de regresión del aislamiento de CC-007

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/304 |
| Tarea | T-349 (Fase 3) · issue #243 (permanece abierto) |
| Autor | @Lautaro073 |
| Rama | `feat/T-349-cc007-isolation-control` → `develop` |
| Base | `958076db46063b4128f72f52a581b95d7e6bf01f` |
| SHA de código revisado | `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b` |
| Diff inicial | 2 archivos, +77 líneas, 0 eliminaciones |
| Estado | **SIN BLOQUEANTES de código, ronda 2** · db-tests PASS; e2e-preview pendiente al inspeccionar |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b` | 1 bloqueante | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `12c7e9a5fa004e6715a84751b6f9e847b0d9487c` | 0 nuevos; H01 corregido por inspección/CI, sin RED local del repo | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Severidad | Estado | Motivo |
|---|---|---|---|
| PR304-H01 | alto | arreglado-sin-verificar (runtime del repo) | Segunda guarda post-`spawnSync`; ejercicio independiente con proceso hijo sobre 4 rutas, CI unit verde |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Pendientes

1. Confirmar el resultado final de `e2e-preview` sobre SHA `12c7e9a`; no mergear si falla o sigue pendiente.
2. Completar el informe independiente SIN BLOQUEANTES en el cuerpo de PR para que `approval-policy` pueda pasar, además de publicarlo en comentario.
3. #243 se cierra **manualmente después de verificar todo su DoD**, no por `Refs` ni por el merge de la PR.
4. El commit de esta revisión mueve el HEAD: los checks previos corresponden al SHA de implementación, no al commit documental.
