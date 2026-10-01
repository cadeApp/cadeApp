# Informe de revisión — PR #142 / T-318 — Ronda 3

**Head revisado:** `6947d68ffca5c5510aa0e943355fa1ff33e8bc23`  
**Base:** `develop` @ `158f83b2b1bf6211a2bf8e53ae7cd90130edc445`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (1).**

PR142-H02 y PR142-A01 quedaron cerrados con el merge de la ficha #143 y la resincronización. PR142-H01 mejoró sustancialmente, pero sigue abierto por un canal observable de sesión.

## Cerrados

### PR142-H02 — arreglado-verificado
La ficha T-318 ya existe en develop vía PR #143. La rama de implementación está behind=0.

### PR142-A01 — arreglado-verificado
`docs/tasks/T-318.md` y `docs/implementation-plan.md` ya no forman parte del diff de #142.

## BLOQUEANTE

### PR142-H01 — ALTO · la sesión sigue distinguiendo alta nueva de cuenta existente

La implementación igualó correctamente:
- `ActionResult`;
- shape/campos;
- copy;
- `router.push`;
- ausencia de `activate_account_consents` para señales de cuenta existente.

Pero no igualó el efecto de autenticación.

Supabase documenta dos comportamientos soportados:
- Confirm Email ON → alta nueva sin sesión;
- Confirm Email OFF → alta nueva con sesión activa.

Para una cuenta existente, el segundo modo puede devolver `User already registered` sin crear sesión.

En cadeApp, `createServerClient` persiste Auth en cookies y el middleware usa esa sesión para decidir el acceso efectivo a `/merchant/onboarding` o `/courier/onboarding/identity`. Por eso dos llamadas con el mismo `ActionResult` y el mismo `router.push` pueden terminar en pantallas distintas.

La prueba nueva no detecta esto porque `NEW_USER` fija `session:null` y `observeSubmit` solo captura push/refresh/alert/text. Su comentario “todo lo que el usuario puede observar” es más amplio que lo que realmente controla.

**Arreglo mínimo:** si `signUp` devuelve `data.session`, terminar esa sesión con `supabase.auth.signOut({ scope: 'local' })` antes de continuar el flujo de alta/consentimientos. Así el resultado final de registro queda sin sesión tanto para Confirm Email ON como OFF. El test debe usar una alta nueva con sesión no nula y exigir ese `signOut`.

## CI

Exact-head #680: **7/7 jobs verdes**. No invalida el hallazgo: los mocks no ejercen la variante con sesión.

## No revisado / dudas

- No se consultó ni modificó configuración remota de staging.
- No se usaron cuentas reales.
- No aprobé ni mergeé.
