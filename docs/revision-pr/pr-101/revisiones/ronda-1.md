# Informe de revisión — PR #101 / CC-007 — Ronda 1

**SHA revisado:** `203654e6d8e7857da12295f3ef83a7b0a9282713`  
**Base:** `develop@7edcfe01ca62762159b053af59204f3de0d94e2b`  
**Resultado:** **CON BLOQUEANTES (7)**

## Decisiones P1 cerradas

### A01 / D06 — Arquitectura
Aprobada la doble barrera completa:

1. `profiles.consent_status`;
2. activación de consentimientos atómica en Postgres;
3. **RLS/RPC como autoridad de seguridad**;
4. `updateSession/evaluateRouteGuard` como segunda barrera UX.

Los guards de Next no sustituyen RLS.

### A02 / D07 — Roles y backfill
- Gate: merchant + courier.
- Admin: exento.
- Backfill merchant/courier: `active` solo si existen TOS + Privacy persistidos; si falta cualquiera → `pending`.

### A03 / D08 — Versiones futuras
Estados:
- `pending`
- `active`
- `reconsent_required`

Publicar una nueva versión legal no fuerza reaceptación automáticamente. Solo un cambio explícitamente marcado como material mueve a usuarios afectados a `reconsent_required`.

## H01 · Contrato desalineado con el repo real

El documento dice que afecta **D1 (Auth, Roles y Perfiles)**. En el master plan, D1 es **Supabase como BaaS**. CC-007 no cambia D1; sí cambia comportamiento visible/autorización, por lo que igualmente requería decisión de Lautaro073, ya tomada.

También:
- P2 vigente es `@KiraK72`, no `@asako669`;
- `guards.ts` no tiene `requireAuth` ni `requireRole`;
- la frontera web real es `updateSession()` en `src/features/auth/server.ts` + `evaluateRouteGuard()` en `guards.ts`.

Corregir CC y body.

## H02 · RLS debe imponer el gate, no solo guards/RPC

Las policies actuales permiten operaciones directamente por `auth.uid()`. Un cliente puede hablar con Supabase sin pasar por middleware de Next.

CC-007 debe definir e implementar un helper DB equivalente a “actor operativo activo” y aplicarlo a las policies/RPC operativas de merchant/courier.

### Allowlist mientras pending/reconsent
Debe quedar explícito qué sí puede hacer una cuenta bloqueada:
- leer el mínimo de su propio profile necesario para conocer rol/status;
- acceder al flujo necesario para regularizar consentimiento;
- leer/registrar consentimientos mediante la frontera autorizada;
- rutas públicas/login/legal.

Debe quedar negado el acceso funcional a merchants/couriers, requests, offers, contacts, incidents, push y RPCs operativas hasta `active`.

Admin queda exento según A02.

## H03 · RPC atómica sin frontera de confianza definida

No basta con escribir “RPC segura”.

La activación debe ser una única transacción que inserte los consentimientos y active el perfil. La RPC no debe ser auto-invocable por un cliente autenticado con versiones arbitrarias.

Contrato esperado:
- función `SECURITY DEFINER` con `search_path` seguro;
- `REVOKE EXECUTE` a `public, anon, authenticated`;
- llamada desde server/service-role confiable;
- T-311 valida contra las versiones legales vigentes antes de invocarla;
- la RPC valida rol/estado/transición y persiste TOS+Privacy + `active` atómicamente.

## H04 · Incorporar A02/A03 al contrato y migración

El documento actual solo propone `pending|active`.

Debe quedar:
- `pending | active | reconsent_required`;
- merchant/courier nuevos nacen `pending`;
- admin no queda sujeto al gate;
- backfill determinista según TOS+Privacy existentes;
- transición a `reconsent_required` únicamente por publicación marcada material;
- aceptación válida posterior vuelve a `active`.

## H05 · PR #101 es solo documental

PR #101 cambia únicamente `docs/contracts/CC-007.md`.

La skill dice que **el PR del contract-change se mergea antes que las tareas afectadas**. El precedente CC-005 (#79) incluyó contrato + implementación + tests en el propio PR de CC.

Por lo tanto CC-007 debe implementar aquí el contrato compartido. T-311 sigue bloqueada hasta ese merge.

### Superficies esperadas
Como mínimo, según el diseño final:
- nueva migración `supabase/migrations/*_cc007_*.sql`;
- `src/types/database.types.ts` regenerado;
- RLS/RPC/helper DB + tests SQL;
- `src/features/auth/server.ts`;
- `src/features/auth/guards.ts` y tests correspondientes;
- documentación CC actualizada.

No modificar migraciones ya mergeadas.

## H06 · Falta matriz de pruebas del invariante

Pruebas obligatorias, incluyendo al menos:

1. merchant/courier `pending`: acceso operativo directo por RLS → denegado;
2. `reconsent_required`: mismo resultado;
3. `active`: acceso permitido según las reglas normales existentes;
4. admin: comportamiento existente no cambia;
5. backfill con ambos consentimientos → active;
6. backfill incompleto → pending;
7. RPC de activación no ejecutable por `authenticated`;
8. activación inserta TOS+Privacy y cambia status en la misma transacción;
9. si la transacción falla, no queda status active sin ambas filas;
10. `updateSession/evaluateRouteGuard` no deja entrar a áreas protegidas a pending/reconsent;
11. mutación: quitar el gate de una policy/RPC/guard relevante debe volver rojo un test.

## H07 · Falta validación P2 correcta

La skill exige P2 + P1 para un cambio que cruza auth/domain y esquema/RPC.

P2 vigente: **`@KiraK72`**. GitHub ya la tiene como reviewer solicitada, pero el contrato dice `@asako669`.

Corregir el documento y obtener visto bueno explícito de `@KiraK72` antes del merge. La decisión P1 ya está dada por A01–A03.

## CI

No se inspecciona CI final mientras H01–H07 estén abiertos.

## Prompt AGY

1. `git pull` en `cc/CC-007-consent-enforcement`.
2. No toques `docs/revision-pr/**`.
3. Actualizá `docs/contracts/CC-007.md` con A01–A03 y H01–H04:
   - no digas que cambia D1;
   - P2 = `@KiraK72`;
   - auth real = `server.ts/updateSession` + `guards.ts/evaluateRouteGuard`;
   - estados `pending|active|reconsent_required`;
   - admin exento;
   - backfill por existencia de TOS+Privacy;
   - RLS/RPC autoridad, guards UX;
   - RPC atómica service-role-only.
4. Implementá CC-007 en **esta misma PR**, no en T-311:
   - migración nueva, nunca editar una mergeada;
   - status + backfill;
   - RPC atómica y grants/revokes;
   - helper/gate en RLS/RPC operativos;
   - tipos DB regenerados;
   - server/guards adaptados sin dejar bypass por acceso directo.
5. Permití únicamente el mínimo flujo de regularización para pending/reconsent; no abras operaciones funcionales.
6. Agregá la matriz de pruebas H06 en DB y auth. Demostrá rojo por mutación antes del verde.
7. Actualizá body del PR (también tiene escapes rotos como `\registerAction` / `auth.users`).
8. Pedí visto bueno explícito a `@KiraK72`.
9. Corré `pnpm db:types`, `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db` y build si corresponde.
10. Push normal y pasá SHA remoto.

T-311 permanece bloqueada hasta mergear CC-007.
