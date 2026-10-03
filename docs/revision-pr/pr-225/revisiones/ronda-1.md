# Informe de revisión — PR #225 / CC-019 — Ronda 1

**SHA funcional revisado:** `1ca6e2ef2fd3761867bd9862acf5d4d2ffe8e6fd`  
**Base:** `develop@125728b591950f0de2ecd520eea2617415ac9508`  
**Fecha:** 2026-10-03

## Resultado

**CON BLOQUEANTES: 2 técnicos + 1 decisión P1.**

La implementación actual de los cuatro límites es coherente y no muestra una regresión funcional en el código revisado. Los bloqueantes son de cobertura de contrato, consistencia de reglas vivas y aprobación explícita del comportamiento visible.

## Sincronización y alcance

- PR abierta, Draft y mergeable.
- `develop...cc/CC-019-aguilares-service-area`: **6 ahead / 0 behind**.
- 10 archivos cambiados, todos declarados por la ficha actual de CC-019.
- La revisión creó el issue faltante **#226** y volvió a marcar T-326 / #190 como bloqueada.

## Implementación verificada

### SQL

La migración reemplaza exactamente estos 8 CHECK:

- `zones_centroid_lat_bounds`
- `zones_centroid_lng_bounds`
- `merchants_default_pickup_lat_bounds`
- `merchants_default_pickup_lng_bounds`
- `contacts_pickup_lat_bounds`
- `contacts_pickup_lng_bounds`
- `contacts_dropoff_lat_bounds`
- `contacts_dropoff_lng_bounds`

Todos usan:

```text
lat -27.4800 .. -27.3800
lng -65.6450 .. -65.5800
```

Se compararon las RPC completas:

- `public.calculate_route_distance` contra `20260926003900_coordinates_and_distance_rpc.sql`;
- `app_private.request_cycle` contra `20261003000000_t330_publish_null_distance.sql`.

Sustituyendo únicamente los cuatro literales nuevos por los anteriores, ambas definiciones quedan **exactamente iguales** a `develop`. Se conservan autorización, consentimiento, suscripción/piloto, estados, locks, rate limits, incidentes, semántica NULL de T-330, Haversine, `SECURITY DEFINER`, `search_path` y grants.

### TypeScript

Los cambios funcionales en:

- `src/domain/schemas/index.ts`;
- `src/ui/map.tsx`;

son los cuatro valores de `AGUILARES_BOUNDS`. `AGUILARES_CENTER` permanece sin cambios. El mapa agrega test de igualdad contra el dominio.

## RED / GREEN existente

### RED inicial

Commit `b70baf9`, run `37093843869`:

- `cc019_aguilares_service_area.sql`: **49/77 fallos**;
- fallan los casos de aceptación de los puntos periféricos bajo el recuadro viejo;
- DB total: `Files=16, Tests=1748, Result: FAIL`.

Esto demuestra que la suite detecta que el área anterior no admite los puntos propuestos.

### GREEN

Commit `40be373`, run `37094414642`:

- `cc019_aguilares_service_area.sql .. ok`;
- `Files=16, Tests=1748, Result: PASS`;
- tipos DB sin diff.

### Mutación registrada

Commit `524d63d`: límite sur viejo en el guard de `request_cycle`.

Run `37094676512`:

- **7/77 RED**, tests 42–47 y 53;
- son retiros/orígenes periféricos del sur.

Revert normal `39e045b`, run `37094946822`: GREEN.

## PR225-H01 · MEDIO · BLOQUEANTE
### La cobertura no prueba el área nueva en el lado entrega/destino

Archivo: `supabase/tests/cc019_aguilares_service_area.sql:127-177`.

El contrato mínimo dice que cada referencia periférica debe ser aceptada por los CHECK de `delivery_request_contacts`, por `calculate_route_distance` y por `publish_request`.

La suite actual solo coloca cada punto periférico en el lado **pickup/origen**:

```sql
calculate_route_distance(lat, lng, -27.432000, -65.615000)
publish_from(lat, lng)
```

`publish_from` fija siempre el destino en el centro. Para `delivery_request_contacts`, la única prueba que usa `dropoff_lat/lng` es de **rechazo fuera** del recuadro.

Consecuencia: si una regresión dejara únicamente estos caminos con el recuadro viejo:

- `contacts_dropoff_lat_bounds` / `contacts_dropoff_lng_bounds`;
- validación del destino de `calculate_route_distance`;
- `v_lat2/v_lng2` en `request_cycle`;

los casos “afuera” seguirían rechazándose y los casos periféricos actuales seguirían usando solo pickup/origen. La suite no demuestra que un comercio pueda **entregar** en esos barrios, aunque esa es parte central de CC-019.

### Corrección requerida

Agregar cobertura simétrica:

1. cada `cc019_inside` como **dropoff/destino** en `delivery_request_contacts`;
2. cada punto como destino de `calculate_route_distance`;
3. cada punto como entrega de `publish_request`;
4. una mutación real, sin cambiar tests, que vuelva a límite viejo **solo el lado destino/dropoff** y haga RED;
5. revert normal y GREEN.

No hace falta duplicar toda la suite si se crea un helper claro para publicar “hacia” un punto.

## PR225-H02 · MEDIO · BLOQUEANTE
### La regla viva de Supabase quedaría contradiciendo el contrato nuevo

Archivo: `.agents/rules/30-supabase.md:18`.

La regla que todos los agentes deben leer sigue diciendo:

```text
lat -27.4550 .. -27.4100
lng -65.6400 .. -65.5950
```

CC-019 cambiaría runtime, dominio y master plan a:

```text
lat -27.4800 .. -27.3800
lng -65.6450 .. -65.5800
```

La propia ficha detectó la contradicción pero afirma que “no se puede tocar desde una tarea”. Esa frase no alcanza: `AGENTS.md` prohíbe `.agents/**` **salvo que la ficha lo diga**. Este contract-change puede y debe declarar explícitamente ese archivo.

Mergear dejando la regla vieja haría que futuros agentes reciban como instrucción normativa un contrato ya obsoleto.

### Corrección requerida

En `docs/contracts/CC-019.md`:

- agregar `.agents/rules/30-supabase.md` a “Archivos permitidos”;
- actualizar únicamente la línea del bounding box a los cuatro límites aprobados.

No tocar otras reglas.

## PR225-D01 · DECISIÓN P1
### Falta aprobar los cuatro valores propuestos

CC-019 cambia comportamiento visible y D13 “Solo Aguilares”. El contract-change exige decisión de Lautaro073 antes del merge.

Valores propuestos:

```text
minLat = -27.4800
maxLat = -27.3800
minLng = -65.6450
maxLng = -65.5800
```

La evidencia versionada muestra que esos límites incluyen todos los puntos de referencia listados y mantienen margen respecto de ellos. La revisión no sustituye la decisión de producto sobre cuánto margen aceptar alrededor de los barrios.

Estado: **decision-pendiente**.

El issue formal de decisión ya existe: **#226**.

## Checks del SHA funcional

CI #980 / run `37095242718`:

- typecheck ✅
- lint ✅
- unit ✅ — **114 archivos / 1706 tests**
- build ✅
- db-tests ✅ — **16 archivos / 1748 tests**
- bundle-budget ✅
- Vercel Preview ✅ READY
- tipos DB ✅ sin diff
- audit ❌ advisory externo de `braces`
- e2e-preview → `BLOCKED / REQUIRES DEVELOP MIGRATION` ✅ comportamiento esperado

### Audit

`package.json` y `pnpm-lock.yaml` son idénticos a `develop`. El advisory `GHSA-vfj7-8cjw-p6xm` no fue introducido por CC-019 y no se debe arreglar dentro de esta PR.

## Coordinación con T-326

PR #218 sigue abierta. Como CC-019 cambia el contrato que T-326 usa:

- **NO mergear #218 ahora**;
- después de mergear CC-019, T-326 debe sincronizar `develop`;
- su migración actual `20261002233000_t326_aguilares_zones.sql` debe pasar a un timestamp posterior a `20261003120000_cc019_aguilares_service_area.sql`;
- debe regenerar los centroides periféricos permitidos por el área nueva;
- debe volver a DB/CI y a revisión.

La Ronda 2 anterior de #218 no certifica esa futura versión.

## Conclusión

**NO MERGEAR #225 todavía.**

Primero:

1. Lautaro073 decide D01;
2. agy corrige H01 y H02;
3. actualiza la ficha con issue #226;
4. demuestra mutación RED del lado destino + restauración GREEN;
5. pide Ronda 2.
