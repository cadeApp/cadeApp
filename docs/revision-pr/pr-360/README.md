# PR #360 — T-359 · Revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/360 · **Autor:** asako669 (P2) · **rama:** `feat/T-359-detalle-merchant-post-aceptacion` → `develop`.

**Ubicación de entregables:** `docs/revision-pr/pr-360/` en **la rama de esta PR**, según las reglas de revisión suministradas por Lautaro073 que reemplazan la tabla antigua de `COMO-ENTREGAR.md`. Las rondas 1–3 ya se encontraban acá; ronda 4 se copió sin alterar su informe desde `docs/revisiones`, donde se había archivado erróneamente. La ronda 5 vuelve a la rama de la PR. La carpeta la administra el revisor, nunca el agy.

## Rondas

| Ronda | HEAD del autor inspeccionado | Conclusión | Informe |
|---|---|---|---|
| 1 | `325a9a6a09de404efedd40ad1ee5728e5d9f218f` | Con bloqueantes | [ronda-1](revisiones/ronda-1.md) |
| 2 | `aacf8291fdb331da53b94fa7471679b2792f5ecf` | Con bloqueantes | [ronda-2](revisiones/ronda-2.md) |
| 3 | `19439be7962e8f1b8cde4b02c910f7bbfd717577` | Con bloqueantes | [ronda-3](revisiones/ronda-3.md) |
| 4 | `efb22c421b1ded80f48380fef4edc9e4981831f5` | Sin nuevos bloqueantes de código; E2E bloqueado | [ronda-4](revisiones/ronda-4.md) |
| 5 | `e1e7e53ee1c50bdfa89468132ff5194d6b781860` | **Con bloqueo de validación E2E; sin cambios de código** | [ronda-5](revisiones/ronda-5.md) |
| 6 | `ceb1161b07f1419992e764bbe17db9a28ea2fc2e` | **CON BLOQUEANTE R03: E2E real falla** | [ronda-6](revisiones/ronda-6.md) |
| 7 | `6d2c433711ed7a8aa562dfd75099029edf82c888` | **R03 corregido; E2E en verde; pendiente revalidación con develop avanzado** | [ronda-7](revisiones/ronda-7.md) |
| 8 | `fc5b0a0152b48c7d6716b3b0a0c975746e504ebc` | **Sin defectos nuevos de implementación por inspección; E2E nuevo cancelado tres veces** | [ronda-8](revisiones/ronda-8.md) |
| 9 | `c4eb0c4b864c966e5306ff9daa2a0d454cbaea44` | **CON BLOQUEANTE R04: E2E REAL falla porque la UI no muestra medio de pago** | [ronda-9](revisiones/ronda-9.md) |

## Hallazgos actuales

| ID | Severidad | Estado |
|---|---|---|
| PR360-H01 | alto | arreglado-sin-verificar |
| PR360-H02 | alto | arreglado-sin-verificar |
| PR360-H03 | medio | arreglado-sin-verificar |
| PR360-H04 | medio | arreglado-sin-verificar |
| PR360-H05 | alto | parcial |
| PR360-H06 | medio | arreglado-sin-verificar |
| PR360-H07 | medio | arreglado-sin-verificar |
| PR360-R01 | medio | arreglado-sin-verificar |
| PR360-R02 | alto | arreglado-sin-verificar |
| PR360-R03 | alto | arreglado-sin-verificar |
| PR360-R04 | alto | abierto |

**Ronda 9:** la ejecución auténtica [38965095162](https://github.com/cadeApp/cadeApp/actions/runs/38965095162) (job `117270529209`) sobre `c4eb0c4b` dio **77 PASS, 1 FAIL reproducido, 1 flaky (T-360)**. El caso T-359 se detiene en `main-flow.spec.ts:257` porque **TripMerchantView no muestra el medio de pago** en pantalla. Antes el selector coincidía incidentalmente con el mensaje al destinatario, modificado legítimamente por T-361. Bloqueante **PR360-R04 (alto, abierto)**. R03 sigue corregido por inspección, H05 parcial y validación E2E completa del HEAD pendiente. **Decisión nueva necesaria** sobre UI: A global solo en single, B adaptar únicamente test (no recomendado), C visualización single-drop y por destinatario multi-drop (recomendado). No aprobar/mergear. Develop avanzó también; volver a verificar base después del arreglo.

**Decisión humana B ya cerrada:** cancelled/expired como terminales seguros en el mismo detalle. **La revisión no aprueba ni mergea.** `approval-policy` pasó con aprobación explícita de Lautaro073 en SHA fc5b0a01; nuevos commits de revisión podrían requerir renovación.

Ver [hallazgos.jsonl](hallazgos.jsonl), [lecciones.md](lecciones.md) y [evidencia/comandos.md](evidencia/comandos.md).
