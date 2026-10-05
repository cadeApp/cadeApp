# Ronda 6 — PR #180 / T-307

**SHA revisado:** `cfea63d76850692c3bf99c832cf4044b3859f792`  
**Base actual:** `develop@20db1bdbfd44f5a398dbfa984cc8ea291a56a493`  
**Estado de rama:** 17 ahead / 6 behind  
**Resultado:** **CON BLOQUEANTE T-333 / #229**

## Cambio del autor

Desde R5 solo se actualizaron:
- `docs/tasks/T-307.md`;
- `docs/tasks/log/T-307.md`.

El E2E no fue tocado y `docs/revision-pr/**` permaneció intacto.

## Evidencia trusted más reciente

Run `37138561471`, ya con el workflow autodiscovery de develop:

```text
chromium: 23 tests del SHA
21 passed
2 failed
```

Los dos fallos son exactamente:
1. Realtime: `offersRequestCount > baseline` no ocurre en 15 s, RED 3/3.
2. Reconnect: `count > baseline` no ocurre en 15 s, RED 3/3.

Offline/form sigue GREEN.

## CI

Run `37138504068`:
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- unit/coverage + workflow tests ✅
- bundle-budget ✅
- audit ❌ por advisory preexistente

## Colisión T-331

#229 se había cerrado sin fix de producto. La causa fue que #232/#233 reutilizó T-331 para la tarea de autodiscovery y creó la ficha oficial `docs/tasks/T-331.md`.

El compare desde el primer trusted RED hasta develop actual no contiene cambios en los hooks de Realtime/reconnect.

Corrección realizada:
- #229 reabierto;
- renombrado a **T-333**;
- referencias de T-307 corregidas a T-333/#229.

## Estado de hallazgos

- H01 ✅
- H02 ✅ control arreglado y verificado: detecta producto RED
- H03 ✅
- H04 ✅
- H05 ✅ control arreglado y verificado: detecta producto RED
- H06 ✅ verificado por ejecución remota
- H07 ✅ desacoplamiento de #200 verificado
- H08 ✅ colisión de seguimiento corregida
- **Producto T-333/#229 🔴 pendiente**

No corresponde hacer las mutaciones finales H02/H05 mientras el producto base ya está RED; primero T-333 debe llevar el trusted spec a GREEN.

No aprobar ni mergear PR #180.
