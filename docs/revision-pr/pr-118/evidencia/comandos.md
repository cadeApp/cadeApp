# Evidencia y comandos — PR #118

## Rondas 1–2
Ver `revisiones/ronda-1.md` y `revisiones/ronda-2.md`.

## Ronda 3 — SHA `6980fb095b3605663ad658e8c885ed2b7906df3b`

### Delta desde Ronda 2
- base: `96a1af1e7d5cc14d0f9ff3aa3fd7615ea2080503`
- 1 commit de producto.
- 9 archivos tocados.
- `docs/revision-pr/**`: sin cambios del autor.
- desvío: `src/app/api/cron/sweep/route.test.ts` — aceptado por D02=2-A.

### Sincronización con develop
Compare al revisar:
```text
develop c91ec4e... vs head 6980fb...
8 ahead / 1 behind
```
Requisito próxima ronda:
`git merge origin/develop` y `git rev-list --left-right --count origin/develop...HEAD` con cero a la izquierda.

### CI
Run `36461968118` — success.

```text
Test Files 93 passed (93)
Tests      1275 passed (1275)
verify-workflows: # tests 22
verify-adr:       # tests 6
DB:
All tests successful.
Files=12, Tests=1601
Result: PASS
```

Build, typecheck, lint, audit y bundle-budget: success.

### Inspección H06
`logoutAction`:
- getUser + purge dentro de try/catch;
- signOut fuera;
- tests de getUser reject y delete reject presentes.

### Inspección H07 residual
Código actual:
```ts
if (offersRes.error || reqRes.error || auditRes.error) {
  return ok(output.data as RpcOutput<K>);
}
const merchantId = reqRes.data?.merchant_id;
const actorId = auditRes.data?.actor_id;
if (merchantId && actorId !== merchantId) recipients.add(merchantId);
```
Con `auditRes={data:null,error:null}`, actorId es undefined y merchantId puede ser agregado. No existe test para este caso.

### Inspección H05
Bitácora 14:55 registra siete mutaciones con comando/salida. Comparación con batería mínima R2:

- accept idempotencia: ✅
- publish available true→false: ❌
- publish pre-commit: ❌
- cancel action incorrecta: ✅
- cancel sin decided_at: ⚠️ registrada, pero el mensaje mostrado es la aserción estructural del spy, no histórico extra
- sweep couriers cruzados: ❌
- sweep sin `.select(...)`: ❌ (se cambió a `.select('courier_id')`, no se quitó)
- error offers/cancel: ✅
- error request/accept: ✅

### D02
Lautaro073 eligió `2-A`: conservar el cambio test-only de `src/app/api/cron/sweep/route.test.ts`. Se registra como A01 `aceptado`.
