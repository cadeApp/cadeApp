# Revisión PR #82 — [T-204] Datos en vivo con TanStack Query

- **PR:** [#82](https://github.com/cadeApp/cadeApp/pull/82)
- **Tarea:** `T-204` (Fase 2 · Datos en vivo con TanStack Query y Supabase Realtime)
- **Issue:** [#31](https://github.com/cadeApp/cadeApp/issues/31)
- **Autor / Zona:** `asako669` (P2)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **SHA revisado (Ronda 1):** `a2ab69a01eaec4b6b6a918e7298023cfa03ea373`
- **Base (`origin/develop`):** `9ab71cb` (`[T-001] Fichas de Fase 2 y Fase 3 (#84)`)
- **Estado actual:** ❌ **CON BLOQUEANTES** (6 bloqueantes, 2 mejoras, 0 decisiones pendientes)

## Resumen de la Ronda 1

La PR #82 fue abierta en **Draft** por el agy de P2 (`asako669`) tras completar únicamente el paso inicial de `tomar-tarea` (fase roja de TDD con 4 archivos `.test.tsx` y la bitácora `docs/tasks/log/T-204.md`).

La revisión independiente en el SHA `a2ab69a` determinó:
1. **Entregables ausentes (`PR82-H01`):** No existe ninguno de los módulos de producción requeridos por la ficha (`src/lib/hooks/use-realtime-invalidation.ts`, `src/features/{requests,offers,trips}/query-keys.ts`, `src/features/offers/hooks/use-available-requests.ts`, `src/features/trips/hooks/use-trip.ts`), y `src/features/requests/hooks/use-request-offers.ts` conserva la implementación previa de `T-113` basada en `useState` y mutación manual en cliente.
2. **Compilación y CI en rojo (`PR82-H02`, `PR82-H03`):** `pnpm typecheck` y el job `typecheck` de CI fallan con 5 errores (`TS2307` por módulos inexistentes, `TS7006` por parámetro `r` con `any` implícito en `use-available-requests.test.tsx:109`, y `TS2353` en `use-request-offers.test.tsx:96`), y `pnpm test` / job `unit` fallan en las 4 suites de la tarea.
3. **Controles ciegos en la batería de pruebas TDD (`PR82-H04`, `PR82-H05`, `PR82-H06` — `P08-control-no-cubre-lo-que-dice`):**
   - En `use-request-offers.test.tsx:128-149`, el test `"DoD: Realtime no escribe la caché a mano, solo invalida queries"` declara `const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')` pero **nunca lo afirma** (`AG-66`). Como consecuencia, **pasa hoy en verde** sobre la implementación vieja de `use-request-offers.ts` que muta manualmente el estado con `setOffers(...)` y no usa TanStack Query (`AG-76`). Además, ese caso de prueba ni siquiera fue incluido en `use-available-requests.test.tsx` ni en `use-trip.test.tsx`.
   - En `use-realtime-invalidation.test.tsx:118-134`, el test `"DoD 3: un canal por pantalla aunque se escuchen múltiples tablas o eventos"` solo pasa una tabla (`table: 'offers'`) y no verifica ni la instancia pasada a `removeChannel` ni la limpieza del timer de debounce si se desmonta la pantalla antes de los `300ms`.
   - En los 3 tests de hooks (`use-request-offers.test.tsx`, `use-available-requests.test.tsx`, `use-trip.test.tsx`), el `QueryClient` de prueba inyecta `refetchOnWindowFocus: true` sin el `staleTime: 60 * 1000` de `src/app/providers.tsx:13`, ocultando que con `initialData` y `staleTime: 60_000` un `refetchOnWindowFocus: true` booleano **no refetchea durante los primeros 60 segundos** al volver a la app con push apagado (se requiere `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'` en el hook; ver `AG-77`).

## Historial de Rondas

| Ronda | Fecha | SHA revisado | Resultado | Bloqueantes | Mejoras | Decisiones |
|---|---|---|---|---|---|---|
| [Ronda 1](revisiones/ronda-1.md) | 2026-09-24 | `a2ab69a` | ❌ CON BLOQUEANTES | 6 | 2 | 0 (resueltas en `9ab71cb`) |
