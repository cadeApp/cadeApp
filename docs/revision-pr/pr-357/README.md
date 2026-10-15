# PR #357 — T-361 · Mensajes naturales de WhatsApp al destinatario

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/357 |
| Tarea | T-361 · Issue #348 · Fase 3 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-361-whatsapp-destinatario-natural` → `develop` |
| SHA implementado revisado | `3dad94b0039c7676838b7dfb82209b0798079711` |
| Base original | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| develop al consultar | `e1c3074b575ea7db17b661abac687f1c6e292c63` (13 commits por delante de la base de la PR) |
| Diff | 6 archivos, +177 / -40 |
| Estado | CON BLOQUEANTES (5) — NO MERGEAR |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3dad94b` | 5 bloqueantes + 1 mejora | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---|---|
| PR357-H01 | Multi-drop ignora estado de cada drop y comunica falsamente «en camino» | alto | abierto |
| PR357-H02 | Comercio usa primera persona del repartidor | alto | abierto |
| PR357-H03 | E2E exige importe/efectivo retirados del texto | alto | abierto |
| PR357-H04 | Sin evidencia E2E Preview de T-361 por SHA | alto | abierto |
| PR357-H05 | API acepta status omitido y emite «en camino» por defecto | medio · mejora | abierto |
| PR357-H06 | Bitácora afirma RED→GREEN sin evidencia reproducible de los casos | medio · bloqueante de evidencia | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Comandos/evidencia: [evidencia/comandos.md](evidencia/comandos.md).

## Decisiones de Lautaro073 confirmadas

- **1-C:** conservar ambos accesos (comercio y cadete) mediante una única función parametrizada por emisor; comercio redacta en tercera persona.
- **2-A:** mensaje específico por estado individual `pending` / `delivered` / `failed` de cada drop; cadete asignado conserva contacto autorizado incluso en drop fallido.

Estas decisiones anteceden el cierre y NO equivalen a implementación ni aprobación de código.

## Pendiente

El agy debe integrar `origin/develop` mediante merge (sin rebase), corregir solo archivos autorizados por T-361, reproducir RED→GREEN genuino, ejecutar E2E Preview, registrar SHA/run/resultados y solicitar segunda ronda independiente. El autor NO modifica `docs/revision-pr/**`. Ni aprobación ni merge realizados por la revisión.
