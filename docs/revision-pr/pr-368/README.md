# PR #368 — T-354 · Texto consistente «Selfie con el DNI»

| Ronda | HEAD revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `8316ea4` | faltaba implementación | [ronda-1](revisiones/ronda-1.md) |
| 2 | `b94c683` | H03 y H04 abiertos | [ronda-2](revisiones/ronda-2.md) |
| 3 | `0acb5a7` | H03 corregido, E2E pendiente | [ronda-3](revisiones/ronda-3.md) |
| 4 | `20392c26` | **H05 harness falso RED, H04 visual no accesible** | [ronda-4](revisiones/ronda-4.md) |

**Autor:** @KiraK72 · **rama:** `feat/T-354-unificar-texto-selfie-dni` → develop.
**Decisiones 1-A, 2-B, 3-A:** aplicadas sin nuevas decisiones.

## Estado acumulado
- H01: arreglado-verificado.
- H02: parcial; RED runtime no queda demostrado por el harness defectuoso.
- H03: arreglado-verificado.
- H04: parcial; E2E Preview **SUCCESS confirmado en SHA 20392c26**, capturas móviles sin enlace recuperable.
- H05: **abierto y BLOQUEANTE**, verificado con reproducción hermética.

**CI:** 2230/2230 tests unitarios, 76/76 E2E Chromium, 3/3 global-settings, typecheck/lint/build/db/audit/budget verdes. **approval-policy pasó** después de que Lautaro073 aprobó personalmente el SHA inspeccionado. El revisor no aprobó ni mergeó.

Consultar [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md).
