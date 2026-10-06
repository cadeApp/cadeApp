# Evidencia — PR #282 / ronda 1

## Sincronización

```text
develop = 80f0b56a9ff94d3c4e10fb215c63faccd9097365
head    = ced0add71da9daf7d56a8c951bb9253cd9a20537
ahead_by = 1
behind_by = 0
```

## H01 — lectores directos omitidos

`src/features/requests/queries.ts` en develop:

```text
getMerchantHistoryRequests: select ... cash_change_amount ...
getMerchantRequests:        select ... cash_change_amount ...
getMerchantRequestWithOffers:
  select ... cash_change_amount, notes ...
```

`src/features/requests/components/request-offers-list.tsx`:

```text
request.needsChange && request.cashChangeAmount
(Paga con $...)
...
El destinatario necesita cambio (paga con $...)
```

Eso contradice el CC actual, que dice que ningún lector authenticated usa las columnas y que el revoke no cambia nada visible.

## H02 — semántica de publicación

T-335:

```sql
alter publication supabase_realtime add table public.offers;
alter publication supabase_realtime add table public.delivery_requests;
```

Fallback propuesto por CC-023:

```sql
alter publication supabase_realtime
set table public.delivery_requests (...);
```

PostgreSQL 15 documenta que `SET` reemplaza la lista de tablas/esquemas de la publicación; `ADD` y `DROP` modifican miembros puntuales. También exige incluir columnas de replica identity cuando una tabla con column list publica UPDATE/DELETE.

Referencias oficiales verificadas en la revisión:
- PostgreSQL 15 — ALTER PUBLICATION
- PostgreSQL 15 — CREATE PUBLICATION / Column Lists
- PostgreSQL 15 — GRANT
- Supabase Realtime — Postgres Changes

## CI del SHA revisado

```text
typecheck      success
lint           success
unit           success
build          success
audit          success
bundle-budget  success
db-tests       success
Vercel         success
e2e-preview    success
approval-policy failure (faltaba informe independiente)
```

Estos checks no validan la migración futura de T-345 porque #282 solo modifica documentación.
