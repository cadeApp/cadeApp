# Informe de Revisión — PR #82 — Ronda 5

- **Tarea:** `T-204`
- **Autor:** `asako669` (P2)
- **SHA revisado:** `a2845daf49508b17e25228b55ec01e42381b17bb`
- **develop:** `bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Fecha:** 2026-09-26
- **Resultado:** ❌ **CON BLOQUEANTES (5)** · 1 mejora · 0 decisiones pendientes

## Preflight

- La rama integró develop mediante `305f8df` y está **ahead 20 / behind 0**.
- El arreglo propio R4 está en `3467446`; `a2845da` solo agrega la bitácora.
- El diff propio posterior al merge toca 24 archivos y queda dentro del scope D03 aprobado.
- El autor no escribió `docs/revision-pr/pr-82/**`; la revisión sigue en `docs/revisiones`.

## CI del SHA exacto

Run `36253768272`:

- `unit`: ✅ SUCCESS — 64 archivos / 669 tests.
- `typecheck`: ✅ SUCCESS.
- `lint`: ✅ SUCCESS.
- `db-tests`: ✅ SUCCESS.
- `audit`: ✅ SUCCESS.
- `next build`: ❌ **falla dentro del job build** por firma inválida de Route Handler.
- `bundle-budget`: ❌ downstream porque el build no produjo listado de rutas.

El job `build` figura SUCCESS por un defecto del workflow: ejecuta `pnpm build 2>&1 | tee build-output.txt` sin `pipefail`, de modo que conserva el exit de `tee`. No es autorización para tocar `.github/**` en T-204; se registra como follow-up externo.

## Revalidación R4

- **H19 — ARREGLADO/VERIFICADO:** los tres hooks tienen 0 imports `@/lib/supabase/browser` y 0 `.from(`; unit exact-head verde.
- **H20 — ARREGLADO/VERIFICADO:** los casos HTTP 500 de feed/offers/trip pasan en CI y los componentes conservan último dato + alerta/reintento.
- **H21 — ARREGLADO/VERIFICADO:** branch behind 0 y CC-008 está integrado.
- **H02/H03** también se promueven a verificados por los jobs exact-head de typecheck y unit.

## BLOQUEANTES

### PR82-H22 — las dos rutas dinámicas no compilan con Next.js

`offers/route.ts:12` y `trips/route.ts:12` tipan `params` como `Promise<...> | {...}`. Next 15.5.26 exige el contrato Promise de este App Router y `next build` falla antes de generar las rutas.

Corrección exacta en ambas:

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  // ...
}
```

Trip análogo con `tripId`. En tests, TODOS los contexts deben usar `params: Promise.resolve(...)`; borrar los casos de objeto plano.

### PR82-H23 — `useTrip<T>` promete shapes que el endpoint no puede producir

Cuando no hay `initialTrip`, la línea 74 devuelve `LiveTripState` mediante `as unknown as T`. La propia cobertura de CI deja esa línea sin ejecutar.

Quitar el genérico: `useTrip` y `UseTripOptions` trabajan con `TripDetailItem`; el fetcher devuelve `Promise<TripDetailItem | null>`. Si hay initialTrip, merge de `id/status`; si no hay, retornar `parsed.data` directamente. Agregar prueba default HTTP con `initialTrip=undefined`.

### PR82-H24 — el rojo de ownership falla por TypeError del mock

La bitácora afirma que quitar la guarda de merchant da rojo, pero el rojo es `...order is not a function`. El test no demuestra que detecte el bypass.

El test de otro merchant debe tener un `mockFrom(table)` completo también para `offers`. Con código correcto retorna 404 antes de tocar offers. Mutando SOLO la guarda a `if (!record)`, debe continuar a offers y terminar `ok:true`; el test tiene que fallar en la expectativa `result.ok === false`, no por excepción.

### PR82-H25 — polling de trip ejecuta trabajo service-role de avatar innecesario

`getTripLiveStateServer` llama `getTripDetailsServer`. Ese wrapper, además de la RPC CC-008, usa `createAdminClient`, lee `courier_documents` y firma avatar. El hook repite esto cada 30 s aunque solo necesita status.

En `t204.ts` usar `getTripDetailsRpc` con el `createClient()` de sesión ya disponible. Mantener la misma autorización de CC-008 y proyectar solo `{id,status}`. Mapear `UNAUTHENTICATED -> 401`, `UNAUTHORIZED_ACTOR -> 403`, `NOT_FOUND -> data:null`, `INVALID_STATE_TRANSITION -> 409`, resto -> 500. Nunca invocar el wrapper que firma avatar desde este polling.

### PR82-H26 — queda una vía manual de escritura de caché

`useRequestOffers` todavía exporta `setOffers()` que hace `queryClient.setQueryData`; `RequestOffersList` conserva `onRegisterRealtime` y lo usa para insertar ofertas manualmente. Aunque la pantalla normal no lo pasa, el API productivo mantiene exactamente el camino que el DoD prohíbe.

Eliminar `localOffers`, `setOffers` y `onRegisterRealtime`. La única entrada de novedades debe ser evento Realtime -> invalidate -> refetch HTTP.

## MEJORA

### PR82-H27 — declarar `cache: 'no-store'` también en los tres callers

Las rutas ya responden `Cache-Control: no-store`, así que no bloquea; aun así D03 pidió explícitamente `fetch(url, { cache: 'no-store' })`. Aplicarlo en feed/offers/trip y ajustar las expectativas de tests.

## Sin decisiones

No hay ítems 🔵 pendientes.
