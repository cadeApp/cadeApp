# Evidencia reproducible — PR #159

## Ronda 3

**SHA revisado:** `8aad4db969c148499374ebc24acedfd2c070d44a`

### CI

Run `36815136630` — conclusión `success`.

```text
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
Files=1, Tests=10
Result: PASS

T321_MIGRATION_BASELINE GREEN
T321_M01 RED_OK: platform_settings_insert_count:0
T321_M02 RED_OK: missing:TARGET_ON_CONFLICT_DO_NOTHING, forbidden:DO_UPDATE
T321_M03 RED_OK: missing:TARGET_ON_CONFLICT_DO_NOTHING, forbidden:DO_UPDATE
T321_M04 RED_OK: platform_settings_insert_count:2

Files=13, Tests=1611
Result: PASS
```

### H03/H04

- H03: cerrado por CI + inspección del checker.
- H04: cuerpo de PR contiene `10 aserciones`; no contiene `11 aserciones` ni `1612`.

### Mutación independiente M05/M06

Se ejecutó el mismo `violations()` del workflow contra la migración exacta del SHA revisado.

Mutación M05 agregada después del INSERT válido:

```sql
update public.platform_settings
set value = '1000'::jsonb
where key = 'min_offer_ars'
  and value <> '1000'::jsonb;
```

M06 usa un CTE con el mismo UPDATE.

Salida:

```text
baseline []
m05 []
m06 []
```

Interpretación: el control estático sigue verde aunque una base con `min_offer_ars=1500` sería sobrescrita.

### Control runtime esperado para la siguiente ronda

La migración anterior a T-321 es:

```text
20260927120000_cc012_incidents_contract.sql
```

Supabase documenta `db reset --version <timestamp>` para reconstruir la base hasta una migración concreta y `supabase migration up` para aplicar migraciones pendientes a la base local.

Flujo objetivo:

```bash
pnpm supabase start
pnpm supabase db reset --version 20260927120000 --no-seed

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n1)"
test -n "$DB_CONTAINER"

# insertar cinco valores personalizados
# aplicar T-321 pendiente
pnpm supabase migration up

# comprobar que los cinco personalizados siguen intactos
echo 'T321_PRESERVE_EXISTING GREEN'

# luego probar defaults en base fresca
pnpm supabase db reset --no-seed
pnpm supabase test db supabase/tests/t321_admin_staging_bootstrap.sql

# y restaurar suite normal
pnpm supabase db reset
pnpm supabase test db
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
```

Este enfoque cubre por comportamiento M01-M06 sin depender de parsear SQL.


---

## Ronda 4

**SHA revisado:** `66a83c1e39273d4c2e9448de60ef894432e50f9d`  
**CI run:** `36816282209` — `success`.

### Sincronización

```text
base: develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a
head: 66a83c1e39273d4c2e9448de60ef894432e50f9d
ahead_by: 11
behind_by: 0
mergeable: true
```

### Secuencia runtime observada

```text
Applying migration 20260927120000_cc012_incidents_contract.sql...
Finished supabase db reset on branch feat/T-321-admin-staging-bootstrap.

INSERT 0 5
Connecting to local database...
Applying migration 20260930224700_t321_admin_staging_bootstrap.sql...
Local database is up to date.

DO
T321_PRESERVE_EXISTING GREEN
```

No se aplicó T-321 en el reset previo; `migration up` fue quien la aplicó después de cargar los cinco valores personalizados.

### Base fresca sin seed

```text
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
All tests successful.
Files=1, Tests=10
Result: PASS
```

### Suite DB completa

```text
All tests successful.
Files=13, Tests=1611
Result: PASS
```

El job continuó con `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts` sin fallar.

### Mutaciones independientes — inspección + CI verde

Por la regla del proyecto para SQL/RLS no se levantó Supabase/Docker local solo para mutar la migración.

**M05 — UPDATE posterior:** la fixture runtime parte de `min_offer_ars=1500`. Un UPDATE destructivo a 1000 dejaría rojo el bloque PL/pgSQL, que compara explícitamente contra 1500 y levanta `T-321 overwrote min_offer_ars`.

**M06 — CTE destructivo:** si un CTE altera cualquiera de los cinco valores, produce el mismo estado final incorrecto y cae en la comprobación correspondiente. El control es independiente de la sintaxis de la escritura.

### CI completo

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success
```

### Cuerpo de PR

La revisión actualizó directamente la frase obsoleta “control ... con mutaciones en memoria” por la descripción del control runtime actual. No hubo cambio de código asociado.
