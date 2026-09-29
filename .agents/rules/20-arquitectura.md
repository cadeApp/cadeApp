# Arquitectura y módulos

## Capas y dependencias (ESLint las hace cumplir; no desactivar)
- `src/domain`: TS puro. No importa nada del proyecto.
- `src/lib`, `src/ui`: pueden importar `domain`.
- `src/server`: puede importar `domain`, `lib`, `types`. Todo archivo de `src/server/**` empieza con `import 'server-only'`.
- `src/features/<x>`: importa `domain`, `lib`, `ui`, `server` (solo desde `actions.ts`/`queries.ts`) y otras
  features SOLO por su `index.ts` (cliente) o `server.ts` (servidor).
- `src/app`: importa de `features/*/index.ts`, `features/*/server.ts`, `ui`, `lib`.
- Un archivo `"use client"` nunca importa `src/server/**` ni `features/*/server.ts`, ni directa ni transitivamente.

## Estructura de una feature (copiar `src/features/_template/`)
```
features/<x>/
  components/     # UI de la feature, compone src/ui (cliente o server components)
  hooks/          # hooks de cliente de la feature (TanStack Query, Realtime)
  actions.ts      # "use server"; valida con Zod; llama a src/server/rpc/*; revalida; devuelve ActionResult
  queries.ts      # import 'server-only'; lecturas con el cliente server (respeta RLS), paginadas
  query-keys.ts   # claves de TanStack Query de la feature
  schemas.ts      # Zod de formularios (reusa src/domain/schemas)
  copy.ts         # textos de UI es-AR
  index.ts        # API pública apta para cliente (componentes, hooks, tipos, schemas)
  server.ts       # API pública solo servidor (reexporta queries/actions)
```
Stack, estado, Zod, rendimiento, reutilización y escalado: `.agents/rules/25-stack-y-patrones.md`.

## Raíz de `src/`
```
src/app/        # rutas, layouts, loading/error por segmento; sin lógica de negocio
src/domain/     # TS puro: estados, reglas, errores, rpc-contracts, schemas compartidos, fake de RPC
src/features/   # módulos verticales
src/server/     # supabase/, rpc/, push/, observability/, env.ts (todo server-only)
src/lib/        # utilidades sin estado: format/, error-messages.ts, env.public.ts, hooks/ genéricos
src/ui/         # shadcn/ui + tokens.css + cn.ts (único lugar de componentes base)
src/types/      # database.types.ts generado
```

## Patrones
- RPC: wrappers tipados por dominio en `src/server/rpc/{offers,requests,admin,...}.ts`; mapean errores a `DomainErrorCode`.
- Mientras una RPC real no esté en develop: usar el fake de `src/domain/testing/rpc-fake.ts` activado con
  `RPC_ADAPTER=fake` (solo local/test). Al llegar la real, se borra el uso del fake en esa feature.
- Tiempo real: hook de cliente que se suscribe y además refetchea en `focus`, `visibilitychange` y `online`.
- Route handlers de `api/cron` exigen `Authorization: Bearer ${CRON_SECRET}`.
- Parámetros de negocio nuevos → `platform_settings` (vía contract-change), no constantes.
- Archivos raíz (`src/app/layout.tsx`, `middleware.ts`, `src/app/providers.tsx`) son de P3; `middleware.ts` solo
  llama a la función de sesión exportada por `features/auth/server.ts`.
