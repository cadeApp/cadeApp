# PR #357 — T-361 · Mensajes naturales de WhatsApp al destinatario

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/357 |
| Tarea | T-361 · Issue #348 · Fase 3 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-361-whatsapp-destinatario-natural` → `develop` |
| SHA implementado revisado | R1: `3dad94b0039c7676838b7dfb82209b0798079711` · R2: `7909e3bca66e29980b3bd6bb9b3c536844143f1a` |
| Base original | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| develop al consultar | R1: `e1c3074` · R2: `3b9f409` (incorporado a la rama) |
| Diff | 6 archivos, +177 / -40 |
| Estado | CON BLOQUEANTES — NO MERGEAR; Ronda 2: regresión PR357-R01 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3dad94b` | 5 bloqueantes + 1 mejora | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `7909e3b` | regresión R01; H06 evidencia pendiente; E2E global rojo | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---|---|
| PR357-H01 | Multi-drop ignora estado de cada drop y comunica falsamente «en camino» | alto | parcial |
| PR357-H02 | Comercio usa primera persona del repartidor | alto | arreglado-verificado (E2E Flujo 5) |
| PR357-H03 | E2E exige importe/efectivo retirados del texto | alto | arreglado-verificado (E2E Flujo 5) |
| PR357-H04 | Sin evidencia E2E Preview de T-361 por SHA | alto | parcial (T-361 verde, suite global roja) |
| PR357-H05 | API acepta status omitido y emite «en camino» por defecto | medio · mejora | arreglado-sin-verificar |
| PR357-H06 | Bitácora afirma RED→GREEN sin evidencia reproducible de los casos | medio · bloqueante de evidencia | parcial |

| PR357-R01 | CTA WhatsApp repite el nombre en pantalla y hace ambiguos 2 E2E T-340 | alto | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comandos/evidencia: [evidencia/comandos.md](evidencia/comandos.md).

## Decisiones de Lautaro073 confirmadas

- **1-C:** conservar ambos accesos (comercio y cadete) mediante una única función parametrizada por emisor; comercio redacta en tercera persona.
- **2-A:** mensaje específico por estado individual `pending` / `delivered` / `failed` de cada drop; cadete asignado conserva contacto autorizado incluso en drop fallido.

Estas decisiones anteceden el cierre y NO equivalen a implementación ni aprobación de código.

## Pendiente

En la ronda 2 el agy debe corregir PR357-R01 en las dos vistas WhatsApp preservando texto accesible, correr tests nuevos RED→GREEN, esperar E2E global limpio en nuevo SHA y documentar evidencias reproducibles de H06. No tocar E2E T-340 para hacerlo pasar ni `docs/revision-pr/**`. **Ronda 3** independiente requerida. No aprobación ni merge.
