# Informe de Revisión — PR #82 — Ronda 6

- **Tarea:** `T-204`
- **Autor:** `asako669` (P2)
- **SHA revisado:** `6c52a31233ed4d21c64cd88b306b89a093112891`
- **develop:** `bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Fecha:** 2026-09-26
- **Resultado:** ❌ **CON BLOQUEANTES (1)** · 0 decisiones pendientes

## Preflight

- Dos commits nuevos desde R5: `092edad` (código H22–H27) + `6c52a31` (bitácora).
- Diff propio R5: 14 archivos, todos dentro del scope autorizado.
- Rama **ahead 22 / behind 0** respecto de develop.
- Sin escrituras del autor en `docs/revision-pr/pr-82/**`.

## CI exact-head

Run `36258029324`:

- `unit`: ✅ 64 suites / 674 tests.
- `typecheck`: ✅.
- `lint`: ✅.
- `db-tests`: ✅.
- `audit`: ✅.
- `build`: ✅ y el log de `next build` genera correctamente las 39 rutas, incluidas las 3 `/api/live/*`.
- `bundle-budget`: ✅.

## Revalidación R5

- **H22 — arreglado/verificado:** ambas routes dinámicas usan `params: Promise<...>`; `next build` real verde.
- **H23 — arreglado/verificado:** `useTrip` ya no es genérico y no contiene `as unknown as T`; camino sin initialTrip cubierto.
- **H24 — arreglado/verificado:** el mock de ownership modela también `offers`, y la guarda ajena retorna 404 antes de esa consulta; el rojo documentado ahora es AssertionError, no TypeError.
- **H25 — arreglado/verificado:** polling usa `getTripDetailsRpc` con cliente autenticado; no firma avatar.
- **H26 — arreglado/verificado:** removidos `setOffers`, `setQueryData` y `onRegisterRealtime` del camino productivo.
- **H27 — arreglado/verificado:** los tres fetch live usan `{ cache: 'no-store' }`.

## BLOQUEANTE

### PR82-H28 — listas live sin paginación end-to-end

`.agents/rules/25-stack-y-patrones.md §7` exige:

> **Toda lista paginada** (máximo 50 por página, cursor por `created_at`/`id`) y con índice que respalde el filtro.

La clase completa de T-204 contiene exactamente dos listas:

1. **Feed del repartidor**
   - SSR `src/features/offers/queries.ts#getAvailableRequests`: sin `.limit`, sin cursor.
   - Live `src/server/live/t204.ts#getAvailableRequestsLiveServer`: sin `.limit`, sin cursor.
   - Hook `useAvailableRequests`: `useQuery`, sin `fetchNextPage`.
   - UI `CourierFeed`: sin «Cargar más».

2. **Ofertas recibidas de una solicitud**
   - SSR `src/features/requests/queries.ts#getMerchantRequestWithOffers`: lee todas las ofertas.
   - Live `getRequestOffersLiveServer`: lee todas las ofertas.
   - Hook `useRequestOffers`: `useQuery`, sin `fetchNextPage`.
   - UI `RequestOffersList`: sin «Cargar más».

`useTrip` queda fuera: es un recurso único.

Los índices actuales tampoco completan el requisito keyset:

- `delivery_requests_published_idx(created_at desc) where status='published'` no incluye el desempate `id`.
- no existe índice `offers(request_id, created_at desc, id desc)`.

## Decisión

**D04 / Lautaro073 1-A — RESUELTA:** corregir ahora en T-204 la paginación completa SSR + API live + hooks + UI + índices. No se acepta paginar solo el endpoint ni diferir el snapshot SSR.

## Arquitectura aprobada para H28

- Tamaño fijo: **50**; cada query obtiene **51** para calcular `hasMore` sin COUNT.
- Cursor client-safe: `{ createdAt: ISO datetime, id: UUID }`.
- Orden estable: `created_at DESC, id DESC`.
- Segunda página: `created_at < cursor.createdAt OR (created_at = cursor.createdAt AND id < cursor.id)`.
- Los endpoints existentes reciben opcionalmente `?cursorCreatedAt=...&cursorId=...`; no se crean nuevas routes.
- Respuesta feed/ofertas: `{ data: [...], nextCursor: cursor | null }`.
- Hooks: `useInfiniteQuery`; derivan la lista plana de `data.pages`, sin `setQueryData`.
- UI: botón **Cargar más** solo cuando `hasNextPage`; estado **Cargando…** durante `isFetchingNextPage`.
- Realtime/focus/reconnect invalidan/refetchean la infinite query sin borrar las páginas ya cargadas.
- Índices mínimos nuevos:
  - partial `delivery_requests(status='published')` sobre `(created_at DESC, id DESC)`;
  - offers sobre `(request_id, created_at DESC, id DESC)`.

El prompt publicado en la PR detalla archivos, queries, contracts, tests y mutaciones.
