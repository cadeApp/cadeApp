# PR #368 — T-354 · Texto consistente «Selfie con el DNI»

| Ronda | HEAD de código | Resultado | Informe |
|---|---|---|---|
| 1 | `8316ea4` | Sin implementación | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `b94c683` | Incumplimientos de test y E2E | [Ronda 2](revisiones/ronda-2.md) |
| 3 | `0acb5a7` | H03 corregido, E2E entonces en curso | [Ronda 3](revisiones/ronda-3.md) |
| 4 | `20392c26` | H05 harness falso RED | [Ronda 4](revisiones/ronda-4.md) |
| 5 | `e97323fe` | H05 código corregido y test hermético; E2E del SHA cancelado | [Ronda 5](revisiones/ronda-5.md) |

**Autor:** KiraK72 (P2) · Rama `feat/T-354-unificar-texto-selfie-dni` → develop. **Decisiones 1-A/2-B/3-A** respetadas.

## Hallazgos acumulados

| ID | Estado |
|---|---|
| H01 | arreglado-verificado |
| H02 | parcial: 9 RED de Vitest sin reproducir por revisor y discrepancia de prueba negativa documentada |
| H03 | arreglado-verificado |
| H04 | parcial: las capturas tienen encabezado de QA y el E2E de la SHA vigente fue cancelado |
| H05 | arreglado-verificado respecto del control falso RED, mediante reproducción hermética independiente |

### Últimos resultados del SHA inspeccionado

2370 tests Vitest aprobados / 133 archivos; CI typecheck, lint, build, audit, db, bundle-budget en success. Review formal APPROVED de Lautaro073 y approval-policy success. **e2e-preview ERROR por cancelación**, run 38792914312. Las capturas externas no pudieron abrirse íntegramente desde el entorno.

**Cambio menor aplicado por el revisor:** el body de la PR usa rótulos públicos para los adjuntos y aclara que `DocumentUploadCard` no es texto visible al usuario. El JSX público ya muestra `Selfie con el DNI`, por lo que NO se cambió el código cliente.

Ver [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md). No aprobar ni mergear todavía.
