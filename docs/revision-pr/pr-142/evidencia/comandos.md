# Evidencia — PR #142 / T-318

## Ronda 2

SHA: `9d34f42841ec9ed9875324e8d81f36dd7234315a`.

Se detectaron PR142-H01, H02 y A01. El detalle histórico queda en `revisiones/ronda-2.md`.

## Ronda 3

SHA funcional revisado: `6947d68ffca5c5510aa0e943355fa1ff33e8bc23`.  
Base: `develop` @ `158f83b2b1bf6211a2bf8e53ae7cd90130edc445`.

### H02 / A01

- PR #143: merged=true.
- `compare develop...feat/T-318-register-errors`: behind=0 / ahead=8.
- `docs/tasks/T-318.md` y `docs/implementation-plan.md` no están en el diff de implementación.

### H01 — sesión como canal de enumeración

Implementación actual:
- alta nueva, sanitizado y códigos explícitos devuelven el mismo `ActionResult`;
- `RegisterForm` hace el mismo `router.push`;
- el test UI compara `push`, `refresh`, alerta y texto.

Hueco:
- `NEW_USER` en `actions.test.ts` y `register-enumeration.test.tsx` usa `session: null`;
- no existe llamada a `supabase.auth.signOut` en `registerAction`;
- `src/server/supabase/server.ts` usa `createServerClient` con almacenamiento en cookies;
- `middleware.ts` + `src/features/auth/server.ts` reconstruyen la sesión desde esas cookies y las guardas cambian el destino efectivo.

Contrato actual de Supabase:
- con Confirm Email habilitado: alta nueva devuelve usuario y `session=null`;
- con Confirm Email deshabilitado: alta nueva devuelve usuario + sesión y queda autenticada;
- una cuenta existente puede devolver `User already registered` en lugar de una sesión.

La propia bitácora reconoce que con Confirm Email OFF la pantalla destino puede diferir. Eso no es un residual externo: la ficha exige misma navegación/resultados observables para esos cuatro caminos.

### CI exact-head

Workflow CI #680 sobre `6947d68ffca5c5510aa0e943355fa1ff33e8bc23`: **7/7 jobs verdes**:
- typecheck
- lint
- unit
- db-tests
- build
- bundle-budget
- audit

El CI verde no cubre H01 porque los mocks del alta nueva fijan `session:null`.
