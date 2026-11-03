# PR #349 — Promoción develop → staging · Issue #336

**Origen:** develop `a3681e98f1a1d3aa5d2c3e97e535d7d9219c9d93` · **Base staging:** `edf5f860876e7b996a170cc2f586ee78769bbaf7` · **Rama:** `release/issue-336-promote-staging-20261015`.

## Rondas
| Ronda | HEAD funcional inspeccionado | Dictamen |
|---|---|---|
| 1 | `10ab26a11d02653309d6e065a30052471af6d463` | SIN BLOQUEANTES DE CÓDIGO; merge condicionado a CI propio verde |

- [Informe Ronda 1](revisiones/ronda-1.md)
- [Evidencia/comandos](evidencia/comandos.md)
- [Lecciones](lecciones.md)
- [Hallazgos JSONL](hallazgos.jsonl) (sin hallazgos)

## Qué queda
1. Acreditar CI y Vercel de esta release en SHA exacto (los tests de develop no lo sustituyen). No alterar pruebas ni workflows.
2. Tras merge **expresamente autorizado por Lautaro073**, `migrate-staging`, tipos sin drift y despliegue correcto.
3. Comprobar /admin/merchants con admin AAL2. Sin esa validación, no declarar operativamente resuelto #336. No borrar cuentas ni datos de staging.
