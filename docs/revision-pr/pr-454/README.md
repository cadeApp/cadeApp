# PR #454 — T-384 · CC-033 alta posterior de documentos opcionales

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/454 |
| Tarea | T-384 (Fase 3), CC-033 |
| Autor | @Lautaro073 |
| Rama | `feat/T-384-cc033-optional-document` → `develop` |
| Base revisada | `03dec5b074e634d6f3895c282e58f7d7e6eb4456` |
| HEAD revisado | `cc87a902e30c5c2f452e80edb34ca78dac396ab3` |
| Tamaño | 9 archivos, +571 / -12 líneas |
| Estado | **Draft, CON BLOQUEANTES (6)**; no aprobar ni mergear |

## Rondas
| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cc87a902e30c5c2f452e80edb34ca78dac396ab3` | 6 bloqueantes, 0 mejoras | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo
| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | pgTAP solo comprueba la existencia de la RPC | alto | abierto |
| H02 | Falta la suite de concurrencia y su integración a CI | alto | abierto |
| H03 | La validación SQL permite valores no canónicos y no devuelve el error de contrato | medio | abierto |
| H04 | El fake carece de matriz funcional y unit falla por cobertura | alto | abierto |
| H05 | El test del wrapper no verifica qué RPC ni qué payload se envía | medio | abierto |
| H06 | database.types.ts fue editado manualmente y aún no hay prueba de drift | alto | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md)

## Qué falta
Completar pgTAP, concurrencia multisesión con mutación real, validar parámetros SQL nulos y formato, ampliar pruebas de fake/wrapper sin adulterar assertions, restituir cobertura y confirmar drift de tipos por CI. Revisión nueva del SHA que publique el agy. No hay decisiones 🔵 nuevas: CC-033 aprobado ya resuelve los comportamientos de producto.

## Limitaciones
Se inspeccionaron los archivos publicados mediante GitHub y el CI del SHA. No fue posible clonar GitHub desde el entorno de revisión (DNS), por lo que no hubo ejecución local de Vitest, git merge-tree ni mutaciones de PostgreSQL. No se informa ninguna reproducción runtime no ejecutada.
