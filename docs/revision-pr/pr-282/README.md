# PR #282 — CC-023 · Cerrar por API la lectura de indicaciones y monto exacto de cambio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/282 |
| **Contrato** | CC-023 |
| **Tarea bloqueada** | T-345 (#281) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-023-courier-private-fields` → `develop` |
| **Base original** | `80f0b56a9ff94d3c4e10fb215c63faccd9097365` |
| **Estado** | **CON BLOQUEANTES — ronda 4** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ced0add71da9daf7d56a8c951bb9253cd9a20537` | **2 bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `39153caa7ad1cb5f617115fd2fc3f2734462c7ee` | **2 bloqueantes nuevos; H01/H02 cerrados** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `1f134ce4ef219bf504dd954ee9cacc5a730a74da` | **2 bloqueantes nuevos; H03/H04 cerrados** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `b6a716e2bfce5a4ea4996a1983ab14983554bee2` | **1 bloqueante de integración; H05/H06 cerrados** | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Estado |
|---|---|---|
| PR282-H01 | El revoke propuesto rompe lectores authenticated del comercio | **arreglado-verificado** |
| PR282-H02 | El fallback Realtime con SET TABLE expulsaría otras tablas de la publicación | **arreglado-verificado** |
| PR282-H03 | Excepción multi-PR de T-345 | **aceptado** |
| PR282-H04 | `database.types.ts` estaba en el paso equivocado | **arreglado-verificado** |
| PR282-H05 | `board-sync` cerraba #281 por merges intermedios | **arreglado-verificado** en `b6a716e` |
| PR282-H06 | El PR 3 no podía cumplir e2e-preview GREEN pre-merge | **arreglado-verificado** en `b6a716e` |
| PR282-H07 | La rama está 33 commits detrás de `develop`; el GREEN actual no cubre el target vigente | **abierto** |

## Decisiones humanas

- 1-A: barrera fuerte + RPC segura del comercio.
- B: T-345 usa rollout multi-PR.
- R3 / 1-A: board-sync soporta el rollout multi-PR.
- R3 / 2-A: enforcement se valida post-merge con PR REVIEW ONLY y #281 se cierra después del GREEN.

No se mergea CC-023 hasta sincronizar la rama con `develop` actual y revalidar exact-head.
