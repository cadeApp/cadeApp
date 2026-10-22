# TypeScript y código

- tsconfig: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`. No se relajan.
- Tipos de base: siempre desde `src/types/database.types.ts` (generado). No redefinir filas a mano.
- Errores de dominio: union `DomainErrorCode` de `src/domain/errors.ts`; nunca strings sueltos.
- Resultados: `type ActionResult<T> = { ok: true; data: T } | { ok: false; code: DomainErrorCode }`.
  Una server action nunca lanza hacia la UI: devuelve `ActionResult`.
- Validar con Zod toda entrada externa (formularios, params, searchParams, route handlers, webhooks).
- Funciones puras en `src/domain`: sin IO, sin `Date.now()` implícito (inyectar `now`), con tests.
- Nombres descriptivos; funciones cortas con una responsabilidad; sin código muerto ni comentarios que
  repitan el código. Comentar el porqué, no el qué.
- Nada de lógica de negocio en componentes: va en `domain` (pura) o en RPC (autoridad).
- Sin `console.log` en código mergeado; usar el logger de `src/server/observability` sin datos personales.
