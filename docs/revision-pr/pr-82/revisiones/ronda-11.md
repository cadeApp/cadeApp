# Informe de Revisión — PR #82 — Ronda 11

- **Tarea:** `T-204`
- **SHA revisado:** `828671beea93fe86caa642b31b72c56ecb6a45be`
- **develop:** `7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac`
- **Resultado:** ❌ **CON BLOQUEANTES (1)**
- **Decisión:** D06 / **1-A** — P1 autoriza ampliar scope a `src/features/offers/index.ts` para mantener el entry point legal y optimizar el bundle; el límite de 180 kB no cambia.

## Preflight

- branch behind develop: 0
- cambios desde R10: solo las dos páginas courier + bitácora
- H33 restaura entry points legales sin disables

## PR82-H33 — arreglado/verificado

Exact-head:

```ts
import { CourierFeed } from '@/features/offers';
import { MyOffersList } from '@/features/offers';
```

No hay:
- `eslint-disable-next-line boundaries/entry-point`
- imports desde `@/features/offers/components/*`

CI `36303492221`: lint SUCCESS.

## PR82-H31 — reabierto por residual de bundle

Build real exact-head:

```text
✓ Compiled successfully
✓ Generating static pages (42/42)
/courier/feed   192 kB
/courier/offers 192 kB
```

Bundle-budget:

```text
/courier/feed   192 kB | Supera el límite
/courier/offers 192 kB | Supera el límite
```

Regla 25 mantiene <=180 kB y D05/1-A rechazó excepción.

## Diagnóstico D06

`src/features/offers/index.ts` es el entry point cliente legal, pero hoy expone runtime de una superficie mucho mayor:

```ts
export * from './schemas';
export * from './copy';
export { acceptOfferAction, submitOfferAction, withdrawOfferAction } from './actions';
export { CourierFeed } from './components/courier-feed';
export { OfferSheet } from './components/offer-sheet';
export { RequestCard } from './components/request-card';
export { UnderReview } from './components/under-review';
export { MyOffersList } from './components/my-offers-list';
export { FeedSkeleton } from './components/feed-skeleton';
```

La regla 20 define:
- `index.ts`: API pública apta para cliente;
- `server.ts`: API pública solo servidor y reexporta queries/actions.

`server.ts` ya reexporta las tres actions.

La búsqueda remota de código está incompleta, por lo que NO se presume que un export no tenga consumidores. El fix debe enumerar localmente todos los imports externos del barrel antes de eliminar exports.

## D06 / 1-A — alcance aprobado

Agregar a la ficha:
- `src/features/offers/index.ts`

Y formalizar D06/1-A:
- adelgazar el entry point cliente según consumidores reales;
- no crear nuevos entry points;
- no tocar ESLint/boundaries;
- no subir presupuesto;
- no cambiar comportamiento de components/hooks/actions;
- conservar exports que tengan consumidores externos demostrados.

### Resultado esperado si la enumeración coincide con lo observado

Si fuera de `src/features/offers/**` solo se consumen `CourierFeed` y `MyOffersList` desde el barrel:
- mantener esos dos exports;
- cambiar schemas a exports **type-only** para evitar Zod runtime;
- quitar actions del index (ya viven en `server.ts`);
- quitar `OfferSheet`, `RequestCard`, `UnderReview`, `FeedSkeleton` del API público si no tienen consumidor externo;
- quitar `OFFERS_COPY` del barrel si no tiene consumidor externo.

Si aparece cualquier consumidor externo inesperado, preservar ese símbolo y medir; no modificar al consumidor sin nueva autorización.

## CI exact-head — run 36303492221

- typecheck ✅
- lint ✅
- unit ✅ — 76 suites / 872 tests
- db-tests ✅
- audit ✅
- build ✅ — 42/42
- bundle-budget job ✅ advisory, pero rutas T-204 ❌ 192/192 kB

No se aprueba ni mergea.
