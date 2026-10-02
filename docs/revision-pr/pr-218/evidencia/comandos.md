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
