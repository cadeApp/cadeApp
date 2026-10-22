# Informe de revisión — PR #213 / CC-017 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/213  
**SHA funcional revisado:** `2fac315e6d86ffa43863d3fc574bd48a72b89a67`  
**Fecha:** 2026-10-02

## Resultado

**SIN BLOQUEANTES.**

Los tres hallazgos de Ronda 1 quedaron arreglados y verificados.

## PR213-H01 — arreglado-verificado

Se comprobó que:

- `docs/contracts/CC-015.md` coincide **exactamente** con el contrato histórico mergeado en PR #181.
- Existe `docs/contracts/CC-017.md` para zonas activas sin centroide.
- Issue #189 se titula `[CC-017] Permitir zonas activas sin centroide verificado`.
- migración: `20261002200000_cc017_zones_without_centroid.sql`.
- pgTAP: `cc017_zones_without_centroid.sql`.
- `actions.test.ts` fue renumerado descriptivamente a CC-017 sin cambiar la regresión.
- T-326 depende de CC-017 / PR #213 y **no puede iniciar antes del merge**.
- La bitácora T-326 registra la corrección de numeración en forma append-only.

No se modificó la migración histórica de CC-015 ni su comportamiento.

## PR213-H02 — arreglado-verificado

Los cinco `throws_ok` de SQLSTATE `23514` usan ahora:

```sql
null::text
```

como expected message.

Se conservan:
- SQLSTATE `23514`;
- tests estructurales de existencia de `zones_centroid_pair` y bounds;
- `plan(15)`;
- descripción humana de cada caso.

## PR213-H03 — arreglado-verificado

### M1 — reintroducir `zones_active_centroid`

**SHA mutado:** `c5f4f8cfa6fd67da652ada967d5b96efe0dfcab8`  
**CI:** run `37052789350` / #928  
**db-tests:** RED.

Fallos relevantes:
- test 1: `zones_active_centroid no longer exists`;
- test 6: `active zone with both centroid coordinates null is accepted`.

También cayeron 7, 10 y 15 como consecuencia de que la fila activa sin centroide no pudo insertarse.

**Revert:** `ae5c255c81a254dc9d077098c036a46fd9ccba4e`  
**CI:** run `37053345972` GREEN.

### M2 — eliminar `zones_centroid_pair`

La mutación fue ejecutada por la revisión porque el agente tenía bloqueado el push temporal por permisos de su sesión.

**SHA mutado:** `32b746f5a859bcbb359724385db2e5aabd013c04`  
**CI:** run `37069932109` / #931  
**db-tests:** RED.

Fallos:
- test 2: `zones_centroid_pair is preserved`;
- test 8: latitud sin longitud;
- test 9: longitud sin latitud;
- test 10: update a coordenada suelta.

**Restauración:** `2fac315e6d86ffa43863d3fc574bd48a72b89a67`.

## CI final del HEAD restaurado

Run #932 / `37070408547`:

- typecheck ✅
- lint ✅
- unit ✅ **113 files / 1682 tests**
- DB ✅ **15 files / 1660 tests**
- audit ✅
- build ✅
- bundle-budget ✅

El pgTAP específico:

```text
supabase/tests/cc017_zones_without_centroid.sql .. ok
Files=15, Tests=1660
Result: PASS
```

## e2e-preview

No es exigible pre-merge para esta PR porque modifica `supabase/migrations/**`.

El gate la clasifica correctamente como:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

La migración se aplicará a Supabase Develop únicamente después del merge a `develop`.

## Sincronización pendiente

Al cerrar esta ronda, `develop` avanzó 4 commits respecto de la base de la PR.

Se compararon ambos lados y hay **0 archivos solapados**. Los cambios nuevos de develop están en workflows/T-329/revisión #215, no en CC-017 ni T-326.

Por lo tanto no se abre un hallazgo nuevo: resta únicamente mergear `origin/develop` en la rama y validar CI final.

## Metodología

Inspección independiente del historial, comparación exacta de CC-015 restaurado, revisión de CC-017/T-326, CI GREEN y dos mutaciones DB RED separadas. No se levantó Supabase/Docker local.
