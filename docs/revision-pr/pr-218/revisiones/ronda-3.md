# Informe de revisión — PR #218 / T-326 — Ronda 3

**SHA funcional/integrado revisado:** `77c40b3f349f2928b982c22b5a8f9b39193fa9dd`  
**Base:** `develop@973d7fae30c1db610eedf3f07aa52fbff3163a29`  
**Fecha:** 2026-10-03

## Resultado

**CON BLOQUEANTE: PR218-H06 / CC-020.**

No encontré una regresión técnica en la data, migración, seed, pgTAP ni selector. El bloqueo es contractual: los 7 nuevos `referencia_local` no están autorizados por la semántica vigente de CC-017.

## Sincronización

Durante la revisión `develop` avanzó un commit con T-327. La revisión integró ese commit por merge real:

```text
merge commit: 77c40b3f349f2928b982c22b5a8f9b39193fa9dd
develop: 973d7fae30c1db610eedf3f07aa52fbff3163a29
ahead: 19
behind: 0
mergeable: true
```

T-327 solo modificó workflows/E2E y su documentación; no pisó archivos T-326.

## Data final verificada

Comparación automática de la evidencia versionada:

```text
barrios-fuente rows: 63
barrios-centroides rows: 63
derivado: 56
referencia_local: 7
null: 0
fuera de CC-019: 0
duplicados inesperados: 0
único duplicado: Villa Nueva / El Alto
```

### Cadena de evidencia

Se comparó `barrios-centroides.json` contra las fuentes que usa `final.py`:

- 55 barrios derivados coinciden exactamente con su único punto de `points.json`;
- 17 San Lorenzo coincide exactamente con `area-17.json`:
  - x=359.3
  - y=750.6
  - lat=-27.455981
  - lng=-65.614109
  - 49 rellenos vectoriales
  - 22.009 píxeles rosas;
- los 7 `referencia_local` coinciden exactamente con `referencias-locales.json`;
- El Alto copia exactamente el punto de Villa Nueva, como está documentado.

**0 divergencias en la cadena de evidencia.**

## Generación SQL

`gen_sql.py`:

- exige 63 filas;
- usa bounds de CC-019;
- conserva el upsert determinista de H04;
- apunta a `20261003130000_t326_aguilares_zones.sql`;
- genera migración, seed y pgTAP desde `barrios-centroides.json`.

Comparación contra outputs:

```text
migration tuples: 63
seed tuples: 63
migration mismatches vs evidence: 0
seed mismatches vs evidence: 0
```

## pgTAP

`t326_aguilares_zones.sql` usa plan(20) y cubre:

- 63 filas activas aprobadas;
- legacy `Aguilares` inactiva;
- `Aguilares - Centro`;
- 56 `derivado`;
- 7 `referencia_local`;
- 0 `null`;
- igualdad exacta de cada punto con evidencia;
- no copiar el centro general;
- único punto compartido El Alto/Villa Nueva;
- todos los puntos dentro de CC-019;
- convergencia H04 reejecutando las sentencias reales de la migración aplicada sobre:
  - Santa Rosa (`referencia_local`) divergente;
  - Chacarita (`derivado`) divergente;
- convergencia final de las 63 filas.

## RED / GREEN nuevo

### RED

Mutación `8714e3122cd337fc131517c6940fa04497bb7ae8`:

- solo modifica producción data:
  - migración T-326;
  - seed;
- mueve Santa Rosa de `-27.466365` a `-27.462000`;
- no toca pgTAP.

Run `37099840416`:

```text
t326_aguilares_zones.sql
Failed 3/20
12: every documented point matches the zone centroid
18: stale local-reference barrio converges to documented value
20: after re-applying migration every barrio matches evidence
Files=17, Tests=1807
Result: FAIL
```

### Restauración

Revert normal `e00608e`.

Comparación `695e766...e00608e`: **0 archivos de diferencia**.

Run `37100093628`:

```text
t326_aguilares_zones.sql .. ok
Files=17, Tests=1807
Result: PASS
database.types.ts sin diff
```

## Selector / UI

No hubo cambios funcionales del selector desde Ronda 2.

- `src/ui/select.tsx` HEAD == develop.
- Las mutaciones de UI de Ronda 2 siguen siendo la evidencia aplicable.
- No se reabren H01/H02.

## CI exact-head integrado

Run `37101643494`:

```text
typecheck       success
lint            success
unit            success
build           success
db-tests        success
bundle-budget   success
audit           failure (advisory externo)
```

Unit:

```text
Test Files 114 passed (114)
Tests 1738 passed (1738)
verify-workflows: 47/47
ADR tests: 6/6
```

DB:

```text
t326_aguilares_zones.sql .. ok
Files=17, Tests=1807
Result: PASS
database.types.ts sin diff
```

Vercel: READY.

E2E resolver:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Esperado para una PR con migración.

`package.json` y `pnpm-lock.yaml` son idénticos a develop; el audit de `braces` no es hallazgo de T-326.

## PR218-H06 · ALTO · BLOQUEANTE
### `referencia_local` contradice el contrato vigente de CC-017

CC-017 define como alternativa aceptada para T-326:

- centroide cartográfico derivado con georreferenciación reproducible; o
- `NULL`.

También declara no válido mover/usar un pin manual sin esa georreferenciación.

El HEAD de T-326 introduce:

```text
referencia_local
```

para 7 barrios y persiste esos puntos en `zones.centroid_lat/lng`.

La evidencia de esos 7 puntos es trazable y el usuario aprobó las ubicaciones, pero **eso no modifica por sí solo el contrato compartido**. Además, los consumidores no conocen el tipo de evidencia: ven solo `centroid_lat/lng`, por lo que pueden usar esos puntos como fallback para:

- recentrar onboarding/mapa;
- `defaultPickupLat/defaultPickupLng` sin pin explícito;
- distancia aproximada entre zonas cuando no llegan coordenadas explícitas.

Esto es comportamiento visible y una ampliación de la semántica de CC-017.

### Coordinación

Se creó:

**CC-020 / #230 — Permitir referencia local como punto aproximado de zona**

T-326 / #190 volvió a label `bloqueada`.

### Resolución requerida

**Opción A:** autorizar formalmente `referencia_local` como tercera clase válida de punto aproximado en las columnas actuales, incluyendo el fallback de consumidores.

**Opción B:** mantener CC-017 estricto y volver esos 7 barrios a `NULL` salvo que obtengan un punto derivado permitido.

CC-020 debe mergearse antes que T-326.

## Conclusión

**NO MERGEAR #218 todavía.**

Técnicamente la rama está consistente y verde; el único bloqueo nuevo es CC-020.
