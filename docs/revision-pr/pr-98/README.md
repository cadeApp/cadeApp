# PR #98 — T-311 · Páginas legales y consentimientos versionados

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/98 |
| **Tarea** | T-311 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-311-legal-consents` → `develop` |
| **Base revisada** | `develop@7edcfe0` |
| **SHA revisado** | `c47aee486cf87c491ce62b231eda8795e34aa722` |
| **Estado** | **bloqueada por contract-change CC-007 · Ronda 3** |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `09082af` | 9 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5c7371` | 5 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `c47aee4` | 3 bloqueantes de PR + CC-007 requerido | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado

Cerrados en R3: **H01, H11**.  
Decisiones aceptadas: **A02** (excepción T-312) y **A03** (contract-change).  
Abiertos: **H06, H08, H09, H12**.

H06 no se corrige dentro de PR #98: T-311 debe detenerse hasta que **CC-007** se mergee.

## Próximo flujo

1. AGY hace `git pull` de esta revisión.
2. Ejecuta `cerrar-sesion` para T-311 y la deja bloqueada por CC-007.
3. Crea `cc/CC-007-consent-enforcement` desde `develop` siguiendo `contract-change`.
4. CC-007 se revisa/mergea primero.
5. Se retoma T-311 con `retomar-tarea`.
6. Se integran el nuevo contrato, H08, H09 y H12.
7. Recién entonces Ronda 4 + CI final.
