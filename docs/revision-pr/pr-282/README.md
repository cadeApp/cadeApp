# PR #282 — CC-023 · Cerrar por API la lectura de indicaciones y monto exacto de cambio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/282 |
| **Contrato** | CC-023 |
| **Tarea bloqueada** | T-345 (#281) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-023-courier-private-fields` → `develop` |
| **Base** | `80f0b56a9ff94d3c4e10fb215c63faccd9097365` |
| **Estado** | **CON BLOQUEANTES — ronda 2** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ced0add71da9daf7d56a8c951bb9253cd9a20537` | **2 bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `39153caa7ad1cb5f617115fd2fc3f2734462c7ee` | **2 bloqueantes nuevos; H01/H02 cerrados** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR282-H01 | El revoke propuesto rompe lectores authenticated del comercio | alto | **arreglado-verificado** en `39153ca` |
| PR282-H02 | El fallback Realtime con SET TABLE expulsaría otras tablas de la publicación | alto | **arreglado-verificado** en `39153ca` |
| PR282-H03 | T-345 define tres PR para una sola tarea/issue, contra la regla raíz de coordinación | decisión | **decisión B resuelta; corrección documental pendiente** |
| PR282-H04 | El PR 1 crea la RPC pero posterga `database.types.ts`; `db-tests` lo deja rojo | alto | **abierto** |

## Decisiones humanas

- **1-A — 2026-10-06:** mantener la barrera fuerte para todo `authenticated` y preservar el comportamiento del comercio mediante una frontera RPC/server segura.
- **B — 2026-10-06:** Lautaro073 autoriza explícitamente una excepción para T-345: puede ejecutarse en 3 PR sucesivas bajo el mismo issue/tarea por necesidad de rollout seguro. La regla general sigue siendo «una tarea = un issue = una rama = un PR»; AGENTS.md y la regla 50 deben documentar esta excepción estrecha antes del merge de CC-023.

No se mergea CC-023 hasta resolver H03/H04 y revalidar la ronda.
