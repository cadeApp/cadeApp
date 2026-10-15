# PR #360 — T-359 · Revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/360 · Autor: @asako669 · Rama: `feat/T-359-detalle-merchant-post-aceptacion` → `develop`.

## Rondas

| Ronda | HEAD del autor inspeccionado | Estado | Informe |
|---|---|---|---|
| 1 | `325a9a6a09de404efedd40ad1ee5728e5d9f218f` | CON BLOQUEANTES | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `aacf8291fdb331da53b94fa7471679b2792f5ecf` | CON BLOQUEANTES | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `19439be7962e8f1b8cde4b02c910f7bbfd717577` | **CON BLOQUEANTES** | [ronda-3.md](revisiones/ronda-3.md) |

## Hallazgos

| ID | Severidad | Estado al cerrar ronda 3 |
|---|---|---|
| PR360-H01 | alto | arreglado-sin-verificar |
| PR360-H02 | alto | arreglado-sin-verificar |
| PR360-H03 | medio | arreglado-sin-verificar |
| PR360-H04 | medio | arreglado-sin-verificar |
| PR360-H05 | alto | parcial |
| PR360-H06 | medio | arreglado-sin-verificar |
| PR360-H07 | medio | parcial |
| PR360-R01 | medio | parcial |
| PR360-R02 | alto | abierto |

**Bloqueantes actuales:** H05 (flujo E2E incompleto/sin corrida), R01 (clasificación de ganador aún ambigua), R02 (Back mal especificado). **Pendiente de proceso:** H07 (evidencia RED/GREEN incompleta). Los arreglos H01/H02/H03/H04/H06 se consideran implementados por inspección + GREEN unit, **NO verificados mediante mutación independiente**.

**Decisión humana ya resuelta:** B: terminales `cancelled/expired` conservan detalle seguro sin botones; implementado, no reabrir.

**CI del SHA 19439be7:** checks unit/typecheck/lint/build/db-tests/audit/bundle-budget SUCCESS, sin e2e-preview, approval-policy FAILURE (falta aprobación vigente del propietario). No aprobar ni mergear hasta completar la revisión y E2E.

Ver [hallazgos.jsonl](hallazgos.jsonl), [lecciones.md](lecciones.md) y [evidencia/comandos.md](evidencia/comandos.md).
