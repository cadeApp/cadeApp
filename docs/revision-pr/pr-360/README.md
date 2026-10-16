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

**Ronda 8: la rama ya incorporó develop con merge normal** (`1c8182ed`) y su HEAD de autor es `fc5b0a01`. Los checks unit/DB/build/lint/typecheck/audit/bundle y `approval-policy` pasaron. **Pero el nuevo E2E no se ejecutó:** run [38951040659](https://github.com/cadeApp/cadeApp/actions/runs/38951040659), intentos 1–3 cancelados antes de cualquier paso Playwright; el commit status `e2e-preview=error` NO es PASS de producto. El E2E anterior [38945199224](https://github.com/cadeApp/cadeApp/actions/runs/38945199224) conserva valor histórico (76+3 PASS, SHA `6d2c4337`) pero no prueba la composición post-merge. H05 vuelve a `parcial` por validación actual pendiente; R03 sigue corregido por inspección, sin mutaciones independientes. GitHub `mergeable:true`; develop avanzó solo una confirmación posterior (`01054b14`) sin conflicto comprobado. No hacer merge hasta Playwright GREEN en HEAD actual/final.

**Decisión humana B ya cerrada:** cancelled/expired como terminales seguros en el mismo detalle. **La revisión no aprueba ni mergea.** `approval-policy` pasó con aprobación explícita de Lautaro073 en SHA fc5b0a01; nuevos commits de revisión podrían requerir renovación.

Ver [hallazgos.jsonl](hallazgos.jsonl), [lecciones.md](lecciones.md) y [evidencia/comandos.md](evidencia/comandos.md).
