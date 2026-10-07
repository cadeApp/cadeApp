# PR #294 — T-347 · implementación e2e-mutation

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/294 |
| **Tarea** | T-347 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-347-e2e-mutation` → `develop` |
| **Base** | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| **HEAD revisado** | `a0d860d46d96f1a03851cc2ffd2f17923c12aae0` |
| **Estado** | **CON BLOQUEANTES — ronda 1** |

## Ronda 1

- `PR294-H01`: el workflow permite ejecutar un SHA de PR no mergeado en el mismo runner que posteriormente recibe secretos de Develop.
- `PR294-H02`: stdout/stderr y reportes generados durante fases con secretos se guardan como artifact sin sanitización demostrable.

## Decisión de Lautaro073

El 2026-10-07 Lautaro073 eligió **A**:

- T-347 pasa a admitir **solo `target=develop`**;
- se elimina el soporte de PRs como target;
- se elimina la necesidad de `pull-requests: read` y de resolver/validar PRs;
- el objetivo post-merge requerido por T-347 sigue cubierto.

Decisión registrada como `PR294-A01`, estado `aceptado`.

## Mejora

- `PR294-M01`: el artifact usa actualmente SHA de 40 caracteres; la ficha pide `sha7`.

## Checks del HEAD revisado

- CI ✅
- Vercel ✅
- e2e-preview ✅ exact-head
- approval-policy ❌ esperado mientras existan bloqueantes

La revisión independiente no aprueba ni mergea la PR.
