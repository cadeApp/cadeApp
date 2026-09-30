# PR #143 — T-318 · Ficha de mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/143 |
| **Tarea** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-318-ficha` → `develop` |
| **Head revisado** | `d843026b9d0e951278c954fdde7494dddbd88f56` |
| **develop al revisar** | `ec3c671db6f5ae5664f929925f5a77209bd57682` |
| **Estado** | bloqueada — Ronda 1 · 2 bloqueantes |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d843026b9d0e951278c954fdde7494dddbd88f56` | 2 bloqueantes | `revisiones/ronda-1.md` |

## Estado por hallazgo

- **PR143-H01** · alto · abierto · la rama está 8 commits detrás de `develop`.
- **PR143-H02** · alto · abierto · la ficha exige anti-enumeración completa para `identities: []`, pero todavía permite `user_already_exists/email_exists → VALIDATION_ERROR`, observable como `ok:false` frente al `ok:true` de un alta válida.

## Lo que sí quedó bien

- Diff propio limitado a `docs/tasks/T-318.md` + `docs/implementation-plan.md`.
- Issue #141 actualizado: #142 espera al merge de esta ficha.
- Primer ítem del DoD y fila T-318 del plan coinciden exactamente.
- `verify-fichas` 7/7 en CI.
- CI exact-head: 103 archivos / 1383 tests, typecheck/lint/db/build/bundle/audit verdes.

Datos estructurados: `hallazgos.jsonl` · evidencia: `evidencia/comandos.md`.
