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
| 11 | `c6381ff4ee7de88e183c388d29bf0eac8ddb7d21` | **R05 corregido; SHA funcional anterior CI/E2E GREEN; 1 flaky T-314; nuevo HEAD documental en validación** | [ronda-11](revisiones/ronda-11.md) |

## Hallazgos actuales

| ID | Severidad | Estado |
|---|---|---|
| PR360-H01 | alto | arreglado-sin-verificar |
| PR360-H02 | alto | arreglado-sin-verificar |
| PR360-H03 | medio | arreglado-sin-verificar |
| PR360-H04 | medio | arreglado-sin-verificar |
| PR360-H05 | alto | arreglado-sin-verificar |
| PR360-H06 | medio | arreglado-sin-verificar |
| PR360-H07 | medio | arreglado-sin-verificar |
| PR360-R01 | medio | arreglado-sin-verificar |
| PR360-R02 | alto | arreglado-sin-verificar |
| PR360-R03 | alto | arreglado-sin-verificar |
| PR360-R04 | alto | arreglado-sin-verificar |
| PR360-R05 | decision | arreglado-sin-verificar |

**Ronda 11:** decisión P1 **C en la misma PR #360** autorizada vía PR documental #393 (merge en develop `293c3a27`). Agy hizo merge normal `acff7544` y en `082d6bd6` cambió SOLO el test T-366 §5.1 para exigir ausencia de Aceptar y conservar RPC `REQUEST_EXPIRED`. CI [39014884270](https://github.com/cadeApp/cadeApp/actions/runs/39014884270) **GREEN** (138 suites/2540 unit; 27 archivos/2420 DB). E2E [39014931158](https://github.com/cadeApp/cadeApp/actions/runs/39014931158) **success** en ese SHA funcional: Chromium 81 PASS + **1 flaky T-314** (HTTP 500 dos veces en endpoint de feed; pasó en retry #2), global-settings 3 PASS; T-359/T-360/T-366 pasaron. HEAD de autor `c6381ff4` posterior: **solo bitácora**, sus propios CI y E2E todavía estaban en curso al revisar. Revisor independiente: 6/6 controles ESTÁTICOS, 4/4 mutantes textuales detectados, NO mutaciones runtime. R05 y H05 quedan `arreglado-sin-verificar`; sin bloqueantes nuevos de T-359 por inspección; no certificar checks del SHA posterior hasta que terminen. P1 decide merge después de comprobar gate del HEAD final.

**Decisión humana B ya cerrada:** cancelled/expired como terminales seguros en el mismo detalle. **La revisión no aprueba ni mergea.** `approval-policy` fue SUCCESS en SHA funcional y en SHA documental posterior inspeccionados (según check-runs); cada nuevo commit reabre validaciones. La revisión no aprueba ni mergea.

Ver [hallazgos.jsonl](hallazgos.jsonl), [lecciones.md](lecciones.md) y [evidencia/comandos.md](evidencia/comandos.md).
