# Stack aprobado y patrones (reutilización, estado, datos, formularios, rendimiento, escalado)

## 1. Dependencias aprobadas
Solo estas. Las versiones exactas las fija la tarea que las instala. Cualquier otra necesita la aprobación de
Lautaro073 en la ficha (regla 00).

| Para qué | Paquete |
|---|---|
| Framework | `next`, `react`, `react-dom` |
| Datos y auth | `@supabase/supabase-js`, `@supabase/ssr`, `server-only` |
| Esquemas | `zod` |
| Estilos | `tailwindcss` (+ plugin PostCSS), `clsx`, `tailwind-merge`, `class-variance-authority` |
| Componentes base | shadcn/ui (se copia a `src/ui`, usa primitivas Radix) y `lucide-react` para íconos |
| Animaciones | `motion` (Motion para React, `motion/react`), con presets en `src/ui/motion/` |
| Toasts | `sonner` (a través del componente `Toaster` de shadcn/ui y el helper `notify` de `src/ui`) |
| Estados de carga | `Skeleton` de shadcn/ui en `src/ui` (sin librería extra) |
| Formularios | `react-hook-form`, `@hookform/resolvers` |
| Estado de servidor en cliente | `@tanstack/react-query` |
| Fechas | `date-fns` (locale `es`); zona horaria con `Intl` (`America/Argentina/Buenos_Aires`) |
| Mapas y geolocalización | `@vis.gl/react-google-maps` (T-116; wrapper oficial liviano de Google Maps, **carga diferida obligatoria** con `next/dynamic`) |
| Push, PWA, imágenes, errores | `web-push` (T-203), `@serwist/next` o equivalente compatible (T-201), `browser-image-compression` (T-121), `@sentry/nextjs` (T-310) |
| Dev | `typescript`, `eslint`, `eslint-config-next`, `eslint-plugin-boundaries`, `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `jsdom`, `@playwright/test`, `@axe-core/playwright`, `supabase` (CLI) |

Prohibido sin aprobación: otra librería de UI, de estado, de toasts o de animación (GSAP, react-spring, react-hot-toast), ORMs, clientes HTTP extra (`axios`), `moment`, `lodash` completo.

## 2. Estructura y nombres
- Feature nueva = copia de `src/features/_template/` con `components/`, `hooks/`, `actions.ts`, `queries.ts`,
  `query-keys.ts`, `schemas.ts`, `copy.ts`, `index.ts` y `server.ts`.
- Archivos en `kebab-case` (`offer-card.tsx`, `use-offers.ts`). Componentes exportados en `PascalCase`, hooks `useX`,
  server actions `verbNounAction` (`submitOfferAction`).
- Base de datos en `snake_case`; TypeScript en `camelCase`. La conversión se hace **solo** en `src/server/rpc/*` y `queries.ts`.
- URLs cortas y en inglés (`/login`, `/register`, `/requests/new`, `/trips/[id]`); los textos visibles, en español.
- Tests al lado del archivo (`*.test.ts[x]`); E2E en `e2e/specs/*.spec.ts`.

## 3. Reutilización
1. **Antes de crear algo, buscalo:** `src/ui`, `src/lib`, `src/domain` y los `index.ts` de las features. El agente
   tiene que mostrar qué buscó.
2. **Los componentes base viven solo en `src/ui`** (button, input, card, dialog, badge, skeleton, toast…). Las features
   los componen; nunca los copian ni los re-estilan con clases sueltas. Si falta uno, se agrega a `src/ui` con un
   contract-change liviano (lo aprueba P2 y lo revisa Lautaro073).
3. **Formateadores únicos** en `src/lib/format/`: `formatArs`, `formatDate`, `formatPhone`, `whatsappLink`. No se
   reimplementan.
4. **Textos de UI** en `copy.ts` de cada feature (es-AR). Los mensajes por `DomainErrorCode`, en `src/lib/error-messages.ts`.
5. **Regla de tres:** la segunda vez que aparece la misma lógica se tolera; la tercera, se extrae a `src/lib`
   (si es UI o utilidad) o a `src/domain` (si es regla de negocio), con tests.
6. **Sin abstracciones prematuras:** nada de repositorios, factories o componentes "genéricos" configurables sin tres usos reales.

## 4. Estado: árbol de decisión
1. **Dato del servidor que se muestra:** lo lee un Server Component vía `queries.ts`.
2. **Mutación:** Server Action que valida con Zod, llama a la RPC y hace `revalidatePath` o `revalidateTag`.
3. **Dato del servidor que cambia en vivo** (ofertas, feed de solicitudes, viaje): TanStack Query con claves de
   `query-keys.ts`, arrancando con los datos del servidor. Supabase Realtime **invalida** la query (no escribe en la
   caché a mano). `refetchOnWindowFocus` y `refetchOnReconnect` activos (cubre T-204).
4. **Estado de UI local** (abierto/cerrado, paso del formulario): `useState` o `useReducer` en el componente.
5. **Filtros, orden o pestaña que se comparten por link:** `searchParams` parseados con Zod.
6. **Formulario:** `react-hook-form` + `zodResolver` con el schema de `schemas.ts`. El servidor vuelve a validar con
   **el mismo** schema.
7. **Estado de cliente compartido por componentes lejanos:** primero se sube el estado o se usa un Context acotado a
   la feature. Un store global (p. ej. Zustand) solo con aprobación de Lautaro073.

Nunca: copiar datos del servidor a un store global, ni hacer `fetch` en `useEffect` si un Server Component o una query lo resuelve.

## 5. Zod
- **Un schema es la fuente de verdad**; los tipos salen de `z.infer`. No se duplican interfaces a mano.
- Schemas de entidades compartidas en `src/domain/schemas/`. Los de formularios, en `features/x/schemas.ts`, reutilizando
  los de dominio con `.pick`, `.extend` o `.refine`.
- **Se parsea en todas las fronteras:** inputs de actions, route handlers, `searchParams`, payloads de Realtime y de push,
  `localStorage`, columnas JSON y variables de entorno.
- Variables de entorno: `src/server/env.ts` (con `server-only`, secretos) y `src/lib/env.public.ts` (`NEXT_PUBLIC_*`).
  Se validan al arrancar y la app falla rápido si falta algo.
- Mensajes de validación en es-AR, definidos en el schema, cortos y accionables.
- `safeParse` en fronteras con el usuario (devuelve `ActionResult`); `parse` en código interno donde un error es un bug.

## 6. Datos y rendimiento
- **Server Components por defecto.** `"use client"` solo en hojas interactivas; nunca una página entera por comodidad.
- **Sin cascadas:** lecturas independientes en paralelo (`Promise.all`); `select` solo de las columnas necesarias.
- **Toda lista paginada** (máximo 50 por página, cursor por `created_at`/`id`) y con índice que respalde el filtro (lo define P1).
- **Streaming:** `loading.tsx` y `Suspense` con skeletons de `src/ui` en secciones lentas; `error.tsx` por segmento.
- **Caché:** los datos de usuario autenticado nunca se cachean públicamente. Las mutaciones invalidan por tag de entidad (`request:<id>`, `offers:<requestId>`).
- `next/image` con `sizes`, `next/font`, e imports dinámicos para lo pesado y poco usado (cámara, compresión).
- **Mapas y carga diferida (D15):** el componente `src/ui/map.tsx` se importa obligatoriamente mediante `next/dynamic(() => import('@/ui/map'), { ssr: false, loading: () => <MapSkeleton /> })` solo en pantallas que lo requieren (C01, C03, C06, R07). Nunca en bundles iniciales, `layout.tsx`, ni en el feed de solicitudes del repartidor (R04, R05), protegiendo el presupuesto de 180 KB First-Load JS.
- **Realtime:** un canal por pantalla, desuscripción al desmontar y refetch con debounce.
- **Presupuestos** (se miden en CI y en T-205):
  - first-load JS de hasta 180 KB gzip por ruta de comercio o repartidor;
  - Lighthouse móvil ≥ 80 en rendimiento y ≥ 95 en accesibilidad en las pantallas clave.
- **Medir antes de optimizar:** nada de `useMemo` o `useCallback` "por las dudas".

## 7. Escalado
- **Features independientes:** borrar una feature solo rompe a quienes importan su `index.ts` o `server.ts`.
- **Sin SQL ni clientes Supabase en features:** todo pasa por `src/server`.
- **Configuración en `platform_settings`, no en constantes.** Límites y piso de oferta son parámetros.
- **Trabajo pesado o periódico** en cron o server, nunca en el render.
- **Toda consulta nueva** trae su índice y su prueba de RLS (P1).
- **Logs estructurados** sin datos personales (`src/server/observability`).
