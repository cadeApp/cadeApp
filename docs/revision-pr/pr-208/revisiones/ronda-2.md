# Ronda 2 — PR #208 / CC-016

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `423b56af4911ca1d1ad6ba9f297c653172167731`  
**Resultado:** **SIN BLOQUEANTES**

## Preflight

- Rama: `cc/CC-016-merchant-courier-projection`.
- HEAD: `423b56af4911ca1d1ad6ba9f297c653172167731`.
- develop actual: `cb4111273da663f7591aec370a44767c4e677b82`.
- `compare develop...head`: **ahead 5 / behind 0**.
- merge-base: `cb4111273da663f7591aec370a44767c4e677b82`.
- Merge de sincronización: `759bdbbf3e324b32fe6f549f51c0688a49eb2dd5`, con segundo padre `cb4111273da663f7591aec370a44767c4e677b82`.
- El commit posterior `423b56af4911ca1d1ad6ba9f297c653172167731` modifica únicamente `docs/tasks/log/T-303.md`; no cambia SQL, dominio, server, features, tipos ni contrato.
- No hubo escrituras del autor en `docs/revision-pr/pr-208/**` desde la Ronda 1.

## PR208-H01 · Rama detrás de develop · ARREGLADO VERIFICADO

La Ronda 1 encontró `behind=16`.

Ahora:

```text
base: develop @ cb4111273da663f7591aec370a44767c4e677b82
head: 423b56af4911ca1d1ad6ba9f297c653172167731
status: ahead
ahead_by: 5
behind_by: 0
merge_base: cb4111273da663f7591aec370a44767c4e677b82
```

El merge fue normal y preservó la historia: `759bdbb` tiene como padres `a3160e6` y `cb4111273da663f7591aec370a44767c4e677b82`.

La comparación de develop contra el HEAD actual muestra únicamente los cambios propios de CC-016 + documentación de revisión/bitácora. No aparece ningún archivo funcional nuevo introducido como arreglo lateral.

**Estado:** `arreglado-verificado` en `423b56af4911ca1d1ad6ba9f297c653172167731`.

## Revalidación funcional

No se detectan regresiones respecto de Ronda 1.

Se mantiene:

- `SECURITY DEFINER` + `SET search_path = public, pg_temp`;
- identidad desde `auth.uid()`;
- rol `merchant` + consentimiento activo;
- ownership del request dentro de Postgres;
- mismo `NOT_FOUND` para inexistente/ajena;
- ninguna policy nueva que abra lectura directa de `couriers` o `profiles`;
- proyección limitada a los seis campos aprobados;
- frontera Zod estricta;
- fail-closed en ambos consumidores si la RPC falla o falta un courier.

El merge de develop no tocó los archivos funcionales de CC-016.

## Evidencia RED/GREEN posterior a la sincronización

La bitácora registra las tres mutaciones prescriptas por la revisión en Ronda 1:

1. quitar ownership del fake → cae el caso de comercio ajeno;
2. quitar `.strict()` del schema → caen seis aserciones de campos extra/sensibles;
3. omitir una oferta sin courier en live → cae el test que exige 500.

Resultados registrados:

```text
A: RED 1 failed | 4 passed  -> GREEN 5 passed
B: RED 6 failed | 36 passed -> GREEN 42 passed
C: RED 1 failed | 27 passed -> GREEN 28 passed
```

La restauración se hizo desde contenido guardado en memoria/`finally`; el commit posterior contiene solo la bitácora.

La revisión no vuelve a etiquetar esas ejecuciones como runtime independiente propio: este entorno no puede resolver `github.com` para materializar un checkout. Se verificó que la batería ejecutada coincide exactamente con las mutaciones que la revisión prescribió en Ronda 1 y que el árbol final no conserva ninguna de ellas.

## CI exact-head — run 37042771528 / CI #901

### Unit

```text
Test Files 113 passed (113)
Tests      1670 passed (1670)
```

También quedaron GREEN:

- `.github/workflows/verify-workflows.test.mjs`;
- `docs/adr/verify-adr.test.mjs`.

Esto resuelve el fallo local transitorio de `tools/verify-scaffold.test.ts`: el exact-head completo no lo reproduce.

### DB

```text
Applying migration 20261002083000_cc016_request_offer_couriers.sql...
supabase/tests/cc016_request_offer_couriers.sql .. ok
Files=14, Tests=1645
Result: PASS
pnpm db:types --local
Tipos generados exitosamente en src/types/database.types.ts
```

El job incluye después `git diff --exit-code -- src/types/database.types.ts` y finaliza GREEN.

Typecheck, lint, build, audit y bundle-budget también finalizan GREEN.

## E2E Preview

El status `e2e-preview` aparece como error, pero el job de resolución dice exactamente:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

El job E2E queda `skipped`. Esto coincide con T-327 y con `docs/contracts/CC-016.md`: una feature/CC PR que agrega migraciones no aplica schema remoto antes del merge.

Por lo tanto **no es un bloqueante pre-merge** de CC-016.

El gate funcional restante es post-merge:

```text
merge CC-016 -> develop
migrate-develop GREEN
PR de cierre T-303 / e2e-preview real
Flow 4 GREEN
```

Hasta entonces #200 no debe considerarse funcionalmente cerrado aunque board-sync pueda modificar otros estados administrativos.

## Decisiones

No hay 🔵 decisiones nuevas para Lautaro073.

## Resultado

**SIN BLOQUEANTES.**

La revisión considera CC-016 apta para merge. No se aprueba ni mergea desde esta ronda porque Lautaro073 no lo pidió explícitamente.
