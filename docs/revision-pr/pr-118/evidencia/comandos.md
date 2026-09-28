# Evidencia y comandos — PR #118 · Ronda 1

## SHA inspeccionado

- producto: `f1d2d096cdcddc68633270c5b8b5805b4daff035`
- develop: `57badabc28fd3bd8e913674bd80b30feb8828414`
- compare GitHub: 4 ahead / 0 behind / mergeable

## Alcance mecánico

12 archivos cambiados y todos dentro de la ficha T-206:
- `docs/tasks/T-206.md`
- `docs/tasks/log/T-206.md`
- `src/features/auth/actions.ts`
- `src/features/auth/actions.test.ts`
- `src/server/cron/sweep.ts`
- `src/server/cron/sweep.test.ts`
- `src/server/rpc/admin.ts`
- `src/server/rpc/admin.test.ts`
- `src/server/rpc/offers.ts`
- `src/server/rpc/offers.test.ts`
- `src/server/rpc/requests.ts`
- `src/server/rpc/requests.test.ts`

## DB CI inspeccionado

Workflow run `36376743793`, job `db-tests`:

```text
All tests successful.
Files=12, Tests=1601
Result: PASS
```

No se levantó Supabase/Docker local.

## Mutaciones a reproducir

Esta sesión no contó con checkout ejecutable; estas mutaciones **no se marcan como ejecutadas**. Son la batería mínima que debe ejecutar el autor sobre el GREEN y que la Ronda 2 revalidará con mutaciones independientes.

### X01 — idempotencia

Objetivo: `acceptOfferRpc`.

1. Agregar el test que exige cero push con `idempotent:true`.
2. Mutar quitando la guarda `if (parsedOutput.data.idempotent) return ok(...)`.
3. Comando:
   `pnpm vitest run src/server/rpc/offers.test.ts`
4. Esperado: el nuevo caso T-206 falla por intento de resolver/enviar push.

### X02 — filtros de publish_request

1. Con tests que afirmen argumentos de query, mutar:
   - `.eq('status','approved')` → `.eq('status','rejected')`
   - `.eq('available',true)` → `.eq('available',false)`
2. Comando:
   `pnpm vitest run src/server/rpc/requests.test.ts`
3. Cada mutación debe producir RED sin tocar el test.

### X03 — cancelación con histórico

1. Fixture con oferta afectada + oferta histórica.
2. Mutar eliminando el filtro de `decided_at`/transición.
3. Comando:
   `pnpm vitest run src/server/rpc/requests.test.ts`
4. Esperado: falla por destinatario extra.

### X04 — expiración con histórico

1. El update de pending debe devolver `request_id,courier_id`.
2. Mutar reemplazando esa lista por un select general de offers del request.
3. Comando:
   `pnpm vitest run src/server/cron/sweep.test.ts`
4. Esperado: falla por courier histórico extra.

### X05 — orden post-commit

1. Sobre `publish_request`, mover temporalmente la resolución/envío antes de finalizar la RPC o realizar una mutación equivalente que ejecute el spy con `rpcExecuted === false`.
2. Comando:
   `pnpm vitest run src/server/rpc/requests.test.ts`
3. Esperado: el test de orden queda RED.

## Control GREEN final pedido al autor

```bash
pnpm typecheck
pnpm lint
pnpm vitest run src/server/rpc/requests.test.ts src/server/rpc/offers.test.ts src/server/cron/sweep.test.ts
pnpm test
```

El db-test final se toma del CI normal posterior al push; no disparar workflows manualmente.
