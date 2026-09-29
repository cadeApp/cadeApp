# Evidencia — PR #105 / T-106

## Ronda 1

Ver el informe [ronda-1.md](../revisiones/ronda-1.md). Evidencia base:

- SHA: `c25589c68160dd569ce645026f799312c443228e`.
- H01: la policy heredada seguía viva con `db-tests` verde.
- H02: run `36215443077`, job `108330380086`, ambas suites nuevas ejecutaron 0 aserciones por `INVALID_SIGNUP_ROLE`.

## Ronda 2 — preflight

```text
head revisado: e275613eb0b022932ab17c4333ddc1cf8625b105
develop:       6ac32e77f6995bec82a0c2957d6b59739cbe096b
merge ref:     058a373f1c93736e8832251fef1d4bc08ba09d19
desde R1:      4 commits de autor
archivos desde R1:
  docs/tasks/log/T-106.md
  supabase/migrations/20260926003900_coordinates_and_distance_rpc.sql
  supabase/tests/rls_coordinates.sql
  supabase/tests/rls_matrix.sql
docs/revision-pr/** tocado por autor: no
```

## H01 · RED real

Commit: `2c696d7b7eb603186d7073b2efefe8ba62925ffc`.

```text
Run 36217637214
Job db-tests 108336688266

rls_coordinates.sql
# Failed test 18: "approved courier cannot directly query public.merchants table"
Failed 1/24 subtests

Files=12, Tests=1529
Result: FAIL
```

El fallo es el contracaso pedido en R1 y no proviene de cambiar expectativas, fixtures o `plan(...)` para fabricar resultado.

## H01 · GREEN final

SHA: `e275613eb0b022932ab17c4333ddc1cf8625b105`.

```text
Run 36218778268
Job db-tests 108339947304

Applying migration 20260926003900_coordinates_and_distance_rpc.sql...
Applying migration 20260926010000_cc008_trip_details.sql...
rls_coordinates.sql ............ ok
rls_matrix.sql ................. ok
rpc_distance.sql ............... ok
Files=12, Tests=1529
Result: PASS
[db:types] Tipos generados exitosamente
git diff --exit-code -- src/types/database.types.ts: limpio
```

Implementación verificada por inspección:

```sql
drop policy if exists merchants_select_courier on public.merchants;

create or replace view public.merchant_public
with (security_barrier = true)
as
select
  m.profile_id,
  m.business_name,
  m.default_pickup_zone_id,
  m.default_pickup_address
from public.merchants m
where
  m.profile_id = auth.uid()
  or app_private.is_admin()
  or (
    app_private.is_approved_courier()
    and app_private.is_merchant_visible_to_courier(m.profile_id, auth.uid())
  );
```

Controles asociados:

- courier aprobado relacionado: `public.merchants` → 0 fila;
- courier aprobado relacionado: `merchant_public` → fila segura;
- courier: comercio ocioso → no visible;
- merchant dueño: acceso directo preservado;
- admin: acceso directo preservado;
- catálogo de la vista: sin `notes`, `paid_until`, `subscription_status`, `default_pickup_lat/lng`.

## `rls_matrix.sql` autorizado

El único cambio de la R2 en esa suite reemplaza el origen del test 11:

```text
public.merchants  ->  public.merchant_public
```

Mantiene la misma aserción funcional: ve comercio activo y no ve comercio ocioso.

En el commit de arreglo previo, antes de esa adaptación:

```text
Run 36218143479 · db-tests 108338133127
rls_coordinates.sql ... ok
rls_matrix.sql:
# Failed test 11: "courier sees active merchants with requests but cannot see idle merchant"
Files=12, Tests=1529
Result: FAIL
```

Eso confirma que el cambio de matriz responde exactamente a la arquitectura nueva y no oculta un fallo distinto.

## H02 · corrección de evidencia

Comparación `d8b85230abbdfc09ab4d025e37b2c9fad2d49a92..e275613eb0b022932ab17c4333ddc1cf8625b105`:

- no edita la sesión inicial;
- elimina solo tres líneas en blanco al final;
- añade la sesión correctiva que cita el run/job original y 0 aserciones;
- registra RED real de H01 y el arreglo posterior.

El body del PR deja sin marcar:

```text
[ ] Cada prueba nueva se demostró fallando al romper la regla
```

y documenta por qué.

## CI completo del SHA revisado

```text
CI run 36218778268
typecheck      success
lint           success
unit           success — 55 Test Files, 601 Tests
build          success
audit          success
bundle-budget  success
db-tests       success — Files=12, Tests=1529, Result: PASS
```

El build mantiene `/design-system = 184 kB`, warning preexistente ya tratado en T-311; no es parte de T-106.

## approval-policy

Antes de actualizar el informe del body:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

Después del informe R2:

```text
Run 36219348596
approval-policy: success
```

## Instrumento local

El entorno de revisión no resuelve `github.com` desde el contenedor, por lo que no se inventa salida de `git merge-tree` ni de `node docs/revision-pr/analizar.mjs verificacion`. La estructura JSONL fue validada al construirla y la integración se contrastó con el merge ref real de GitHub y sus jobs.
