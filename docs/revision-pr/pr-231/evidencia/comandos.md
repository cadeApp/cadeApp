# Comandos y evidencia — PR #231 / Ronda 1

**SHA revisado:** `a6b5fbd033e6145165ece256c6cd212040711137`

## 1. Alcance contra develop

```text
base: 973d7fae30c1db610eedf3f07aa52fbff3163a29
head: a6b5fbd033e6145165ece256c6cd212040711137
ahead: 2
behind: 0
changed functional files:
  docs/contracts/CC-020.md
```

## 2. Comparación de los 7 puntos

Se parseó la tabla §4 de CC-020 y se comparó con `referencias-locales.json` y `barrios-centroides.json` de T-326.

```text
contractRows: 7
refsCount: 7
issues: []
```

Se verificó además:

```text
outOfBounds: 0
copiesGeneralAguilares: 0
estado != referencia_local: 0
```

## 3. Consumidor onboarding

Inspección de `src/features/merchants/components/onboarding-form.tsx` en T-326:

```text
selectedZoneCenter =
  selectedZone.centroidLat/centroidLng

effectiveLat = defaultPickupLat ?? selectedZoneCenter.lat
effectiveLng = defaultPickupLng ?? selectedZoneCenter.lng

finalLat = data.defaultPickupLat ?? selectedZoneCenter.lat
finalLng = data.defaultPickupLng ?? selectedZoneCenter.lng
```

El punto de zona es fallback y una coordenada explícita tiene precedencia.

## 4. Consumidor request_cycle

Inspección de la RPC vigente:

```sql
v_lat1 := coalesce(v_contacts.pickup_lat, v_pickup.centroid_lat);
v_lng1 := coalesce(v_contacts.pickup_lng, v_pickup.centroid_lng);
v_lat2 := coalesce(v_contacts.dropoff_lat, v_dropoff.centroid_lat);
v_lng2 := coalesce(v_contacts.dropoff_lng, v_dropoff.centroid_lng);
```

La distancia queda NULL si falta alguna de las cuatro coordenadas efectivas.

## 5. CI exact-head

Run `37102729591`.

```text
typecheck success
lint success
build success
bundle-budget success
unit success
db-tests success
audit failure — braces advisory externo
```

Unit:

```text
Test Files 114 passed (114)
Tests 1731 passed (1731)
workflow tests 47/47
ADR tests 6/6
```

DB:

```text
Files=16, Tests=1787
Result: PASS
database.types.ts generado sin diff
```

Audit:

```text
Package: braces
GHSA-vfj7-8cjw-p6xm
Severity: 2 moderate | 1 high
```

## 6. Preview equivalente

SHA `cd18646560ca22fde41a75316db3dbf599a351db` — anterior al ajuste exclusivamente documental de aprobación:

```text
Vercel READY
E2E chromium: 20 passed
E2E global-settings: 3 passed
Total: 23 passed
```

SHA `a6b5fbd033e6145165ece256c6cd212040711137`:

```text
Vercel: build-rate-limit
```

La diferencia entre ambos SHAs es una sola línea de `docs/contracts/CC-020.md`; no hay diferencias de aplicación.
