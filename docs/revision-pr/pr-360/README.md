# PR #360 — T-359 · Revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/360 · Autor: asako669 · Rama: feat/T-359-detalle-merchant-post-aceptacion → develop.

## Rondas
| Ronda | HEAD de autor inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | 325a9a6a09de404efedd40ad1ee5728e5d9f218f | CON BLOQUEANTES | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | aacf8291fdb331da53b94fa7471679b2792f5ecf | CON BLOQUEANTES | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos
| ID | Severidad | Estado |
|---|---|---|
| PR360-H01 | alto | arreglado-sin-verificar |
| PR360-H02 | alto | parcial |
| PR360-H03 | medio | arreglado-sin-verificar |
| PR360-H04 | medio | arreglado-sin-verificar |
| PR360-H05 | alto | parcial |
| PR360-H06 | medio | arreglado-sin-verificar |
| PR360-H07 | medio | parcial |
| PR360-R01 | medio | abierto |

**Sin certificaciones falsas:** no hay hallazgos `arreglado-verificado`; no hubo mutaciones ni E2E reproducidos en el entorno revisor. H01, H03, H04, H06 se corrigieron por inspección y permanecen sin verificar independientemente. H02, H05, H07 y R01 bloquean la siguiente decisión de merge.

**Decisión de Lautaro073:** B (vistas cancelled/expired con resumen en la misma URL) — implementada.

**CI del SHA autor:** unit 130/130, Vitest 2179/2179, workflow 79, ADR 6; db-tests 2205 PASS. No se encontró `e2e-preview`. `approval-policy` falló; no se presume ejecución de E2E.

Fuentes: [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md). El autor no modifica docs/revision-pr/**.
