# PR #143 — T-318 · Ficha de mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/143 |
| **Tarea** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-318-ficha` → `develop` |
| **Head R1** | `d843026b9d0e951278c954fdde7494dddbd88f56` |
| **Head R2 revisado** | `bb6e18be470af93f5a26306970240ae0e1e35e07` |
| **develop actual al cerrar R2** | `a16acd4831e2e538d4313e6821d3ebc4e7f758ac` |
| **Estado** | bloqueada — Ronda 2 · 1 bloqueante |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d843026b9d0e951278c954fdde7494dddbd88f56` | 2 bloqueantes | `revisiones/ronda-1.md` |
| 2 | `bb6e18be470af93f5a26306970240ae0e1e35e07` | H02 cerrado; H01 reaparece por nuevo avance de develop | `revisiones/ronda-2.md` |

## Estado por hallazgo

- **PR143-H01** · alto · abierto · la rama fue sincronizada hasta `ec3c671`, pero `develop` avanzó después a `a16acd4`; ahora vuelve a estar 14 commits detrás, incluyendo cambios en `.github/workflows/ci.yml`.
- **PR143-H02** · alto · arreglado-verificado · toda señal de cuenta existente quedó cubierta por la misma política anti-enumeración y la fila del plan coincide exactamente con el primer DoD.

## Verificado en R2

- La carpeta `docs/revision-pr/pr-143/**` no fue tocada por el autor.
- Primer DoD y fila T-318 del plan: coincidencia exacta.
- `user_already_exists` / `email_exists` ya no se clasifican como `VALIDATION_ERROR`; siguen el mismo camino no enumerable definido para `identities: []`.
- CI exact-head de `bb6e18be470af93f5a26306970240ae0e1e35e07`: 104 archivos / 1407 tests, typecheck/lint/db/build/bundle/audit verdes.

## Próximo paso

Mergear nuevamente el `origin/develop` actual en la rama documental, sin cambios semánticos adicionales salvo resolver conflictos si aparecieran. Después revalidar `behind=0` y CI exact-head con los workflows vigentes.
