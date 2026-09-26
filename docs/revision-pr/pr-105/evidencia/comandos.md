# Evidencia — PR #105 / T-106 / Ronda 1

## Preflight remoto

```text
head: c25589c68160dd569ce645026f799312c443228e
develop actual: 6ac32e77f6995bec82a0c2957d6b59739cbe096b
ahead/behind: +9 / -2
merge ref: 25665537447b0de08fa0c137ea9a1fac5d6fe097
merge ref message: Merge c25589c... into 6ac32e7...
changed files: 7
fuera de alcance: 0
comments: 0
review threads: 0
```

El entorno de revisión no pudo resolver `github.com` al intentar un checkout local. No se inventa salida de `git merge-tree`; se usó el merge ref real generado por GitHub contra el `develop` vigente.

## H01 · Vía directa de merchants sigue abierta

En `develop`, la policy heredada es:

```sql
create policy merchants_select_courier on public.merchants
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and app_private.is_merchant_visible_to_courier(profile_id, auth.uid())
  );
```

La migración T-106 crea:

```sql
create or replace view public.merchant_public
with (security_invoker = true)
as
select profile_id, business_name, default_pickup_zone_id, default_pickup_address
from public.merchants;
```

y no hace `drop policy merchants_select_courier` ni reemplaza su condición.

Los controles finales de `rls_coordinates.sql` revisan el catálogo de columnas de la vista y consultas contra la vista, no una consulta directa a `public.merchants`.

Contraejemplo del control: el código vulnerable es el propio SHA revisado y el DB job sigue verde.

```text
run: 36216846664
job db-tests: 108334387875
Applying migration 20260926003900_coordinates_and_distance_rpc.sql...
Applying migration 20260926010000_cc008_trip_details.sql...
rls_coordinates.sql ............ ok
rpc_distance.sql ............... ok
Files=12, Tests=1526
Result: PASS
db:types generado; git diff --exit-code limpio
```

### Mutación que debe matar el arreglo

Después de cerrar H01, restaurar **temporalmente en la implementación** la policy courier anterior y ejecutar la suite DB. El nuevo caso que consulta `public.merchants` debe quedar rojo.

No modificar el test, su expectativa, el fixture ni `plan(...)` para obtener ese resultado. Revertir la mutación antes de commit.

## H02 · La fase roja histórica no ejerció las reglas

Commit de fase roja declarado: `81e08b08653deee704a3f50765f5996c95882141`.

GitHub Actions:

```text
run: 36215443077
job db-tests: 108330380086

rls_coordinates.sql: ERROR: INVALID_SIGNUP_ROLE
Failed 22/22 subtests
Parse errors: Bad plan. You planned 22 tests but ran 0.

rpc_distance.sql: ERROR: INVALID_SIGNUP_ROLE
Failed 20/20 subtests
Parse errors: Bad plan. You planned 20 tests but ran 0.

Files=11, Tests=1472
Result: FAIL
```

La evidencia contradice `docs/tasks/log/T-106.md:9`, que atribuye ese rojo a la inexistencia de RPC/vista.

## Falsos positivos comprobados

### Observabilidad del wrapper

`calculateRouteDistanceRpc` incluye los argumentos en `details.input` al alertar, pero la ruta real es:

```text
calculateRouteDistanceRpc
  -> sendCriticalAlert(payload)
  -> scrubPii(payload.details)
  -> scrubber: *_lat / *_lng => [REDACTED_COORD]
  -> Discord / fallback
```

Por eso no se reporta fuga de coordenadas desde ese bloque.
