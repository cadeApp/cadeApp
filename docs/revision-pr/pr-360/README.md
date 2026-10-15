# PR #360 — T-359 · Revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/360 · **Autor:** @asako669 (P2) · Rama funcional: `feat/T-359-detalle-merchant-post-aceptacion` → `develop`.

**Dónde viven estas revisiones:** rama `docs/revisiones`, conforme a `docs/revision-pr/COMO-ENTREGAR.md` para PR de P2/P3. Las rondas 1–3 fueron añadidas anteriormente, por error de proceso, a la rama funcional; se copia su histórico acá sin tocarla en la ronda 4.

## Rondas

| Ronda | HEAD del autor inspeccionado | Resultado | Archivo |
|---|---|---|---|
| 1 | `325a9a6a09de404efedd40ad1ee5728e5d9f218f` | Con bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `aacf8291fdb331da53b94fa7471679b2792f5ecf` | Con bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `19439be7962e8f1b8cde4b02c910f7bbfd717577` | Con bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `efb22c421b1ded80f48380fef4edc9e4981831f5` | **Sin bloqueantes nuevos de implementación; no mergeable por validación E2E aún no realizada** | [ronda-4.md](revisiones/ronda-4.md) |

## Hallazgos

| ID | Severidad original | Estado ronda 4 |
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

Se usa `arreglado-sin-verificar` cuando CI unit/inspección es suficiente para observar el cambio pero el revisor no ejecutó mutaciones independientes. H05 sigue parcial porque el DoD requiere **ejecución E2E Preview con SHA y run**, ausente al revisar este HEAD. `approval-policy` exige aprobación vigente del usuario para PR de P2; el revisor **no aprobó ni mergeó**.

**Decisión humana B**: terminales `cancelled/expired` en detalle seguro; cerrada desde ronda 1, no reabrir.

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md) y [lecciones.md](lecciones.md).
