# PR #360 — T-359 · Detalle del comercio post-aceptación

**PR:** https://github.com/cadeApp/cadeApp/pull/360 · **Autor:** @asako669 · **Fecha:** 2026-10-15
**HEAD revisado:** `325a9a6a09de404efedd40ad1ee5728e5d9f218f` · **Base develop:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`
**Rama:** `feat/T-359-detalle-merchant-post-aceptacion` · **Estado:** Draft, CON BLOQUEANTES (3 altos, 4 medios)

## Ronda

| Ronda | SHA | Informe |
|---|---|---|
| 1 | `325a9a6a09de404efedd40ad1ee5728e5d9f218f` | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Prioridad | Tema | Estado |
|---|---|---|---|
| PR360-H01 | alto | Los estados cancelled/expired no ofrecen vista terminal B | abierto |
| PR360-H02 | alto | ALREADY_MATCHED deja abierta la aceptación obsoleta | abierto |
| PR360-H03 | medio | El botón Aceptar no contempla vencimiento por expiresAt | abierto |
| PR360-H04 | medio | La navegación usa push y no acredita back/refresh sin ofertas obsoletas | abierto |
| PR360-H05 | alto | Falta el E2E de dos sesiones aisladas y post-match | abierto |
| PR360-H06 | medio | Tests incompletos para draft, terminal y estados stale | abierto |
| PR360-H07 | medio | Bitácora WIP y autorrevisión declaran evidencia que no existe | abierto |

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md) y [lecciones.md](lecciones.md).

**Decisión de Lautaro073: B**, para `cancelled/expired` se conserva la ruta y se muestra resumen terminal seguro sin selector ni botón Aceptar.

**Lo ya bien implementado por agy en este SHA (por inspección):** aceptación navega a `/trips/{id}`; redirección server de matched/in_transit/delivered; links de dashboard para viajes activos; filtrado de ofertas accepted/rejected; reporte no-show va a solicitudes. No se declaran verificados por pruebas ejecutadas.

**Pendiente:** corrección de hallazgos, controles RED/GREEN independientes y E2E Preview de 2 sesiones con run real. El autor debe hacer `git pull` antes de modificar, porque esta carpeta se agrega mediante commit de revisión.
