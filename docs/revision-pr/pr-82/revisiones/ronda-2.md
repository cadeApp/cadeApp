# Informe de Revisión — PR #82 — Ronda 2

- **Tarea:** `T-204` — Datos en vivo con TanStack Query y Supabase Realtime (Issue #31)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **Autor / Zona:** `asako669` (P2)
- **SHA revisado:** `d085677e1a108a09083927fc47cd20008b578a34`
- **`develop` actual:** `ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`
- **Fecha:** 2026-09-25
- **Resultado:** ❌ **CON BLOQUEANTES (6)** · 2 mejoras/residuales · 0 decisiones pendientes
- **CI:** no consultado en esta ronda porque todavía hay bloqueantes, según el método de revisión.
- **Checks locales:** no ejecutados: el contenedor de revisión no tiene clon del repo y el intento de clon falló por resolución de red. Los arreglos de Ronda 1 que solo se inspeccionaron quedan `arreglado-sin-verificar`, no `arreglado-verificado`.

## Preflight de la ronda

- El head remoto del PR es `d085677` y coincide con el SHA revisado.
- `develop` avanzó a `ac4587f`: GitHub compara la rama como `diverged`, **6 commits ahead / 28 behind**, merge-base `9ab71cb`.
- GitHub informa `mergeable=true`. No se pudo ejecutar `git merge-tree --write-tree` porque este entorno no pudo clonar/materializar el repositorio; no se presenta `mergeable=true` como sustituto de esa prueba.
- Comentarios revisados: la Ronda 1 y el merge de develop `1786087`; no hay threads inline.
- Bitácora revisada hasta la sesión `2026-09-25 19:20`.
- Historial de `docs/revision-pr/pr-82/`: desde la Ronda 1 solo existe el commit `ce79858` de Lautaro073; **el autor no escribió la carpeta de revisión**.
- Alcance actual del diff: los 17 archivos del PR caen dentro de los archivos permitidos de la ficha vigente al merge-base. D01 autoriza ampliar la ficha para el cableado real del feed.
- Corrección de proceso: la instrucción de Ronda 1 que pidió `rebase` fue incorrecta para una rama ajena. A partir de esta ronda: **merge de `origin/develop`, sin rebase, force-push ni amend**.

## Revalidación de H01–H08

- **H01 · PARCIAL.** Los módulos de producción ya existen, pero `useAvailableRequests` no está conectado al feed real y `useAvailableRequests/useTrip` pueden refetchear el snapshot inicial. El residual se desglosa en H09/H10.
- **H02/H03 · ARREGLADO SIN VERIFICAR.** Por inspección desaparecieron los módulos faltantes y los tipos conflictivos; el autor reporta checks verdes. No se promueven a verificados sin ejecución independiente.
- **H04 · ARREGLADO SIN VERIFICAR.** Los tres hooks ahora afirman no-mutación inmediata + invalidación positiva tras debounce.
- **H05 · ARREGLADO SIN VERIFICAR.** El test de cleanup ahora verifica el canal y timer; DoD 3 registra dos suscripciones en un solo canal.
- **H06 · ARREGLADO SIN VERIFICAR.** Los tests emulan `staleTime: 60s` con focus/reconnect desactivados por default y los hooks fuerzan `'always'`.
- **H07 · PARCIAL (MEJORA).** Query keys y reconnect ya están ejercitados. Sigue faltando probar el polling de 30 s y que no corra en background.
- **H08 · CERRADO para su alcance original.** `1786087` integró el develop de entonces y el cuerpo del PR ya contiene el informe. El nuevo drift de 28 commits se registra como H14.

## BLOQUEANTES

### PR82-H09 · El feed productivo no usa el hook vivo y el hook sin fetcher solo devuelve el snapshot SSR

**Archivos/símbolos:** `useAvailableRequests`, `CourierFeed`, `CourierFeedPage`.

`useAvailableRequests` solo obtiene datos nuevos si se inyecta `options.fetcher`; de lo contrario, su `queryFn` devuelve `[...initialRequests]`. Los tests de focus/online siempre pasan un `fetchMock`, pero el `CourierFeed` real no llama al hook: sigue renderizando el prop `requests` obtenido una vez en el Server Component.

Eso hace que la infraestructura exista sin volver vivo el feed que T-204 dice respaldar.

**Decisión D01 (1-A) de Lautaro073:** ampliar la ficha y resolverlo en T-204. Tras mergear develop, agregar como paths autorizados exactos:
- `src/features/offers/components/courier-feed.tsx`
- `src/features/offers/courier-panel.test.tsx`

Cablear `CourierFeed` a `useAvailableRequests` y dar al hook una fuente real de datos (no un snapshot). El test de integración existente debe demostrar que el feed cambia sin reemplazar el prop SSR.

### PR82-H10 · `useTrip` permite un “refetch” que no consulta ninguna fuente

En `useTrip`, si no hay `options.fetcher`, `queryFn` retorna `initialTrip ?? null`. Por tanto, Realtime, focus, reconnect y polling pueden ejecutar correctamente TanStack Query y seguir devolviendo exactamente el estado inicial.

Los tests que observan cambios siempre inyectan `fetchMock`; no prueban la API por defecto.

**Decisión D02 (2-A):** mantener `useTrip` en T-204, pero eliminar el no-op silencioso. Hacer obligatoria una fuente real/fetcher cuando la query esté habilitada (o implementar un fetch real seguro), y probar que el refetch obtiene un estado distinto. El componente visual se cablea en T-115.

### PR82-H11 · El debounce multi-suscripción pierde una invalidación si las query keys son distintas

`useRealtimeInvalidation` tiene un solo `debounceTimerRef`. Cada evento hace `clearTimeout` del anterior y programa uno nuevo con **una sola** `targetKey`.

Con:
- callback A → `['requests']`
- 50 ms después callback B → `['offers']`

B cancela el timeout de A y, al vencer la ventana, solo se invalida `['offers']`.

El propio test DoD 3 registra dos suscripciones con keys distintas, pero solo cuenta `.on()` y `.subscribe()`; nunca dispara ambos callbacks.

**Arreglo esperado:** debouncear la ráfaga, no la key: acumular las keys afectadas durante la ventana y al vencer invalidar todas las distintas (o equivalente que preserve ambas).

### PR82-H12 · Las suscripciones quedan congeladas si cambia la configuración con el mismo canal

El efecto toma `currentOptions = optionsRef.current` una vez y construye `subs`, pero sus dependencias son solo:

`[channelName, enabled, debounceMs, queryClient]`.

Si cambia `queryKey`, `filter`, `event`, `schema`, `table` o `subscriptions` manteniendo el mismo `channelName`, no se recrea el canal; los callbacks conservan el `sub.queryKey` / `currentOptions.queryKey` anterior.

Esto es relevante para `useAvailableRequests(options.filters)`: la key puede cambiar sin cambiar `courier-available-requests`.

**Prueba mínima:** `renderHook(...).rerender()` con una segunda key/filtro y el mismo `channelName`; disparar el callback nuevo y exigir que se invalide la key nueva, no la anterior.

### PR82-H14 · La rama quedó 28 commits detrás de develop

La rama integró `develop` en `1786087`, pero hoy el target está en `ac4587f`. La ficha actual de `develop` ya incluye la directiva visual y la rama todavía conserva la nota anterior.

Además D01 obliga a modificar `CourierFeed`, archivo que cambió en esos commits de develop (T-118). El arreglo no debe hacerse sobre la versión vieja.

**Primero:** `git pull` de la rama y luego **merge `origin/develop`**, sin rebase, force-push ni amend. En `docs/tasks/T-204.md` gana la versión de develop; después se aplica únicamente la ampliación D01.

### PR82-H15 · La evidencia no demuestra en rojo los arreglos que dice haber demostrado

El cuerpo del PR marca:

> Cada prueba nueva se demostró fallando al romper la regla (ver bitácora)

Pero la sesión final de la bitácora solo registra `typecheck/lint/test` verdes. El rojo anterior (2026-09-24) es la fase inicial por módulos inexistentes/desalineados, no una mutación de H04/H05/H06/H07.

No alcanza con que el test final sea verde: hace falta demostrar que mata la regresión concreta que dice controlar.

**Arreglo:** para cada cambio de esta ronda, registrar en la bitácora el rojo y verde de una mutación pertinente. No tocar `docs/revision-pr/**`.

## MEJORAS / RESIDUALES

### PR82-H07 · Falta testear el polling de 30 s y background

El código tiene `refetchInterval: 30_000` y `refetchIntervalInBackground: false`, pero ninguna suite adelanta 30 s y verifica el fetch, ni demuestra que no se ejecuta en background. H07 queda `parcial`.

### PR82-H13 · Callbacks de `useRequestOffers` ejecutados durante render

`onOfferAdded/onOfferUpdated` se invocan en el cuerpo del hook al comparar `previousOffersRef` y `currentOffers`. Es un side effect durante render y cambia la semántica de la implementación anterior.

Mover la notificación a `useEffect` y agregar un caso con callbacks evita updates externos durante render y duplicados por renderizaciones repetidas.

## Lo que está bien resuelto

- H04 ya no depende de una aserción puramente negativa: exige `invalidateQueries` con la key canónica.
- H05 ahora prueba cleanup del timer pendiente y que las múltiples suscripciones usen un único canal.
- H06 replica las opciones globales relevantes de `providers.tsx`, así el test no regala el refetch al hook.
- La PR no introdujo dependencias nuevas ni cambios de contrato.
- El autor respetó `docs/revision-pr/**`: no intentó firmar sus propios hallazgos como verificados.

## Decisiones

- **D01 / 1-A — RESUELTA:** cablear `CourierFeed` ahora y ampliar el scope exacto de T-204 para ese componente + su test.
- **D02 / 2-A — RESUELTA:** mantener `useTrip`, pero sin fallback de refetch a `initialTrip`; fuente real/fetcher obligatoria y prueba de frescura.

No quedan decisiones 🔵 pendientes.
