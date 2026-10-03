# Evidencia reproducible — PR #225 / Ronda 1

**SHA funcional revisado:** `1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd`

## Sincronización

```text
base: develop@125728b591950f0de2ecd520eea2617415ac9508
head: 1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd
ahead: 6
behind: 0
mergeable: true
```

## RPC: comparación contra develop

Fuentes:

- `20260926003900_coordinates_and_distance_rpc.sql`
- `20261003000000_t330_publish_null_distance.sql`

Procedimiento: extraer cada `create or replace function` de CC-019, sustituir:

```text
-27.4800 → -27.4550
-27.3800 → -27.4100
-65.6450 → -65.6400
-65.5800 → -65.5950
```

Resultado:

```text
calculate_route_distance exact_after_bounds = true
request_cycle exact_after_bounds = true
```

## RED inicial

Run `37093843869`, db job `111119614966`:

```text
cc019_aguilares_service_area.sql
Failed 49/77 subtests
Files=16, Tests=1748
Result: FAIL
```

Los fallos son los casos de aceptación bajo el recuadro viejo.

## GREEN

Run `37094414642`, db job `111121291738`:

```text
cc019_aguilares_service_area.sql .. ok
Files=16, Tests=1748
Result: PASS
database.types.ts generado sin diff
```

## Mutación existente

Run `37094676512`, db job `111122063344`:

```text
Failed test 42..47,53
Failed 7/77 subtests
Result: FAIL
```

La mutación restaura el límite sur viejo en `request_cycle`; los fallos son casos de **retiro/pickup**.

Revert: run `37094946822` → `Result: PASS`.

## HEAD actual

CI #980 / run `37095242718`:

```text
typecheck       success
lint            success
unit            success
build           success
db-tests        success
bundle-budget   success
audit           failure (advisory externo)

Unit:
Test Files 114 passed (114)
Tests 1706 passed (1706)

DB:
Files=16, Tests=1748
Result: PASS
database.types.ts sin diff
```

Vercel: READY.

E2E resolver run `37095308839`:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
resolve-preview: success
e2e-preview: skipped
```

## H01 — hueco de simetría

Casos positivos actuales:

```sql
calculate_route_distance(lat, lng, -27.432000, -65.615000)
publish_from(lat, lng)
```

`publish_from` inserta:

```text
pickup = punto bajo prueba
dropoff = -27.432000, -65.615000
```

Los únicos casos que escriben `dropoff_lat/lng` desde la matriz son casos negativos, apenas fuera del nuevo recuadro.

Por análisis, una mutación que mantenga el recuadro viejo únicamente en el lado destino/dropoff seguiría aceptando todos los positivos actuales y rechazando los negativos, por lo que falta la prueba prescrita del camino simétrico.

## H02 — regla viva

`.agents/rules/30-supabase.md:18`:

```text
lat -27.4550 .. -27.4100
lng -65.6400 .. -65.5950
```

CC-019:

```text
lat -27.4800 .. -27.3800
lng -65.6450 .. -65.5800
```

## Coordinación

- Issue CC-019 creado por revisión: **#226**, label `contract-change`.
- T-326 / #190 marcado `bloqueada`.
- PR #218 recibió comentario de coordinación: `5965408347`.
