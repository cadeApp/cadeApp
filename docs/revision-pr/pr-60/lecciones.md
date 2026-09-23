# Lecciones de la PR #60 para `AGENTS.md` y las reglas

**Fuente:** 7 hallazgos en la ronda 1 (`PR60-H01` a `PR60-H07`). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Contraste con la autorrevisión del agy

El cuerpo del PR llegó con el bloque de `revisar-pr` firmado como:

> `Resultado: SIN BLOQUEANTES · BLOQUEANTES: ninguno · MEJORAS: ninguna`

La revisión independiente encontró **6 bloqueantes** (1 crítico de escalada de rol a `merchant`, 3 altos de guardas/cookies/open-redirect y 2 medios de pruebas y accesibilidad). El contraste confirma el patrón de la #56 (`COMO-ENTREGAR.md`): la autorrevisión comprueba que los checks corrieron, pero no detecta los supuestos implícitos con los que se escribió el código.

## Lecciones propuestas

### AG-54 · Un fallback `profile?.role ?? 'merchant'` convierte cualquier fallo de lectura en una escalada de rol

**Origen:** `PR60-H01` (`server.ts:61`, `queries.ts:36`, `actions.ts:35`)

Para satisfacer el tipo `ProfileRole` sin manejar el caso `profile === null`, el código escribió `profile?.role ?? 'merchant'` en los tres puntos que leen `public.profiles`. El compilador quedó contento porque `'merchant'` es un `ProfileRole` válido, pero en ejecución cualquier usuario sin fila en `profiles` o con un error de lectura (incluido un `courier`) recibe sesión y permisos de comercio.

> **Regla propuesta.** El rol de un usuario nunca tiene un valor por defecto en código (`?? 'merchant'` o `?? 'courier'`). Si `profiles` devuelve `null`, error o un valor que no pasa `profileRoleSchema.safeParse`, la sesión se considera inválida (`null` en queries/middleware y `UNAUTHORIZED_ACTOR` en actions).

### AG-55 · En Next.js App Router los Route Groups `(grupo)` no existen en `pathname` y `startsWith('/rol')` colisiona con sustantivos plurales (`/couriers`, `/merchants`)

**Origen:** `PR60-H02` (`guards.ts:27-45`)

Dos errores de modelo sobre URLs de Next.js App Router:

1. Escribir `pathname.startsWith('/(merchant)')`: Next.js elimina los segmentos entre paréntesis de la URL, por lo que `src/app/(admin)/settings/page.tsx` se sirve en `/settings`, no en `/(admin)/settings`.
2. Escribir `pathname.startsWith('/courier')` y `pathname.startsWith('/merchant')`: como `'/couriers'.startsWith('/courier')` y `'/merchants'.startsWith('/merchant')` son `true`, las rutas de administración `/couriers` (T-122) y `/merchants` (T-123) fueron clasificadas como rutas de repartidor y comercio respectivamente.

> **Regla propuesta.** Toda función de coincidencia de rutas en `middleware.ts` / `guards.ts` debe comparar por segmento completo (`pathname === prefix || pathname.startsWith(`${prefix}/`)`), nunca con `startsWith(prefix)` sin barra final, y debe ser **default-deny** (`!isPublicRoute(pathname)` requiere sesión) en vez de terminar en `return { action: 'allow' }`.

### AG-56 · En `@supabase/ssr`, `NextResponse.redirect()` descarta los tokens rotados si no se copian las cookies de `supabaseResponse`

**Origen:** `PR60-H03` (`server.ts:68-74`)

Cuando `supabase.auth.getUser()` refresca un JWT en `middleware.ts`, `@supabase/ssr` escribe las nuevas cookies en `supabaseResponse`. Si la guarda decide redirigir y retorna `NextResponse.redirect(url)` directamente, las cookies nuevas no viajan al navegador y el refresh token viejo ya quedó consumido en el servidor, cerrando la sesión del usuario.

> **Regla propuesta.** En `updateSession`, toda respuesta alternativa (`NextResponse.redirect`, `NextResponse.rewrite`) posterior a `supabase.auth.getUser()` debe copiar `supabaseResponse.cookies.getAll()` antes de retornarse, y debe tener un test unitario que lo verifique tras un `setAll`.
