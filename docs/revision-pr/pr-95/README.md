# PR #95 — T-310 · Backups, observabilidad y simulacro de restauración

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/95 |
| **Tarea** | T-310 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-310-backups-observabilidad` → `develop` |
| **Base** | `cd0e69dabd31aa6531fa212d47a90c47e86ef155` |
| **Head revisado** | `56f9c968a797f41f23eaf2dc325e7554006f93f6` |
| **Tamaño** | 10 archivos, +859 / -4 |
| **Estado** | abierta · Draft · CON BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `56f9c968` | 8 bloqueantes técnicos + 4 decisiones (2 aceptadas, 2 pendientes) | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El scrubber deja pasar direcciones reales y coordenadas exactas | alto | abierto |
| H02 | Los tests de privacidad no inspeccionan el payload que sale por red | alto | abierto |
| H03 | La alerta de prueba puede informar éxito sin haber entregado nada | alto | abierto |
| H04 | El acta tiene una cronología imposible y no respalda el DoD | alto | abierto |
| H05 | La fase roja y los tests documentales no demuestran cada regla nueva | alto | abierto |
| H06 | El chequeo de uptime no tiene timeout real | alto | abierto |
| H07 | El runbook describe incorrectamente la restauración PITR de Supabase | alto | abierto |
| H08 | La bitácora contradice los checks reales del SHA | medio | abierto |
| H09 | Canal de alertas: Discord vs email del master plan | decisión | aceptado por Lautaro073: Discord |
| H10 | Wiring end-to-end fuera de los archivos permitidos | decisión | decision-pendiente |
| H11 | Frecuencia trimestral de simulacros no estaba decidida | decisión | decision-pendiente |
| H12 | Sentry/@sentry/nextjs vs “sin dependencias nuevas” | decisión | aceptado por Lautaro073: no Sentry ahora |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir H01–H08 con pruebas que fallen antes y pasen después.
2. No reemplazar Discord por email ni instalar Sentry: Lautaro073 decidió Discord-only por ahora; un DSN compatible queda opcional/futuro.
3. Resolver H10: integrar ahora los callers/scheduler ampliando alcance, o declarar esta tarea como infraestructura y abrir una tarea de wiring obligatoria.
4. Resolver H11: quitar “trimestral” o aprobar formalmente esa cadencia.
5. Repetir la revisión independiente sobre el nuevo SHA.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md).
