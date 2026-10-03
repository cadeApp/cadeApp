# Evidencia reproducible — PR #218 / Ronda 1

**SHA funcional revisado:** `ea2b03a0d5cb5362e046bc6bdf4a0cff7e1169af`

## Consistencia de data

Resultado de comparación automática:

```text
total evidence JSON: 62
derived: 51
null: 11
migration: 62
seed: 62
migration mismatches: 0
seed mismatches: 0
duplicate derived coordinates: 0
out-of-bounds derived coordinates: 0
```

## Georreferenciación

Datos documentados:
- PDF SHA-256: `7dc1206e60a3ffe629fecec389f28e817944ce2b6d1d4c97d1f5044c658dfd93`;
- transformación afín 6 parámetros;
- 19 controles medidos / 17 usados;
- ajuste RMS 24,9 m;
- LOO RMS 32,9 m;
- LOO max 62,7 m;
- 51 puntos derivados / 11 null.

El método usa centro del rótulo circular como punto representativo, no polígono/centroide geométrico. La evidencia lo declara explícitamente.

## H01 — Select

`src/ui/select.tsx` usa `SelectPrimitive.Root`, pero `SelectItem` es un botón propio. La reproducción documentada por el autor registra callbacks `["b",""]` en modo controlado dentro de un form.

CC-018: issue #219.

## H02 — publish_request

Última `request_cycle`:
```sql
v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
...
v_distance := case
  when v_lat1 = v_lat2 and v_lng1 = v_lng2 then 0
  else greatest(500, cálculo)
end;
```

Sin ubicación efectiva, `greatest(500,NULL)=500`.

T-330: issue #220.

## H03 — DB RED

- RED pretendido: run `37073383120` → cancelado antes de db-tests.
- GREEN data: run `37073501023` → `t326_aguilares_zones.sql .. ok`, Files=16, Tests=1671.

## H04 — ON CONFLICT

Migration:
```sql
on conflict (name) do update
set active = true;
```

Seed:
```sql
on conflict (name) do update
set active = excluded.active;
```

No actualizan `centroid_lat/lng`.

## H05 — entrada 03

La evidencia posterior informa:
```text
03 — 1º de Mayo
rótulo circular (03)
punto derivado -27.425778, -65.614882
```

No está en la lista aprobada de 62 ni en migration/seed/test actuales.

## CI conocido

CI #944 sobre el estado anterior a la georreferenciación:
- typecheck/lint/build/audit/db-tests/bundle-budget: GREEN;
- unit: RED deliberado, 11 tests del selector.

El HEAD actual sigue siendo Draft y no debe mergearse antes de resolver dependencias y decisión P1.

---

# Evidencia reproducible — PR #218 / Ronda 2

**SHA funcional revisado:** `1d6f6b2a4042f35e18baf9fef8a014732dcd591e`

## Rama

```text
base develop: 125728b591950f0de2ecd520eea2617415ac9508
head: 1d6f6b2a4042f35e18baf9fef8a014732dcd591e
ahead: 12
behind: 0
mergeable: true
```

## Consistencia final de data

Comparación automática entre fuente, JSON final, migración y seed:

```text
fuente rows: 63
JSON rows: 63
derived: 52
null: 11
03: 1º de Mayo · -27.425778 · -65.614882
migration tuples: 63
seed T-326 tuples: 63
migration mismatches: 0
seed mismatches: 0
```

## H01 / H02 incorporados desde develop

```text
src/ui/select.tsx HEAD == develop: true
20261003000000_t330_publish_null_distance.sql HEAD == develop: true
```

## H03 RED / GREEN

RED:

```text
commit: 6c8f29b571075b7c29355f294677ffd80882f9aa
run: 37085127843
db-tests: failure
T-326 failed tests: 11, 18
```

Restauración:

```text
commit: 34aa4728eeaca8d656dd25f498497720e70fcf09
run: 37085420951
db-tests: success
```

## H04

```text
run 37084809700:
t326_aguilares_zones.sql .. ok
Files=16, Tests=1689
Result: PASS
```

El test altera filas existentes y reejecuta las sentencias reales almacenadas para la migración T-326.

## HEAD funcional

Run `37085722281`:

```text
typecheck      success
lint           success
unit           success
build          success
db-tests       success
bundle-budget  success
audit          failure (advisory externo)

Unit:
Test Files 114 passed (114)
Tests 1694 passed (1694)

DB:
t326_aguilares_zones.sql .. ok
Files=16, Tests=1689
Result: PASS
database.types.ts sin diff
```

Vercel: READY.

E2E: `BLOCKED / REQUIRES DEVELOP MIGRATION` por política esperada de PR con migración.

## Audit externo

```text
package.json HEAD == develop: true
pnpm-lock.yaml HEAD == develop: true
advisory: GHSA-vfj7-8cjw-p6xm
package: braces <=3.0.3
path: eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces
```
