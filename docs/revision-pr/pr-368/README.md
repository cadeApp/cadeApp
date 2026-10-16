# PR #368 — T-354: «Selfie con el DNI»

| Ronda | SHA revisado | Conclusión | Informe |
|---|---|---|---|
| 1 | 8316ea4 | Implementación inicial pendiente | [R1](revisiones/ronda-1.md) |
| 2 | b94c683 | H03 y H04 abiertos | [R2](revisiones/ronda-2.md) |
| 3 | 0acb5a7 | H03 resuelto, E2E entonces en curso | [R3](revisiones/ronda-3.md) |
| 4 | 20392c26 | Harness H05 falso RED | [R4](revisiones/ronda-4.md) |
| 5 | e97323fe | Harness reparado, E2E cancelado | [R5](revisiones/ronda-5.md) |
| 6 | 5388ed36 | **BUILD fallido + E2E cancelado en SHA actual** | [R6](revisiones/ronda-6.md) |

**Autor:** @KiraK72 (P2). **Rama:** `feat/T-354-unificar-texto-selfie-dni` → develop. **Decisiones:** 1-A, 2-B, 3-A sin cambios.

## Hallazgos acumulados

- H01: arreglado-verificado; fuente y 14 invariantes estáticos reconfirmados en R6.
- H02: parcial; la bitácora del autor corrigió la descripción del harness, pero el revisor no ejecutó sus mutaciones Vitest reales.
- H03: arreglado-verificado y reconfirmado R6.
- H04: parcial; E2E del último SHA 5388ed3 **ERROR/CANCELLED**, capturas nuevas enlazadas pero no observadas de forma independiente.
- H05: arreglado-verificado en su propiedad de rechazo de falso RED; ejecutados 3 casos herméticos con Node.

## Gates bloqueantes actuales

- `build`: FAIL (next/font Google font loader TypeError), sin evidencia de causalidad con T-354; `bundle-budget` SKIPPED.
- `e2e-preview`: ERROR tras cancelación de run [38797126543](https://github.com/cadeApp/cadeApp/actions/runs/38797126543).
- Branch 4 commits detrás de develop. Integrar vía merge sin rebase antes de preparar HEAD final.
- `unit` 2370 Vitest pass, DB 2283 pgTAP pass, typecheck, lint, audit, approval-policy y Vercel success.

**Acción humana pendiente** sobre HEAD estable: reejecutar build fallido y E2E del SHA definitivo en GitHub Actions; no se dispararon manualmente en la revisión.

Detalles: [ronda 6](revisiones/ronda-6.md) · [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md). No se aprobó ni mergeó.
