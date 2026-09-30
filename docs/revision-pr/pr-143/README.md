# PR #143 — T-318 · Ficha de mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/143 |
| **Tarea** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-318-ficha` → `develop` |
| **Head R1** | `d843026b9d0e951278c954fdde7494dddbd88f56` |
| **Head R2** | `bb6e18be470af93f5a26306970240ae0e1e35e07` |
| **Head R3 revisado** | `fb308412d868b210c6c3152ebc2ed1414596120f` |
| **develop al revisar R3** | `10c229f628e89527e20d222ca536af46eda015f1` |
| **Estado** | Ronda 3 · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d843026b9d0e951278c954fdde7494dddbd88f56` | 2 bloqueantes | `revisiones/ronda-1.md` |
| 2 | `bb6e18be470af93f5a26306970240ae0e1e35e07` | H02 cerrado; H01 reaparece por avance de develop | `revisiones/ronda-2.md` |
| 3 | `fb308412d868b210c6c3152ebc2ed1414596120f` | SIN BLOQUEANTES | `revisiones/ronda-3.md` |

## Estado por hallazgo

- **PR143-H01** · alto · aceptado/cerrado en R3 · la rama incorporó el `develop` que incluía los cambios de CI vigentes en R2; después `develop` avanzó 7 commits exclusivamente de T-301/E2E, sin tocar T-318, `docs/implementation-plan.md` ni workflows. La PR sigue `mergeable=true` y el CI exact-head está 7/7 verde.
- **PR143-H02** · alto · arreglado-verificado · toda señal de cuenta existente quedó cubierta por la misma política anti-enumeración y la fila del plan coincide exactamente con el primer DoD.

## Verificado en R3

- Ficha T-318 y fila del plan mantienen la semántica validada en R2.
- El código actual permite implementar la ficha dentro de `src/features/auth/**`: `registerAction` puede devolver un resultado público neutral sin cambiar `src/domain/errors.ts`, y `RegisterForm` solo usa `redirectTo`.
- El camino de cuenta existente puede cortar antes de `activate_account_consents`, evitando usar un id sanitizado.
- `develop` avanzó de `a16acd4` a `10c229f` solo en T-301/E2E: `docs/tasks/T-301.md`, su bitácora, `e2e/pages/login.page.ts` y `playwright.config.test.ts`.
- CI exact-head de `fb308412...`: typecheck, lint, unit, db-tests, build, bundle-budget y audit verdes.

## Próximo paso

Actualizar únicamente el body de la PR con el informe de Ronda 3. No hace falta otro merge de `develop` por los 7 commits ajenos a T-318 detectados al cerrar esta ronda. No aprobar ni mergear desde el agente.
