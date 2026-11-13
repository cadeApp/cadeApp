# PR #742 — T-437 · CC-052 · B-05

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/742 |
| Autor | @Lautaro073 |
| Tarea | T-437 (PR documental; implementación pendiente) |
| Rama | `feat/T-437-b05-verified-documents` → `develop` |
| Base revisada | `22dff3fa93df5c79b88d8021c1267389b2055666` |
| HEAD revisado | `a8166b5b0f037c561e8652142e90768cda698b37` |
| Alcance observado | 3 archivos documentales: contrato, ficha y fila del plan |
| Estado R1 | **R1: CON BLOQUEANTES (4)**; R2: 2 bloqueantes nuevos · sin aprobación ni merge |

## Rondas

| Ronda | SHA de código/documentos revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `a8166b5b0f037c561e8652142e90768cda698b37` | 4 bloqueantes, 2 mejoras | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5c8095cb42441245e4d12c45456d496bb4c27b73` | 2 bloqueantes nuevos; 1 mejora; ratificación pendiente | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Síntesis | Prioridad | Estado |
|---|---|---|---|
| PR742-H01 | Rehabilitar exige documentos que un rechazado/suspendido no puede recargar por las RPC vigentes | Alto | Abierto |
| PR742-H02 | La UI exige «no purgado» pero su consulta y tipo no contienen `purged_at`; permisos de ficha incompletos | Alto | Abierto |
| PR742-H03 | La mutación RED de UI cubre Aprobar, no Rehabilitar | Medio | Abierto |
| PR742-H04 | CC/ficha conservan D4-A, omiten D5/D6 y no consignan el carácter no ratificado de las seis selecciones | Medio / decisión | Pendiente de reconciliación y ratificación |
| PR742-H05 | Duplicado vigente no es fixture alcanzable con el índice único actual | Bajo | Mejora |
| PR742-H06 | Interacción con purga concurrente no demostrada: cron no comparte lock de couriers | Bajo | Riesgo a verificar |

## Registro expreso de selección automática (no aprobación)

**D1-A, D2-A, D3-A, D4-C, D5-A y D6-A son selecciones automáticas del agente con la opción recomendada. NO constituyen aprobación personal explícita de Lautaro073.** Deben anotarse como tales en el CC/ficha; siguen requiriendo ratificación personal antes de convertirlas en cambios de producto o alcance. D4-C sustituye la D4-A que figura actualmente en el PR; D5 y D6 son adicionales.

- D1-A: los cuatro obligatorios vigentes, verificados y sin purgar.
- D2-A: código nuevo `DOCUMENTS_NOT_VERIFIED`.
- D3-A: deshabilitar Aprobar y Rehabilitar con motivo visible; la RPC manda.
- D4-C: no suspensión/backfill automático; registrar regularización controlada de aprobados existentes.
- D5-A: habilitar subsanación documental autorizada para rechazados/suspendidos sin rehabilitación automática.
- D6-A: ampliar consulta/tipo/tests del detalle admin para alcanzar paridad con `purged_at`.

## Estado tras ronda 2

- SHA verificado documentalmente: `5c8095cb42441245e4d12c45456d496bb4c27b73`.
- R1: H01/H02/H05/H06 **arreglado-verificado (solo documentación)**; H03 **parcial**; H04 **decision-pendiente**.
- R2: **PR742-R01** DNI liberado, **PR742-R02** mutación de Reactivar/Reconsiderar (ambos BLOQUEANTES); **PR742-R03** policy de Storage mal descrita (mejora).
- La descripción de PR **ya contiene D4-C** y D7-A, verificadas por GitHub.
- **D1-A, D2-A, D3-A, D4-C, D5-A, D6-A y D7-A son selecciones automáticas del agente con la opción recomendada, sin aprobación personal explícita de Lautaro073; todas siguen pendientes de ratificación. D8-B es la declaración del agente de que no puede ratificarlas por Lautaro073.**

## Entregables

- [Informe R1](revisiones/ronda-1.md)
- [Informe R2](revisiones/ronda-2.md)
- [Hallazgos estructurados](hallazgos.jsonl)
- [Evidencia y script de mutación documental](evidencia/comandos.md)
- [Lecciones](lecciones.md)

La revisión no modifica código, contratos ni la ficha. El autor debe hacer `git pull` antes de corregir; el commit de revisión cambia HEAD y dispara CI nuevamente. No exigir otra CI verde solo por la bitácora; la implementación T-437 sí requerirá pgTAP/E2E reales.
