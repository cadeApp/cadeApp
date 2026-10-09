# PR #291 — T-345 · PR 3/3: enforcement de columnas privadas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/291 |
| **Tarea** | T-345 · paso 3/3 del rollout multi-PR de CC-023 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-345-private-columns-enforcement` → `develop` |
| **Base** | `7e1629806376a8adf6a54cb53d2a5736c9d6bd74` |
| **HEAD funcional revisado** | `52afdbc4673ac2274e4a56996785ac7bb4d77e3c` |
| **Estado** | **SIN BLOQUEANTES — ronda 1** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `52afdbc4673ac2274e4a56996785ac7bb4d77e3c` | **SIN BLOQUEANTES** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Decisión de alcance aceptada

Durante la revisión se detectó que `supabase/tests/rls_matrix.sql` no figuraba todavía en la allowlist de la ficha vigente de `develop`.

Lautaro073 decidió **A** el 2026-10-07: se acepta agregar ese archivo **únicamente** para cambiar la aserción «anon no ve delivery_requests» de «0 filas por RLS» a error `42501` después del `REVOKE SELECT` de CC-023.

La decisión queda registrada como `PR291-A01`, estado `aceptado`.

## Qué queda por hacer

Este PR implementa el enforcement, pero **#281 no se cierra todavía**.

Después del merge:

1. `migrate-develop` debe quedar GREEN sobre el SHA mergeado.
2. Crear `review/T-345-post-enforcement-e2e` desde el `develop` ya migrado.
3. Ese PR es `REVIEW ONLY / NEVER MERGE`, sin migraciones, y `e2e-preview` debe quedar **GREEN**, incluido `courier-private-columns.spec.ts`.
4. Si Realtime todavía expone `notes` o `cash_change_amount`, #281 sigue abierto y se aplica la alternativa de CC-023 §5 en un PR normal.
5. Lautaro073 cierra #281 manualmente solo después de ese GREEN.

La revisión independiente no aprueba ni mergea la PR.
