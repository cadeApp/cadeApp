# PR #98 — T-311 · Páginas legales y consentimientos versionados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/98 |
| **Tarea** | T-311 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-311-legal-consents` → `develop` |
| **Base revisada** | `develop@ac4587f` |
| **SHA revisado** | `cccb88c460a858d85d15b77e6df5d19a20596aea` |
| **Estado** | **con bloqueantes · Ronda 4** |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `09082af` | 9 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5c7371` | 5 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `c47aee4` | bloqueada por CC-007 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `cccb88c` | 2 bloqueantes + 1 estado documental | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado R4

Cerrados: **H06, H12**.

Abiertos:
- **H08:** falta evidencia reproducible de capturas + axe real.
- **H09:** body/bitácora sobredeclaran H08 mientras siga sin evidencia.
- **H13:** el onboarding courier re-inserta TOS/Privacy y rompe por la PK de `consents`; las escrituras tampoco son idempotentes en reintentos.

No se inspecciona CI final mientras existan H08/H13.
