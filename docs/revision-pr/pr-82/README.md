# Revisión PR #82 — [T-204] Datos en vivo con TanStack Query

- **PR:** [#82](https://github.com/cadeApp/cadeApp/pull/82)
- **Tarea:** `T-204` (Fase 2 · Datos en vivo con TanStack Query y Supabase Realtime)
- **Issue:** [#31](https://github.com/cadeApp/cadeApp/issues/31)
- **Autor / Zona:** `asako669` (P2)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **SHA revisado (Ronda 1):** `a2ab69a01eaec4b6b6a918e7298023cfa03ea373`
- **SHA revisado (Ronda 2):** `d085677e1a108a09083927fc47cd20008b578a34`
- **`develop` al abrir Ronda 2:** `ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`
- **Estado actual:** ❌ **CON BLOQUEANTES** (Ronda 3: 3 bloqueantes, 0 decisiones pendientes)

## Resumen de la Ronda 2

La implementación de T-204 ya existe y los arreglos de `PR82-H04` a `PR82-H06` están bien encaminados por inspección: los tests ahora exigen invalidación positiva, cleanup del debounce y emulan el `QueryClient` productivo. Sin embargo, el comportamiento vivo todavía no queda demostrado de punta a punta.

Bloqueantes actuales:

1. **`PR82-H09` — feed no cableado:** `CourierFeed` sigue renderizando el array `requests` recibido desde el Server Component y no consume `useAvailableRequests`; además el hook, sin `fetcher`, refetchea el mismo `initialRequests`.
2. **`PR82-H10` — `useTrip` puede refetchear sin consultar ninguna fuente:** si no se pasa `fetcher`, su `queryFn` devuelve `initialTrip` otra vez.
3. **`PR82-H11` — debounce multi-key pierde invalidaciones:** un único timer cancela el evento anterior aunque corresponda a otra `queryKey`.
4. **`PR82-H12` — configuración Realtime congelada:** el efecto no depende de `subscriptions/table/filter/queryKey/event/schema`; si cambian con el mismo `channelName`, el canal sigue invalidando la configuración anterior.
5. **`PR82-H14` — rama desactualizada:** quedó 28 commits detrás del `develop` actual; antes de arreglar debe mergear `origin/develop` (sin rebase) y conservar la ficha actual.
6. **`PR82-H15` — evidencia roja no demostrada:** la PR marca que cada prueba nueva fue demostrada en rojo, pero la bitácora solo conserva la fase roja inicial por módulos inexistentes; no hay rojo por mutación para los arreglos de la ronda.

Decisiones de Lautaro073 resueltas antes de cerrar la ronda:

- **D01 / 1-A:** ampliar T-204 para cablear el feed real ahora. Se autoriza agregar a la ficha los archivos exactos necesarios de `CourierFeed` y su test existente.
- **D02 / 2-A:** mantener `useTrip` en T-204, pero eliminar el fallback silencioso que reutiliza `initialTrip`; debe requerir una fuente real/fetcher y probar que un refetch obtiene estado nuevo. El cableado visual sigue en T-115.

## Historial de rondas

| Ronda | Fecha | SHA revisado | Resultado | Bloqueantes | Mejoras | Decisiones |
|---|---|---|---|---:|---:|---:|
| [Ronda 1](revisiones/ronda-1.md) | 2026-09-24 | `a2ab69a` | ❌ CON BLOQUEANTES | 6 | 2 | 0 |
| [Ronda 2](revisiones/ronda-2.md) | 2026-09-25 | `d085677` | ❌ CON BLOQUEANTES | 6 | 2 | 2 resueltas |
| [Ronda 3](revisiones/ronda-3.md) | 2026-09-25 | `d439457` | ❌ CON BLOQUEANTES | 3 | 0 | 0 |
