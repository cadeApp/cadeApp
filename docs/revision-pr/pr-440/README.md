# PR #440 — T-378 · Flecha para volver en viaje y error de oferta en rojo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/440 |
| Tarea | T-378 · Fase 3 · Issue #439 |
| Autor | @Lautaro073 |
| Rama | `fix/T-378-trip-back-offer-error` → `develop` |
| Base | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| Tamaño | 18 archivos (13 implementación/tarea y 5 documentación de revisión antes de R2) |
| Estado | Abierta (Draft). Ronda 2 SIN BLOQUEANTES DE CÓDIGO; gates db-tests/e2e-preview aún pendientes al registrar la ronda |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9e1380239986eda5d7b43c5b1d7949ab6de9c93e` | 1 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `0588a5f26d125a5bd83da606d5d11d30fc57fafd` | 0 nuevos; H01 cerrada | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR440-H01 | Los tests del regreso no verifican la flecha ni los 48 px | Medio | Arreglado-verificado (inspección + CI + mutaciones sintéticas) |

[hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. No se requieren más cambios de implementación ni pruebas para PR440-H01.
2. Completar el gate oficial: `db-tests` y `e2e-preview`, pendientes en el momento de publicación del informe; confirmar sus conclusiones y que son del SHA evaluado o de un nuevo HEAD de solo documentación.
3. `approval-policy` estaba rojo a falta de informe sin bloqueantes: comprobar el resultado posterior al comentario de cierre.
4. La PR permanece Draft; Lautaro073 decide cuándo quitar Draft y mergear. No merge realizado por el revisor.
5. La evidencia RED con Vitest fue proporcionada por el autor (bitácora); la comprobación independiente aquí fue estática, con mutaciones en memoria, más el unit GREEN verificado en CI. No presentar aquello como Vitest independiente.

## Para el análisis posterior

Ver [lecciones.md](lecciones.md).