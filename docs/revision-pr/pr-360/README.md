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
| 10 | `8d5f6a840a2f56b468672698a3ed225e8c937592` | **C implementada y E2E T-359 PASS; RED global por contradicción T-366 (R05 decisión P1)** | [ronda-10](revisiones/ronda-10.md) |

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
| PR360-R04 | alto | arreglado-sin-verificar |
| PR360-R05 | decision | decision-pendiente |

**Ronda 10:** opción C autorizada por P1 en ficha canónica (PR #391 MERGED), implementada por agy en commit funcional `8c90e4b7`, bitácora actualizada en HEAD `8d5f6a84`. Pruebas unitarias por autor 45/45 (RED previo declarado 3 fail/42 pass; no reproducido independientemente); CI [39011124764](https://github.com/cadeApp/cadeApp/actions/runs/39011124764) completamente verde. E2E [39011178930](https://github.com/cadeApp/cadeApp/actions/runs/39011178930) **81 passed / 1 failed**, caso T-359 de dos sesiones PASS, el RED restante viene de **T-366 request-states.spec.ts:1013** al pedir un botón Aceptar visible para solicitud vencida. DoD T-366 prohíbe aceptación vencida y H03 T-359 la oculta. R04 `arreglado-sin-verificar` (sin mutaciones Vitest propias en checkout); R05 `decision-pendiente` para P1. Preferencia técnica: conservar ocultación, corregir E2E de T-366 en PR separada, verificando ausencia de Aceptar y rechazo RPC; no mover una prueba ajena a T-359 sin autorización. El E2E del nuevo HEAD documental está en cola y no sustituye la ejecución anterior. **No apta para merge.**

**Decisión humana B ya cerrada:** cancelled/expired como terminales seguros en el mismo detalle. **La revisión no aprueba ni mergea.** `approval-policy` pasó con aprobación explícita de Lautaro073 en SHA fc5b0a01; nuevos commits de revisión podrían requerir renovación.

Ver [hallazgos.jsonl](hallazgos.jsonl), [lecciones.md](lecciones.md) y [evidencia/comandos.md](evidencia/comandos.md).
