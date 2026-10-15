# PR #357 — T-361 · Mensajes naturales de WhatsApp al destinatario

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/357 |
| Tarea | T-361 · Issue #348 · Fase 3 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-361-whatsapp-destinatario-natural` → `develop` |
| SHA implementado revisado | R1: `3dad94b` · R2: `7909e3b` · R3: `ea33a97`; último cambio en código: `5da667c` |
| Base original | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| develop al consultar | R1: `e1c3074` · R2: `3b9f409` (incorporado a la rama) |
| Diff | 13 archivos con respecto a develop; última corrección modificó 4 archivos |
| Estado | R3 SIN BLOQUEANTES de código; E2E del último commit de código verde, approval-policy requiere acción humana |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3dad94b` | 5 bloqueantes + 1 mejora | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `7909e3b` | regresión R01; H06 evidencia pendiente; E2E global rojo | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `ea33a97` | 7/7 hallazgos cerrados con límites documentados | [revisiones/ronda-3.md](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---|---|
| PR357-H01 | Multi-drop ignora estado de cada drop y comunica falsamente «en camino» | alto | arreglado-verificado (R3; ver JSONL) |
| PR357-H02 | Comercio usa primera persona del repartidor | alto | arreglado-verificado (R3; ver JSONL) |
| PR357-H03 | E2E exige importe/efectivo retirados del texto | alto | arreglado-verificado (R3; ver JSONL) |
| PR357-H04 | Sin evidencia E2E Preview de T-361 por SHA | alto | arreglado-verificado (R3; ver JSONL) |
| PR357-H05 | API acepta status omitido y emite «en camino» por defecto | medio · mejora | arreglado-verificado (R3; ver JSONL) |
| PR357-H06 | Bitácora afirma RED→GREEN sin evidencia reproducible de los casos | medio · bloqueante de evidencia | arreglado-verificado (R3; ver JSONL) |

| PR357-R01 | CTA WhatsApp repite el nombre en pantalla y hace ambiguos 2 E2E T-340 | alto | arreglado-verificado (R3; ver JSONL) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comandos/evidencia: [evidencia/comandos.md](evidencia/comandos.md).

## Decisiones de Lautaro073 confirmadas

- **1-C:** conservar ambos accesos (comercio y cadete) mediante una única función parametrizada por emisor; comercio redacta en tercera persona.
- **2-A:** mensaje específico por estado individual `pending` / `delivered` / `failed` de cada drop; cadete asignado conserva contacto autorizado incluso en drop fallido.

Estas decisiones anteceden el cierre y NO equivalen a implementación ni aprobación de código.

## Pendiente

Ronda 3: sin hallazgos de código abiertos. E2E completo verde en `5da667c` y CI verde en HEAD documental `ea33a97`. Run E2E 38783885818 iniciado contra el HEAD documental estaba en progreso al terminar la revisión. Lautaro073 debe aprobar manualmente luego de completar la revisión y confirmar checks actualizados. No aprobar ni mergear por el revisor.
