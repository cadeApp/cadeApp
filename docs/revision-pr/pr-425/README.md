# PR #425 — T-373 · Historial seguro de cancelaciones del repartidor tras reasignación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/425 |
| **Tarea** | T-373 (Fase 3 — calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-373-historial-cancelaciones` → `develop` |
| **Base** | `9f1d1a6f335915b723d6fe98763990d3097706f4` |
| **Implementación revisada** | `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f` |
| **Head documental al iniciar ronda 2** | `e1fa4748a662cc623c58866f0c350d084c287562` |
| **Tamaño** | 25 archivos, +1148/-15 líneas contra `origin/develop` |
| **Estado** | abierta, Draft, bloqueada por 1 hallazgo nuevo; A01 y H01 verificados |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `8e9ada09b10cbd38ab684909b62fab2c337c167d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f` | 2 resueltos, 1 bloqueante nuevo, 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR425-A01 | Dos tests estaban fuera del alcance autorizado en `origin/develop` | alto | arreglado-verificado en `2c38dad5` |
| PR425-H01 | Faltaba el caso de dos cancelaciones y un oráculo de orden visible | alto | arreglado-verificado en `2c38dad5` |
| PR425-H02 | Un fallo interno del detalle puede mostrarse como una asignación cancelada | alto | abierto |
| PR425-H03 | El detalle del comercio consulta historial aunque vaya a descartarlo o redirigir | bajo | abierto (mejora) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Resolver PR425-H02 conservando el código de error de `get_trip_details` y usando el fallback histórico solo para
   estados/denegaciones esperados, nunca para `INTERNAL_ERROR`.
2. Evitar la RPC de historial en ramas de `/merchant/requests/[id]` que no la renderizan o redirigen (PR425-H03).
3. Agregar RED/GREEN dirigido, ejecutar la batería general y pedir ronda 3 sobre un nuevo SHA.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una regla nueva: ambos hallazgos ya están cubiertos por reglas vigentes de alcance y sensibilidad de pruebas.
