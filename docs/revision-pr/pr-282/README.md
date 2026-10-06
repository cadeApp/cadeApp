# PR #282 — CC-023 · Cerrar por API la lectura de indicaciones y monto exacto de cambio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/282 |
| **Contrato** | CC-023 |
| **Tarea bloqueada** | T-345 (#281) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-023-courier-private-fields` → `develop` |
| **Base** | `80f0b56a9ff94d3c4e10fb215c63faccd9097365` |
| **Estado** | **CON BLOQUEANTES — ronda 3** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ced0add71da9daf7d56a8c951bb9253cd9a20537` | **2 bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `39153caa7ad1cb5f617115fd2fc3f2734462c7ee` | **2 bloqueantes nuevos; H01/H02 cerrados** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `1f134ce4ef219bf504dd954ee9cacc5a730a74da` | **2 bloqueantes nuevos; H03/H04 cerrados** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR282-H01 | El revoke propuesto rompe lectores authenticated del comercio | alto | **arreglado-verificado** en `39153ca` |
| PR282-H02 | El fallback Realtime con SET TABLE expulsaría otras tablas de la publicación | alto | **arreglado-verificado** en `39153ca` |
| PR282-H03 | T-345 define tres PR para una sola tarea/issue, contra la regla raíz de coordinación | decisión | **aceptado** — decisión B + reglas reconciliadas en `1f134ce` |
| PR282-H04 | El PR 1 crea la RPC pero posterga `database.types.ts`; `db-tests` lo deja rojo | alto | **arreglado-verificado** en `1f134ce` |
| PR282-H05 | `board-sync` cierra #281 tras el primer PR aunque use `Refs` | alto | **abierto** — decisión 1-A: corregir workflow + tests |
| PR282-H06 | El PR 3 no puede tener `e2e-preview GREEN` antes de aplicar su migración | alto | **abierto** — decisión 2-A: gate post-merge con PR REVIEW ONLY |

## Decisiones humanas

- **1-A — 2026-10-06:** barrera fuerte para todo `authenticated` + RPC segura para preservar el comportamiento del comercio.
- **B — 2026-10-06:** T-345 puede usar 3 PR sucesivas bajo el mismo issue/tarea por necesidad de rollout seguro.
- **R3 / 1-A — 2026-10-06:** corregir `board-sync` para que un rollout multi-PR abierto no cierre ni marque Hecha la tarea por un merge intermedio.
- **R3 / 2-A — 2026-10-06:** mantener 3 PR mergeables; después del enforcement mergeado y `migrate-develop` GREEN, usar un PR `REVIEW ONLY / NEVER MERGE` sin migraciones para ejecutar el E2E real. #281 se cierra solo después de ese GREEN.

No se mergea CC-023 hasta corregir H05/H06 y revalidar la ronda.
