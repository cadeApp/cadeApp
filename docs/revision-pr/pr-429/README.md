# PR #429 — T-374 · ficha del timeout E2E de staging

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/429 |
| **Tarea** | T-374 (calidad / operación previa al release) |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-374-staging-e2e-timeout` → `develop` |
| **Base** | `59fb3daa82eb1c0394dca9bad143d7fd246ec34b` |
| **Tamaño funcional revisado** | 2 archivos documentales, +62 líneas |
| **Estado** | Abierta en Draft · ronda 2 SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `78ffecaebb97ae54a43a52d593f66919a2d58aa1` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c07ee34feb75649e2e399676a77371c2c6054d9d` | H01/H02 arreglados y verificados; 0 nuevos | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR429-H01 | La ficha no permitía la ruta genérica de revisión | medio | arreglado-verificado |
| PR429-H02 | Faltaba la fila T-374 del plan | medio | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Esperar que terminen los controles remotos todavía pendientes y exigir todos los checks requeridos en verde.
2. Lautaro073 decide si autoriza el merge de #429 a `develop`; esta revisión no aprueba ni mergea.
3. Solo después del merge corresponde regularizar y revisar nuevamente #427 bajo T-374.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). Los dos hallazgos fueron detectados por `tools/verify-fichas.test.ts` y quedaron cerrados por la misma prueba en ronda 2.
