# Informe de revisión — PR #218 / T-326 — Ronda 2

**SHA funcional revisado:** `1d6f6b2a4042f35e18baf9fef8a014732dcd591e`  
**Base:** `develop@125728b591950f0de2ecd520eea2617415ac9508`  
**Fecha:** 2026-10-03

## Resultado

**SIN BLOQUEANTES.**

Los cinco hallazgos de Ronda 1 quedan **arreglados-verificados**. No se detectaron defectos funcionales nuevos en T-326.

## Sincronización y alcance

- PR abierta, Draft, mergeable.
- Comparación contra `develop`: **12 ahead / 0 behind**.
- Los archivos propios de T-326 permanecen dentro de la lista permitida.
- Los cambios de `src/ui/select.tsx` y T-330 que aparecen en la historia fueron incorporados por el merge de `develop`; en el HEAD son idénticos a `develop`.
- El autor no modificó `docs/revision-pr/pr-218/**` después de Ronda 1.

## Cierre de Ronda 1

### PR218-H01 — Select controlado

**CERRADO.**

CC-018 / #219 fue mergeada mediante PR #222. En el HEAD de T-326:

- `src/ui/select.tsx` tiene el mismo blob que `develop`;
- el onboarding usa `Select`, `SelectTrigger`, `SelectValue`, `SelectContent` y `SelectItem`;
- `value={selectedZoneId ?? ''}`;
- `onValueChange` llama `setValue('defaultPickupZoneId', zoneId, { shouldValidate: true })`;
- no existe workaround que ignore `''`;
- no hay `<select>` HTML nativo operable para barrio.

CI del HEAD ejecuta `onboarding-form.test.tsx` con **21/21** y la suite completa con **1694/1694**.

### PR218-H02 — publish_request fabricaba distancia

**CERRADO.**

T-330 / #220 fue mergeada mediante PR #223. La migración T-330 presente en la rama es exactamente la misma que `develop`; T-326 no vuelve a tocar `request_cycle`.

DB del HEAD: **Files=16, Tests=1689, Result: PASS**.

### PR218-H03 — faltaba RED real del pgTAP

**CERRADO.**

Se verificó una mutación real, sin modificar el test:

- commit `6c8f29b571075b7c29355f294677ffd80882f9aa`;
- la migración/seed dan coordenadas a `Virgen de la Merced`, que la evidencia exige NULL;
- CI run `37085127843`: db-tests RED;
- fallan exactamente las aserciones T-326 11 y 18.

Restauración:

- commit normal `34aa4728eeaca8d656dd25f498497720e70fcf09`;
- run `37085420951`: DB GREEN;
- HEAD actual: DB GREEN.

No se debilitó ni modificó el pgTAP durante la mutación.

### PR218-H04 — ON CONFLICT no convergía

**CERRADO.**

El generador produce para migración y seed:

```sql
on conflict (name) do update
set centroid_lat = excluded.centroid_lat,
    centroid_lng = excluded.centroid_lng,
    active = excluded.active;
```

La cobertura no inspecciona texto como sustituto de comportamiento. El pgTAP:

1. deja `San Lorenzo` con coordenadas viejas aunque la evidencia exige NULL;
2. deja `Chacarita` con coordenadas distintas;
3. toma las sentencias registradas por Supabase para la migración `20261002233000` desde `supabase_migrations.schema_migrations`;
4. las reejecuta;
5. verifica convergencia exacta de las 63 filas.

Run `37084809700` y HEAD actual: DB GREEN.

### PR218-H05 — 03 · 1º de Mayo

**CERRADO.**

Decisión P1: opción A.

Verificación automática de Ronda 2:

```text
barrios-fuente.md:             63
barrios-centroides.json:       63
derivados:                     52
null:                          11
03 — 1º de Mayo:               -27.425778, -65.614882
migration tuples:              63
seed tuples T-326:             63
migration mismatches vs JSON:  0
seed mismatches vs JSON:       0
```

La georreferenciación ya no deja la entrada 03 como pendiente.

## Selector y mutaciones UI

La implementación preserva la semántica previa de coordenadas: pin/GPS explícito tiene prioridad sobre el centro del barrio; un barrio NULL no fabrica lat/lng.

La bitácora registra mutaciones una por vez, restauradas y sin cambiar aserciones:

- volver a `<select>` nativo → 11 fallos / 10 pass;
- desconectar `onValueChange` → 7 fallos / 14 pass;
- fabricar coordenadas para barrio NULL → 2 fallos / 19 pass;
- restaurado → 21/21.

Además, la inspección de los tests confirma que verifican DOM accesible y payload real del action; no son aserciones tautológicas sobre implementación.

## Checks del SHA funcional

CI run `37085722281`:

- typecheck ✅
- lint ✅
- unit ✅ — **114/114 archivos · 1694/1694 tests**
- build ✅
- db-tests ✅ — **16 archivos · 1689 tests**
- bundle-budget ✅
- Vercel Preview ✅ READY
- database.types.ts ✅ sin diff

### Audit

El job `audit` está rojo por:

```text
braces <= 3.0.3
GHSA-vfj7-8cjw-p6xm
Severity: high
path: eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces
```

No es una regresión atribuible a T-326:

- `package.json` del HEAD y de `develop`: mismo blob SHA;
- `pnpm-lock.yaml` del HEAD y de `develop`: mismo blob SHA;
- T-326 no modifica dependencias;
- el propio workflow etiqueta ese paso como **“Audit dependencies (advisory until contracts-v1)”**.

Se registra como condición externa del repositorio, **no como hallazgo bloqueante de esta PR**.

### E2E Preview

El contexto `e2e-preview` publica:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

y el workflow de resolución termina success con los jobs privilegiados skipped. Es el comportamiento esperado para toda PR que contiene `supabase/migrations/**`; no se debe deshabilitar el gate.

## Conclusión

**PR #218 / T-326 queda SIN BLOQUEANTES en Ronda 2.**

No hace falta otra ronda mientras el HEAD funcional no cambie. La revisión no ejecuta el merge.
