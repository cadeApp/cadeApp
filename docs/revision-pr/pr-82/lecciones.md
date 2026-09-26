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

---

## Ronda 2

> Numeración: al cerrar esta ronda, el máximo observado en las ramas remotas activas es `pr-83/AG-87`. Esta PR continúa en `AG-88`.

## `AG-88` · Un refetch que devuelve `initialData` no es una fuente en vivo

**Origen:** `PR82-H09`, `PR82-H10`.

Un hook puede tener `useQuery`, polling, focus, reconnect e invalidación Realtime y aun así no ser “live” si su `queryFn` por defecto retorna el mismo snapshot que recibió del servidor.

La trampa de test es especialmente barata: inyectar un `fetcher` solo en la prueba demuestra que **esa opción** funciona, no que la pantalla productiva tenga una fuente.

> **Regla propuesta.** Para cada hook de datos vivos hay una prueba de integración con su consumidor real, o una prueba de contrato que haga obligatoria la fuente. “Refetch ejecutado” y “dato fresco obtenido” son propiedades distintas.

## `AG-89` · El debounce de Realtime debe coalescer keys, no descartar la anterior

**Origen:** `PR82-H11`.

Un único timer sirve para debouncear una ráfaga solo si todos los eventos invalidan la misma key. En un canal con múltiples suscripciones y keys distintas, `clearTimeout` + “última key gana” pierde trabajo válido.

> **Regla propuesta.** Durante la ventana de debounce se acumulan las query keys afectadas; al vencer se invalidan todas las distintas. El test mínimo dispara dos callbacks con keys distintas antes del timeout y exige dos invalidaciones.

## `AG-90` · La configuración que define una suscripción forma parte de la identidad del efecto

**Origen:** `PR82-H12`.

Guardar `options` en un ref mantiene callbacks frescos, pero no reconfigura una suscripción ya creada. Si cambian `filter`, `event`, `table`, `schema`, `subscriptions` o la `queryKey` capturada, un efecto que depende solo del nombre del canal sigue escuchando/invalidando la configuración anterior.

> **Regla propuesta.** Todo hook de suscripción tiene un test de `rerender`: cambia la configuración conservando el componente montado y demuestra que el evento siguiente usa la configuración nueva.

### Advertencias de proceso

- La instrucción de Ronda 1 que pidió `rebase` sobre la rama de P2 fue un error de la revisión. El procedimiento vigente usa merge de `origin/develop`, nunca rebase/force/amend sobre rama ajena.
- `PR82-H07` no está cerrado: reconnect y query keys sí mejoraron, pero polling/background siguen sin prueba.
- El entorno de esta ronda no pudo clonar GitHub por resolución de red; por eso H02–H06 permanecen `arreglado-sin-verificar` hasta ejecución independiente.

---

## Ronda 3

No se agrega numeración AG nueva.

- H09/H10 son una aplicación directa de **AG-88**: “refetch ejecutado” no equivale a “estado vivo correcto”. En esta ronda aparece la variante de **paridad semántica y de shape** entre SSR y fetch vivo.
- H18 no necesita regla nueva: `AGENTS.md §4` ya prohíbe explícitamente los non-null assertions. El fallo fue de enumeración de la revisión anterior, no ausencia de norma.
- H11/H12 quedaron corregidos conforme a **AG-89/AG-90** por inspección; no se detectó residual en esas clases.
---

## Ronda 4

No se agrega numeración AG nueva.

- **H19** ya está cubierto por una regla raíz explícita de arquitectura (`regla 25 §7`); el aprendizaje es que la revisión anterior validó comportamiento sin volver a leer la frontera de capas.
- **H20** es la aplicación de la regla de revisión existente «pantalla con datos sin estado de error → bloqueante»: `[]`/snapshot/null no pueden representar a la vez ausencia válida y fallo de infraestructura.
- **H21** repite **AG-71**: cuando develop cambia durante una PR larga, cada ronda debe volver a mirar el target; en este caso el cambio no es cosmético porque agrega la fuente canónica CC-008.
- La decisión D03/1-A evita otra ronda ambigua: se especifican endpoint, capa server, contratos Zod, semántica de error, UI y mutaciones antes de devolver el trabajo al agy.
---

## Ronda 5

No se agrega numeración AG nueva.

- **H22** refuerza `P01`: `tsc` verde no valida todos los contratos especiales de Next App Router. Para Route Handlers nuevos, `next build` es parte del contrato.
- **H24** refuerza **AG-70**: una mutación en rojo no sirve si cae por un `TypeError` del mock antes de la aserción que debía proteger.
- **H25** corrige una instrucción de la propia revisión: «usar la fuente canónica» no significa elegir el wrapper más alto si ese wrapper añade trabajo privilegiado ajeno al dato requerido. Para polling, usar la frontera más baja que preserve autorización y contrato.
- El CI mostró otra defensa útil: el job `build` quedó falsamente verde porque `tee` ocultó el exit de `next build`, pero `bundle-budget` falló al no encontrar rutas. Es un follow-up de CI fuera de T-204; no debe arreglarse desde esta PR.
---

## Ronda 6

No se agrega numeración AG nueva.

- **H28** es una falla de enumeración de clase: validar que una query sea fresca, segura y con error state no alcanza si la lista sigue sin cota. La regla 25 §7 debe revisarse en pareja **SSR inicial + refetch live**, porque paginar solo uno deja la misma pantalla incumpliendo.
- En una lista live, el cursor también forma parte del contrato de cache: `useInfiniteQuery` permite conservar páginas cargadas sin volver a introducir escrituras manuales de caché.
- El índice debe seguir el mismo orden keyset (`created_at DESC, id DESC`) y el filtro principal; de lo contrario se cumple la UI pero no la intención de la regla de performance.
- D04/1-A resuelve la contradicción de scope de una vez: snapshot, endpoints, hooks, componentes e índices se corrigen juntos.
---

## Ronda 7

## `AG-91` · No adaptes una API de framework a una llamada inválida del test

**Origen:** `PR82-R01`.

Un Route Handler válido necesita un `Request` real, pero el test de «sin cursor» llamaba `GET()` directamente. Para conservar ese test se hizo opcional el argumento de producción. TypeScript y Vitest quedaron verdes; el validador especial de Next lo rechazó.

> **Regla propuesta:** cuando un framework entrega un argumento obligatorio (Request, params, context), el test debe construir ese argumento. Nunca se hace opcional en producción solo para facilitar una llamada unitaria.

- **R02** repite H18: los helpers de test también están sujetos a la prohibición de `any` y non-null assertions.
- **H29** refuerza AG-70: un texto «RED» no es evidencia si la mutación descrita no puede causar esa salida con el mock actual. El comando/control debe ser reproducible sobre el árbol que se entrega.
- **H30** repite AG-71: cerrar sesión no congela develop; el target se compara otra vez justo antes de declarar readiness.
