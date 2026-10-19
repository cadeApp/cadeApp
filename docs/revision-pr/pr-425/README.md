# PR #425 — T-373 · Historial seguro de cancelaciones del repartidor tras reasignación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/425 |
| **Tarea** | T-373 (Fase 3 — calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-373-historial-cancelaciones` → `develop` |
| **Base** | `9f1d1a6f335915b723d6fe98763990d3097706f4` |
| **Implementación revisada** | `cbf5709299522fc306b0d6dae510f03ee763f6ec` |
| **Head documental al iniciar ronda 4** | `0810a2890b41e5ac2283bd664c82475bec2deb68` |
| **Tamaño** | 31 archivos, +1905/-16 líneas contra `origin/develop` en el SHA de implementación |
| **Estado** | abierta, Draft, sin bloqueantes de revisión; A01 y H01-H04 verificados |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `8e9ada09b10cbd38ab684909b62fab2c337c167d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f` | 2 resueltos, 1 bloqueante nuevo, 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `9ab27a099e36d4abf0c4dae5716d32d0ead88edb` | 2 resueltos, 1 bloqueante nuevo | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `cbf5709299522fc306b0d6dae510f03ee763f6ec` | 1 resuelto, sin hallazgos nuevos | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR425-A01 | Dos tests estaban fuera del alcance autorizado en `origin/develop` | alto | arreglado-verificado en `2c38dad5` |
| PR425-H01 | Faltaba el caso de dos cancelaciones y un oráculo de orden visible | alto | arreglado-verificado en `2c38dad5` |
| PR425-H02 | Un fallo interno del detalle puede mostrarse como una asignación cancelada | alto | arreglado-verificado en `9ab27a09` |
| PR425-H03 | El detalle del comercio consulta historial aunque vaya a descartarlo o redirigir | bajo | arreglado-verificado en `9ab27a09` |
| PR425-H04 | Un fallo interno del historial se presenta como «Viaje no encontrado» al repartidor histórico | alto | arreglado-verificado en `cbf57092` |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

No quedan bloqueantes, mejoras ni decisiones abiertas de esta revisión. El autor debe actualizar el informe/cuerpo del
PR con la ronda 4 para que `approval-policy` evalúe el estado final; después, el dueño puede decidir el merge cuando
todos los checks requeridos estén verdes.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una regla nueva: los hallazgos están cubiertos por las reglas vigentes
de alcance, sensibilidad de pruebas y estados de error.
