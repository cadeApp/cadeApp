# Informe de Revisión — PR #82 — Ronda 12

- **Tarea:** `T-204`
- **SHA revisado:** `cb7eab991a537f90b3c5d2f04c0d94ce3633bfb0`
- **Resultado:** ❌ **CON BLOQUEANTES (1)** · 0 decisiones pendientes
- **Decisión vigente:** D06 / 1-A

## Qué hizo correctamente el agente

La precondición de R11 encontró un consumidor runtime adicional real:

```ts
// src/features/requests/components/request-offers-list.tsx
import { acceptOfferAction } from '@/features/offers';
```

Al ser un Client Component, no corresponde reemplazarlo por `@/features/offers/server`.

El agente, obedeciendo R11:
- no eliminó `acceptOfferAction`;
- no tocó el consumidor;
- no amplió scope;
- formalizó D06 y `courier/offers/page.tsx` en la ficha;
- dejó checks verdes.

## Enumeración canónica disponible

La búsqueda local registrada en `docs/tasks/log/T-204.md` encontró exactamente estos consumidores externos del barrel:

1. `src/app/(courier)/courier/feed/page.tsx` -> `CourierFeed` runtime.
2. `src/app/(courier)/courier/offers/page.tsx` -> `MyOffersList` runtime.
3. `src/features/requests/components/request-offers-list.tsx` -> `acceptOfferAction` runtime.
4. `src/features/requests/components/request-offers.test.tsx` -> mock del mismo `acceptOfferAction`.

No se registraron consumidores externos de:
- `OfferSheet`
- `RequestCard`
- `UnderReview`
- `FeedSkeleton`
- `OFFERS_COPY`
- `submitOfferAction`
- `withdrawOfferAction`
- schemas runtime

Por lo tanto D06 ya permite continuar sin una nueva decisión de P1.

## PR82-H31 — sigue abierto

No hubo cambio productivo en `src/features/offers/index.ts`, así que el bundle sigue:

```text
/courier/feed   192 kB
/courier/offers 192 kB
```

Límite: <=180 kB.

## Fix exacto esperado

Reducir `src/features/offers/index.ts` a:

```ts
export type {
  SubmitOfferFormInput,
  WithdrawOfferFormInput,
  AcceptOfferFormInput,
  AvailableRequestItem,
  CourierStatus,
  CourierStatusInfo,
  CourierOfferItem,
} from './schemas';

export { acceptOfferAction } from './actions';
export { CourierFeed } from './components/courier-feed';
export { MyOffersList } from './components/my-offers-list';
```

Esto:
- preserva los tres consumidores runtime reales;
- elimina runtime Zod del `export * from './schemas'`;
- elimina `submitOfferAction` y `withdrawOfferAction` del API cliente público porque no tienen consumidores externos;
- elimina componentes internos sin consumidores externos;
- mantiene `acceptOfferAction`, requerido por el Client Component merchant;
- conserva el único entry point legal, sin disable de boundaries.

## CI exact-head — run 36304405258

- build ✅
- unit ✅
- db-tests ✅
- audit ✅
- lint ✅
- typecheck ✅
- bundle-budget job ✅ advisory
- bundle funcional T-204 ❌ 192/192 kB

No se aprueba ni mergea.
