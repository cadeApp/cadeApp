# Informe de revisión — PR #223 / T-330 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/223  
**SHA funcional revisado:** `347b004f03ca9ea107162881bc1773bb976b70b4`  
**Fecha:** 2026-10-02

## Resultado

**SIN BLOQUEANTES.**

## Alcance y sincronización

La ficha T-330 desde `develop` permite:

- `supabase/migrations/*_t330_publish_null_distance.sql`
- `supabase/tests/rpc_requests.sql`
- `docs/tasks/T-330.md`
- `docs/tasks/log/T-330.md`
- `docs/implementation-plan.md`
- `docs/revision-pr/**`

Antes de esta revisión la PR toca exactamente cuatro archivos permitidos:

- `docs/tasks/T-330.md`
- `docs/tasks/log/T-330.md`
- `supabase/migrations/20261003000000_t330_publish_null_distance.sql`
- `supabase/tests/rpc_requests.sql`

Comparación contra `develop`: **3 ahead / 0 behind**, PR mergeable.

## Enumeración completa del contrato T-330

Se revisaron todos los casos relevantes de la clase:

1. **0 puntas ubicadas:** ambos barrios activos sin centroide y sin pins → publica con `route_distance_m = NULL` y `routeDistanceM: null`.
2. **1 punta ubicada:** un barrio con centroide y el otro sin ubicación efectiva → publica con distancia NULL.
3. **2 centroides válidos:** conserva el cálculo existente → 2000 m en fixture.
4. **2 pins válidos sobre barrios sin centroide:** los pins tienen prioridad y conservan el cálculo → 2000 m.
5. **Una coordenada efectiva fuera de bounds + otra punta sin ubicación:** sigue devolviendo `OUT_OF_BOUNDS_AGUILARES` y no publica.
6. **Coordenadas completas fuera de bounds:** sigue rechazando con `OUT_OF_BOUNDS_AGUILARES`.

Los CHECK de bounds del contacto se eliminan únicamente dentro de la transacción pgTAP para poder ejercer el guard propio de la RPC; el archivo termina en `rollback`.

## Migración

Se comparó la función completa de T-330 contra la definición vigente en:

`supabase/migrations/20261002010000_cc015_admin_cancel_requires_incident.sql`

Normalizando únicamente el bloque nuevo de `v_distance`, ambas definiciones son **exactamente iguales**. Por lo tanto T-330 no pierde autorización, consentimiento, suscripción/piloto, locks, estados, incidentes, rate limits, auditoría ni grants.

Cambio funcional único:

```sql
v_distance := case
  when v_lat1 is null or v_lng1 is null or v_lat2 is null or v_lng2 is null then null
  when v_lat1 = v_lat2 and v_lng1 = v_lng2 then 0
  else greatest(500, cálculo_haversine_existente)
end;
```

La migración es append-only y mantiene:

- `security definer`;
- `set search_path = public, pg_temp`;
- `revoke all ... from public, anon, authenticated`.

## RED / GREEN

### RED previo

Commit `cc15d96`, GitHub Actions run `37082270401`:

```text
Failed test 1232: T-330: sin ubicación efectiva la respuesta devuelve routeDistanceM null
Failed test 1233: T-330: sin ubicación efectiva route_distance_m queda NULL (no 500)
Failed test 1235: T-330: con una sola punta ubicada route_distance_m queda NULL
Failed 3/1241 subtests
Files=15, Tests=1671
Result: FAIL
```

Ese RED usa los tests nuevos contra la función anterior. Es equivalente a la mutación de regresión pedida por T-330: retirar el guard NULL vuelve exactamente al comportamiento anterior y los casos 1232/1233/1235 fallan.

### GREEN

Commit `195f285`, run `37083102766`:

```text
Files=15, Tests=1671
Result: PASS
database.types.ts generado sin diff
```

Head funcional `347b004f03ca9ea107162881bc1773bb976b70b4`, CI run **959**:

- typecheck ✅
- lint ✅
- unit ✅ — 114 archivos / 1687 tests
- build ✅
- audit ✅
- db-tests ✅ — 15 archivos / 1671 tests
- bundle-budget ✅

## E2E Preview

Vercel del head funcional: **READY**.

El contexto `e2e-preview` publica `error` con:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Esto es el comportamiento explícito de `.github/workflows/e2e-preview-target.mjs`: si una PR modifica `supabase/migrations/**`, el Preview no recibe secretos ni se considera evidencia E2E porque la rama no aplica esquema al Supabase Develop compartido.

El workflow de resolución termina success y los jobs de E2E quedan skipped. **No es un defecto ni un bloqueante de esta PR.**

## Ajuste documental no funcional

La ficha y el comentario inicial suponían `greatest(500, NULL) = 500` como camino real del bug. El RED mostró que la función previa persistía **26.019.500 m**: el subcálculo Haversine no queda NULL porque `least(1.0, NULL)` ignora el NULL.

La revisión corrige únicamente esa explicación. La solución técnica ya era correcta porque corta antes de todo cálculo cuando falta cualquiera de las cuatro coordenadas.

## Decisiones P1

Ninguna pendiente.

## Conclusión

**T-330 / PR #223 queda SIN BLOQUEANTES.**

Tras el merge, T-330 deja de bloquear T-326 / PR #218. La migración deberá entrar a `develop` para que los entornos compartidos puedan ejercer el flujo E2E con el esquema actualizado.
