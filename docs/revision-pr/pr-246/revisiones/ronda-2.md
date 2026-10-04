# Ronda 2 — PR #246 / T-335

**SHA revisado:** `e5f560810838d4678e29ba62cbe203bdb6b174ac`  
**Resultado:** **SIN BLOQUEANTES**

## PR246-H01 ✅
Restaurado el DoD post-merge, `Refs #244` en lugar de `Closes #244`, body y bitácora coherentes.

## PR246-H02 ✅
La explicación de `REPLICA IDENTITY DEFAULT` ya coincide con los consumidores reales: los cambios son señales de invalidación y no se usa `OLD` completo.

## Integridad
El arreglo del autor toca solo ficha y bitácora. Migración, DB test, RLS, hooks, E2E y workflows permanecen intactos.

## Checks
- CI funcional previo: GREEN completo.
- CI `37175915768`: typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · bundle-budget ✅ · db-tests ✅.
- Vercel actual: fallo externo por cuota diaria, no por código.

## Residual deliberado
Después del merge:
1. `migrate-develop`;
2. sincronizar PR #180;
3. trusted `notifications.spec.ts`;
4. exigir Realtime + offline/form + reconnect = 3/3 GREEN;
5. recién entonces cerrar #244.

**PR #246 apta para merge. #244 debe permanecer abierta.**
