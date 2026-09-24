# Lecciones — PR #82 (T-204)

Numeración continua del proyecto. `AG-01`…`AG-75` están en las carpetas de las PRs anteriores (`pr-68` cerró en `AG-75`; esta PR continúa desde `AG-76`).

---

## `AG-76` · Una aserción negativa sobre la API nueva (`expect(setQueryData).not.toHaveBeenCalled()`) pasa en verde sobre el código viejo que ni siquiera usa esa API

**Origen:** `PR82-H04` (pariente de `P08-control-no-cubre-lo-que-dice` y `AG-66`)

En `src/features/requests/hooks/use-request-offers.test.tsx:128-149`, el tercer test de la fase roja de TDD se escribió para verificar el invariante central del DoD de `T-204`: *"Realtime no escribe la caché a mano, solo invalida queries"*:

```ts
  it('DoD: Realtime no escribe la caché a mano, solo invalida queries', async () => {
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useRequestOffers('req-123', initialOffers), { wrapper });

    act(() => {
      if (realtimeCallback) {
        realtimeCallback({ eventType: 'INSERT', new: { id: 'offer-3', amount_ars: 1700 } });
      }
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });
```

Al correr Vitest sobre la rama **antes de migrar `use-request-offers.ts`**, este test **pasa en verde**.

Por qué pasa en verde sobre código que hace exactamente lo prohibido:
1. El `use-request-offers.ts` heredado de `T-113` **no usa TanStack Query**: guarda las ofertas en un `useState` local (`const [offers, setOffers] = useState(...)`) y, cuando llega un evento de Realtime, fabrica un `MerchantOfferItem` incompleto (`normalizeRealtimeOffer(raw)`) y lo inyecta directamente con `setOffers([...currentOffers, normalized])`.
2. Como no usa TanStack Query, llama `0` veces a `queryClient.setQueryData` (y `0` veces a `queryClient.invalidateQueries`).
3. El test declaró `const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')` en la línea 130 y olvidó afirmarlo (`AG-66`), dejando únicamente la aserción negativa `expect(setQueryDataSpy).not.toHaveBeenCalled()`.

Es la trampa clásica al migrar un módulo de una arquitectura a otra: **una prohibición expresada como `not.toHaveBeenCalled()` sobre un método de la librería nueva siempre se satisface si el código sigue usando la librería vieja.**

> **Regla propuesta.** Cuando un test verifica que un evento invalida en lugar de mutar manualmente el estado:
> 1. Debe afirmar la **acción positiva** sobre la librería nueva (`expect(invalidateSpy).toHaveBeenCalledWith(...)` tras el debounce).
> 2. Debe afirmar la **ausencia de efecto inmediato en la salida del hook** antes de que corra el fetcher (`expect(result.current.offers).toHaveLength(1)` inmediatamente después del evento Realtime), además de `expect(setQueryDataSpy).not.toHaveBeenCalled()`. Solo la combinación de ambas detecta tanto `queryClient.setQueryData` como un `useState` paralelo que mute la lista a mano.

---

## `AG-77` · Un `QueryClient` de test con `staleTime: 0` oculta que `refetchOnWindowFocus: true` ignora el foco cuando `providers.tsx` tiene `staleTime: 60_000` e `initialData`

**Origen:** `PR82-H06` (pariente de `P01-contrato-de-framework-no-verificado` y `P08-control-no-cubre-lo-que-dice`)

En producción (`src/app/providers.tsx:13`), el `QueryClient` global de cadeApp se configura con:

```ts
queries: {
  staleTime: 60 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
}
```

En TanStack Query v5, cuando un hook hidrata su estado inicial desde un Server Component mediante `initialData` (`useQuery({ queryKey, queryFn, initialData: initialOffers })`), TanStack Query registra `dataUpdatedAt = Date.now()`. Bajo `staleTime: 60 * 1000`, esos datos se consideran **frescos (`fresh`) durante todo el primer minuto**. Y el valor booleano `refetchOnWindowFocus: true` **solo refetchea queries en estado `stale`**: si el usuario sale de la app (p. ej. a responder un WhatsApp) con el push apagado y vuelve a los 20 segundos, el evento `focus` se dispara pero TanStack Query **no ejecuta `queryFn`**. Para que el foco de ventana o la reconexión refetcheen siempre aunque no hayan pasado 60 segundos desde el SSR, el hook necesita `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'` (o `staleTime: 0`).

Los tres tests de `T-204` (`use-request-offers.test.tsx`, `use-available-requests.test.tsx`, `use-trip.test.tsx`) crearon un `QueryClient` propio en `beforeEach` **sin `staleTime: 60 * 1000`** (por defecto `staleTime: 0`) y con `refetchOnWindowFocus: true` inyectado desde el test. Con ese `QueryClient` de juguete:
- La data nace `stale` en el milisegundo `0`, así que `window.dispatchEvent(new Event('focus'))` siempre refetchea en el test aunque en producción (`providers.tsx`) esté bloqueada durante 60 segundos.
- Y como `refetchOnWindowFocus: true` está puesto en el `defaultOptions` del test, la prueba sigue en verde aunque el hook no configure ninguna opción de refetch.

> **Regla propuesta.** Todo test de un hook de TanStack Query que reciba `initialData` del servidor debe instanciar su `QueryClient` de prueba con el mismo `staleTime: 60 * 1000` de `src/app/providers.tsx` y con `refetchOnWindowFocus: false, refetchOnReconnect: false` en los `defaultOptions` del cliente de prueba. De ese modo, la única forma de que el test pase al disparar `focus` u `online` inmediatamente después del render inicial es que el propio hook configure `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
