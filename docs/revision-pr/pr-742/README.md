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
| Estado R1 | **CON BLOQUEANTES (4)** · 2 mejoras · sin aprobación ni merge |

## Rondas

| Ronda | SHA de código/documentos revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `a8166b5b0f037c561e8652142e90768cda698b37` | 4 bloqueantes, 2 mejoras | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

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

## Entregables

- [Informe R1](revisiones/ronda-1.md)
- [Hallazgos estructurados](hallazgos.jsonl)
- [Evidencia y script de mutación documental](evidencia/comandos.md)
- [Lecciones](lecciones.md)

La revisión no modifica código, contratos ni la ficha. El autor debe hacer `git pull` antes de corregir; el commit de revisión cambia HEAD y dispara CI nuevamente. No exigir otra CI verde solo por la bitácora; la implementación T-437 sí requerirá pgTAP/E2E reales.
