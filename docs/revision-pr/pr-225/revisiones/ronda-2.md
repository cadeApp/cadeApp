# Informe de revisión — PR #225 / CC-019 — Ronda 2

**SHA funcional revisado:** `5cd40ba4aaf6073556a8f31dfd0089da622a6980`  
**Base con la que fue construido:** `develop@125728b591950f0de2ecd520eea2617415ac9508`  
**Develop actual durante la revisión:** `55be618b26d4ab28f4030c8e8a7220d095e559b3`  
**Fecha:** 2026-10-03

## Resultado

**Los hallazgos técnicos de Ronda 1 están cerrados y la decisión P1 está resuelta.**

Queda **un bloqueo de integración**, no un defecto funcional nuevo: la rama está 27 commits detrás del `develop` actual y debe sincronizarse antes de declarar la PR lista para merge.

## Cierre de Ronda 1

### PR225-H01 — cobertura destino/dropoff

**ARREGLADO-VERIFICADO.**

`supabase/tests/cc019_aguilares_service_area.sql` agrega:

- `calculate_route_distance` con cada punto periférico como destino;
- `publish_to(lat,lng)` con pickup válido en el centro y dropoff periférico;
- escritura real de `dropoff_lat/dropoff_lng` sobre la fila de contactos;
- `try_dml` distingue `ok` de `no_row`, evitando un falso verde por UPDATE vacío.

La mutación `3ac6d53ef5fb69b38ee440d12528dee6cdc23b98` cambia **solo**:

- `contacts_dropoff_lat_bounds / contacts_dropoff_lng_bounds`;
- guard `p_dropoff_lat/p_dropoff_lng` de `calculate_route_distance`;
- guard `v_lat2/v_lng2` de `request_cycle`.

No toca pickup/origen ni tests.

CI run `37096584373`:

```text
cc019_aguilares_service_area.sql
Failed 36/116
Tests fallidos:
42-48, 50-54
68-74, 76-80
81-87, 89-93
Result: FAIL
```

Todos son casos nuevos de destino/dropoff. No falla ningún caso de origen.

Revert normal `512a8be99ad959ebbd0c3644f8d702d3524c1213`, run `37096864769`:

```text
cc019_aguilares_service_area.sql .. ok
Files=16, Tests=1787
Result: PASS
database.types.ts sin diff
```

HEAD `5cd40ba4aaf6073556a8f31dfd0089da622a6980`: DB vuelve a 1787 PASS.

### PR225-H02 — regla viva

**ARREGLADO-VERIFICADO.**

La ficha agrega exactamente:

```text
.agents/rules/30-supabase.md, solo la línea del bounding box de Aguilares
```

El diff posterior a Ronda 1 modifica una sola línea en ese archivo:

```text
lat -27.4800 .. -27.3800
lng -65.6450 .. -65.5800
```

No se tocó ninguna otra regla.

### PR225-D01 — límites

**ACEPTADO.**

Lautaro073 aprobó opción A:

```text
minLat = -27.4800
maxLat = -27.3800
minLng = -65.6450
maxLng = -65.5800
```

La ficha CC-019, PR y issue #226 reflejan la decisión. Durante esta revisión se corrigió además el body de #226, que aún decía “pendiente”.

## Revalidación del contrato

La Ronda 1 ya verificó que las dos RPC son idénticas a sus definiciones vigentes salvo los cuatro límites. Desde el revert `512a8be` hasta el SHA funcional `5cd40ba4aaf6073556a8f31dfd0089da622a6980` solo cambian:

- `.agents/rules/30-supabase.md`;
- `docs/contracts/CC-019.md`.

No hubo nueva modificación funcional de las RPC después del GREEN de H01.

## Checks del SHA funcional

CI run `37097235918`:

- typecheck ✅
- lint ✅
- unit ✅ — **114/114 archivos · 1706/1706 tests**
- build ✅
- db-tests ✅ — **16 archivos · 1787 tests**
- bundle-budget ✅
- database.types.ts ✅ sin diff
- Vercel ✅ READY
- audit ❌ advisory externo de `braces`

`package.json` y `pnpm-lock.yaml` son idénticos a `develop`; el audit no es una regresión de CC-019.

E2E run `37097304143`:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
resolve-preview: success
e2e-preview: skipped
```

Esperado para una PR con migración.

## Bloqueo de integración detectado en Ronda 2

Al comenzar Ronda 1, la base era:

```text
develop@125728b591950f0de2ecd520eea2617415ac9508
```

Durante Ronda 2, `develop` avanzó a:

```text
55be618b26d4ab28f4030c8e8a7220d095e559b3
```

Comparación actual:

```text
PR #225 ahead: 11
PR #225 behind: 27
merge base: 125728b591950f0de2ecd520eea2617415ac9508
```

Los 27 commits nuevos modifican únicamente el conjunto de T-304/E2E:

- `e2e/fixtures/roles.ts`;
- `e2e/fixtures/staging-seed.ts`;
- `e2e/specs/request-states.spec.ts`;
- `src/server/e2e/staging-seed.ts`;
- `src/server/e2e/staging-seed.test.ts`;
- documentación/revisión de T-304.

No pisan ningún archivo funcional de CC-019.

Aun así, el CI de `5cd40ba4aaf6073556a8f31dfd0089da622a6980` no prueba el árbol integrado que se mergearía hoy. Por la regla de revisión, la rama debe quedar sincronizada y volver a CI exact-head antes del merge.

## Próximo paso

Agy debe hacer solo:

```bash
git pull --ff-only
git fetch origin
git merge origin/develop
```

Sin rebase, force ni amend.

Después:

- no modificar CC-019 salvo conflicto real;
- push;
- esperar CI/DB/Vercel;
- pedir verificación final.

Si el merge no introduce conflicto funcional y el nuevo exact-head queda verde con el mismo audit externo / gate de migración esperado, la siguiente ronda será solo de integración.

**No mergear #225 todavía.**
