# Evidencia reproducible — PR #236 / T-333

## Ronda 3 — SHA

```text
base develop: bc6329d941a510cc37d23827f5e3798e3839c065
commit revisión R2: 52d492c845c61489c54fcb46e2f360d86bc827d6
head técnico R3: 6a080cf2ccdd675e6be9ae69a517200f172af506
delta autor desde R2:
  docs/tasks/log/T-333.md
  src/app/providers.test.tsx
  src/app/providers.tsx
```

## CI exact-head

CI `37146402120`:

```text
src/features/requests/hooks/use-request-offers.test.tsx  14/14
src/lib/hooks/use-realtime-invalidation.test.tsx        12/12
src/app/providers.test.tsx                               1/1
Test Files: 115 passed (115)
Tests: 1744 passed (1744)
typecheck: success
lint: success
build: success
db-tests: success
bundle-budget: success
audit: failure por braces (externo a T-333/T-332)
```

Preview `37146488624`:

```text
checkout: 6a080cf2ccdd675e6be9ae69a517200f172af506
chromium: 20 passed
global-settings: 3 passed
notifications.spec.ts: no forma parte de este SHA
```

## Trace trusted que identifica la carrera

Fuente: artifact `playwright-report` de PR #180 / run `37138561471`. Se omiten deliberadamente cookies, credenciales y datos de fixtures.

Tiempos monotónicos seguros:

```text
GET /api/live/requests/<id>/offers
  inicio:              257772.302
  duración snapshot:      584.964 ms
  fin aprox.:          258357.266

setOffline(true):       258355.249
chunk dinámico:
  inicio:              258357.606
  fin:                 258388.389
setOffline(false):      258371.588
```

Deducción:

- offline empieza ~2 ms antes de terminar la GET;
- el chunk dinámico arranca inmediatamente después de la GET;
- online ocurre mientras ese chunk sigue descargándose;
- `useRequestOffers.queryFn` ejecuta `await import('@/lib/live-contracts')` después del `res.json()`;
- por lo tanto la query sigue activa durante la reconexión.

## Contrato TanStack relevante

Código actual de TanStack Query v5:

```ts
onOnline(): void {
  const observer = this.observers.find((x) => x.shouldFetchOnReconnect())
  observer?.refetch({ cancelRefetch: false })
  this.#retryer?.continue()
}
```

`RefetchOptions.cancelRefetch` documenta:

```text
false => no se hace un nuevo refetch si ya existe una request en curso
```

Referencias públicas:
- https://github.com/TanStack/query/blob/main/packages/query-core/src/query.ts
- https://tanstack.com/query/latest/docs/framework/react/reference/interfaces/RefetchOptions

## RED requerido

Crear en `use-request-offers.test.tsx` un fetcher diferido:

```text
call #1 empieza y queda pendiente
isRefetching = true
onlineManager false
onlineManager true
call #1 sigue pendiente
resolver call #1 con datos viejos
esperar call #2
call #2 devuelve datos nuevos
```

HEAD actual esperado: **RED** (queda en una sola llamada).

Luego implementar la garantía de una segunda llamada post-settle, sin duplicar el camino de reconnect normal/idle.

## Mutación del arreglo futuro

Neutralizar solo el mecanismo que recuerda «reconnect pendiente durante fetch en vuelo».

Esperado:

```text
idle reconnect test: GREEN
in-flight reconnect test: RED
readiness realtime: GREEN
```

Restaurado: todos GREEN.
