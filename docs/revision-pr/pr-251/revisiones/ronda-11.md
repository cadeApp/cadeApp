# PR #251 · T-313 — Ronda 11

- **SHA revisado:** `ced6acd316398707f626de0cc30db3ed1e34da79`
- **Commit previo de revisión:** `be7aa1839483ad6c0b72148535076006c692d211`
- **Fecha:** 2026-10-07
- **Resultado:** CON BLOQUEANTES (3)
- **Hallazgos nuevos:** 0
- **Hallazgos cerrados:** 0
- **Decisiones nuevas:** 0

## Alcance

Desde la ronda 10 entraron tres commits:
1. merge de `develop` / T-347;
2. actualización de la ficha T-313 con D03-A;
3. commit RED `ced6acd` que modifica únicamente `src/features/merchants/actions.test.ts` y `supabase/tests/rls_matrix.sql`.

No hubo edición del autor dentro de `docs/revision-pr/pr-251/**`.

La rama está al día:

```text
develop a773c05cc488a1fc60bfb36512cdca35d12d1271
HEAD    ced6acd316398707f626de0cc30db3ed1e34da79
ahead   35
behind  0
```

## H11 — fase RED verificada

### Unit

Run CI `37591045310`, job `112692332103`:

```text
src/features/merchants/actions.test.ts
13 tests | 2 failed

FAIL alta exitosa...
TypeError: supabase.from(...).upsert is not a function
src/features/merchants/actions.ts:138

FAIL fila merchants no existe / UPDATE afecta 0 filas
TypeError: supabase.from(...).upsert is not a function
src/features/merchants/actions.ts:138
```

El RED es discriminante: los nuevos fakes exponen la cadena UPDATE requerida y el código productivo todavía usa UPSERT.

No se cambió la expectation productiva ni se agregó un fake que haga pasar el camino viejo.

### pgTAP

Run CI `37591045310`, job `112692332530`:

```text
Failed test 27: merchant can update business_name and notes
42501: new row violates row-level security policy for table "merchants"
Looks like you failed 1 test of 65
```

Ese es exactamente el RED esperado por H11: la policy vigente todavía congela `notes`.

La nueva defensa de INSERT directo no falla, por lo que la suite mantiene cerrada la puerta a insertar filas `merchants` desde authenticated.

### Otros jobs

```text
typecheck      GREEN
lint           GREEN
build          GREEN
audit          GREEN
bundle-budget  GREEN
unit           RED esperado
db-tests       RED esperado
approval-policy GREEN
```

El status `e2e-preview` del HEAD quedó error/cancelled. No se usa como nueva evidencia funcional porque el commit RED no toca producción; la evidencia funcional previa de H11 sigue siendo `37575010421`.

## Enumeración completa de mocks merchants

Antes de la fase GREEN se enumeraron todos los bloques `table === 'merchants'` en `actions.test.ts`:

1. línea 177 — alta exitosa: ya usa UPDATE;
2. línea 285 — cero filas: ya usa UPDATE;
3. línea 355 — mapeo de error DB: todavía usa UPSERT;
4. línea 477 — setting ausente: UPSERT;
5. línea 542 — setting legado v1: UPSERT;
6. línea 605 — versión futura: UPSERT;
7. línea 673 — versión desactualizada: UPSERT;
8. línea 745 — reintento H13: UPSERT;
9. línea 886 — reintento H13/H14: UPSERT.

En la fase GREEN deben migrarse coherentemente los mocks que alcancen el write de merchant. Los casos que cortan antes del write pueden conservar spies de "no llamado", pero deben reflejar el nombre/contrato nuevo para que la intención no quede atada al UPSERT eliminado.

## H04

Sigue abierto. D02-A continúa prohibido hasta que:
- H11 quede GREEN;
- CI quede GREEN;
- el baseline T-313 normal quede completamente GREEN en trusted Preview.

## H10

Sigue abierto y no se reevalúa como cerrado en esta ronda porque el body todavía corresponde al estado previo al fix productivo.

## P3

No existe visto bueno explícito P3. El spec no cambió en esta fase RED.

## Veredicto

La fase RED está correctamente demostrada. Avanzar a GREEN de H11.

No apruebo ni mergeo.
