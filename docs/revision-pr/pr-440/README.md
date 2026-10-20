# PR #440 — T-378 · Flecha para volver en viaje y error de oferta en rojo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/440 |
| Tarea | T-378 · Fase 3 · Issue #439 |
| Autor | @Lautaro073 |
| Rama | `fix/T-378-trip-back-offer-error` → `develop` |
| Base | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| Tamaño | 13 archivos, +248/-19 líneas |
| Estado | Abierta (Draft). Ronda 1 con un hallazgo bloqueante de cobertura y CI build verde al HEAD nuevo |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9e1380239986eda5d7b43c5b1d7949ab6de9c93e` | 1 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR440-H01 | Los tests del regreso no verifican la flecha ni los 48 px | Medio (bloqueante de DoD) | Abierto |

[hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. Autor: reforzar las dos pruebas de navegación para detectar eliminación del SVG y del área táctil de 48 px; demostrar RED→GREEN sin adulterar pruebas ni el código.
2. Revisora independiente: repetir las comprobaciones sobre el próximo SHA y cerrar H01 si pasan.
3. CI: el build oficial pasó en el nuevo HEAD `9e138023`. El fallo anterior de `next/font` afectó a `b1a58e9` y no se reprodujo en el nuevo commit; no se atribuye a la PR.
4. Esperar `e2e-preview` y `db-tests` que continuaban pendientes al consultar el SHA. No mergear Draft.

La ficha T-378 **no existe en develop** en este SHA base; el autor documentó autorización para sumar ficha e implementación juntas y, en el segundo commit, el motivo del cambio de repartidor por pedido de Lautaro073. El tercer objetivo se revisa aquí, sin generalizar la excepción.

## Para el análisis posterior

Ver [lecciones.md](lecciones.md).