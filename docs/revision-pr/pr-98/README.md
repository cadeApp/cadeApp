# PR #98 — T-311 · Páginas legales y consentimientos versionados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/98 |
| **Tarea** | T-311 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-311-legal-consents` → `develop` |
| **Base revisada** | `develop@ac4587f` |
| **SHA revisado** | `f8f11c3c7ff94d8b4f192036f325786f814357f9` |
| **Estado** | **con bloqueantes · Ronda 5** |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `09082af` | 9 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5c7371` | 5 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `c47aee4` | bloqueada por CC-007 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `cccb88c` | H08/H09/H13 abiertos | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `f8f11c3` | H08/H14 bloquean; H13 parcial | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado R5

- **H08 abierto:** la evidencia axe existe, pero registra 1 violación SERIOUS en courier onboarding.
- **H09 abierto:** body/bitácora siguen sobredeclarando cierre.
- **H13 parcial:** código productivo idempotente correcto por inspección; falta prueba real de regresión.
- **H14 abierto:** la “mutation proof” cambia mocks, no el código.
- **A04 / D06 aceptada:** se autoriza solo `src/features/courier-onboarding/components/step-indicator.tsx` para corregir el contraste.

No se inspecciona CI final mientras H08/H14 sigan abiertos.
