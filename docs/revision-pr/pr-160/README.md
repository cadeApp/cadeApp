# PR #160 — T-303 — E2E del flujo principal

- **PR:** #160
- **Tarea:** T-303
- **Rama:** `feat/T-303-main-flow`
- **Base:** `develop`
- **Ronda actual:** 5
- **SHA revisado:** `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`
- **Resultado:** CON BLOQUEANTES (1)
- **Fecha:** 2026-10-01
- **Revisor:** revisión independiente solicitada por Lautaro073

## Criterio de cierre aclarado por P1

Para este tipo de tarea hay dos gates distintos:

1. **Gate de merge a `develop`:** código, alcance y CI de la PR deben quedar correctos.
2. **Gate de tarea terminada:** después del merge se promociona `develop → staging` y recién una corrida real del E2E en staging permite marcar T-303 como **Hecha**.

Por lo tanto, que `main-flow.spec.ts` todavía no haya corrido contra staging **no bloquea por sí solo el merge a develop**. Sí impide marcar la tarea terminada.

## Resumen Ronda 5

- H05: corregido y verificado contra el body + CI del SHA revisado.
- H10: corregido estructuralmente; pendiente de la corrida real en staging.
- H11: corregido estructuralmente; pendiente de la corrida real en staging.
- H12: sigue bloqueante porque `develop` avanzó otra vez y la rama quedó 9 commits detrás.

El CI de `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c` fue verde:
- typecheck ✅
- lint ✅
- unit/coverage: 110/110 archivos, 1602/1602 tests ✅
- workflow tests: 31 tests ✅
- ADR tests: 6 tests ✅
- db-tests: 13 archivos, 1614 tests, Result: PASS ✅
- build/bundle/audit ✅

## Gate post-merge

El workflow actual `.github/workflows/e2e-staging.yml` ejecuta solo `smoke.spec.ts`. Ese smoke **no alcanza** para cerrar T-303.

Después de promocionar a staging debe ejecutarse explícitamente:

```bash
pnpm exec playwright test e2e/specs/main-flow.spec.ts --project=chromium
```

contra el staging recién desplegado. Solo con esa corrida verde se marca el primer DoD y la tarea como terminada.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
- `revisiones/ronda-4.md`
- `revisiones/ronda-5.md`
