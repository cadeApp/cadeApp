# Informe de revisión — PR #287 / T-345 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/287  
**Head SHA revisado:** `59209794df0cbfccd0e83c23336daf6e31f3f25f`  
**Base:** `develop` @ `95e3611b907917174947cdc452bc5b70fd7f7139`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

No hay decisiones 🔵 pendientes ni mejoras necesarias para este paso.

La implementación coincide con el **PR 1/3** definido por T-345 y CC-023: crea la RPC de compatibilidad, agrega su pgTAP, actualiza los tipos generados y no aplica todavía el revoke/grant por columna.

## Alcance e integración

- `develop` actual sigue en `95e3611b907917174947cdc452bc5b70fd7f7139`, igual a la base del PR.
- Compare `develop...HEAD`: `ahead_by=2`, `behind_by=0`.
- Archivos funcionales modificados:
  - `supabase/migrations/20261006120000_t345_cc023_merchant_private_fields_rpc.sql`;
  - `supabase/tests/cc023_private_columns.sql`;
  - `src/types/database.types.ts`;
  - `docs/tasks/log/T-345.md`.
- Todos están permitidos por la ficha.
- `docs/revision-pr/pr-287/**` no tenía historial antes de esta ronda.
- El PR usa `Refs #281`, no `Closes`, como exige la excepción multi-PR.
- Issue #281 sigue abierto y en revisión.

## Contrato de la RPC

La función `public.get_merchant_request_private_fields(uuid)` conserva el patrón aprobado de CC-016 y cumple CC-023:

1. `auth.uid() is null` → `UNAUTHENTICATED`;
2. `p_request_id is null` → `VALIDATION_ERROR`;
3. actor distinto de `merchant` o actor operacional no activo → `UNAUTHORIZED_ACTOR`;
4. solicitud inexistente o ajena → `NOT_FOUND`;
5. solicitud propia → devuelve `requestId`, `notes` y `cashChangeAmount`.

La lectura privilegiada por `SECURITY DEFINER` queda acotada por una comprobación explícita de `merchant_id = auth.uid()`; no depende de RLS para la propiedad de la solicitud.

La función además es:

- `STABLE`;
- `SECURITY DEFINER`;
- `SET search_path = public, pg_temp`;
- `EXECUTE` revocado a `PUBLIC` y `anon`;
- ejecutable por `authenticated`.

El helper `app_private.is_active_operational_actor()` de CC-007 permite admin o consentimiento activo, pero esta RPC valida primero que el rol sea exactamente `merchant`. Por eso un admin autenticado no obtiene acceso y un comercio `pending/reconsent_required` tampoco.

## Tipos generados

El único cambio en `src/types/database.types.ts` es:

```ts
get_merchant_request_private_fields: {
  Args: { p_request_id: string }
  Returns: Json
}
```

El job `db-tests` generó nuevamente los tipos y el posterior `git diff --exit-code -- src/types/database.types.ts` quedó verde. No hay drift ni una forma manual divergente.

## RED reproducido de forma independiente

La evidencia RED vive en PR #286:

- título: `REVIEW ONLY / NEVER MERGE`;
- estado: cerrada, **no mergeada**;
- único archivo: `supabase/tests/cc023_private_columns.sql`;
- no contiene la migración de la RPC.

El blob de esa suite en #286 y el blob que usa #287 son exactamente el mismo:

```text
c44524cd5da08f53b5a3f4095d1163fc60471d69
```

El run `37540600088`, job `db-tests`, falla por el comportamiento real ausente:

```text
ERROR: function "public.get_merchant_request_private_fields(uuid)" does not exist
Failed 16/16 subtests
Files=19, Tests=1811
Result: FAIL
```

La prueba no se reescribió entre RED y GREEN.

## GREEN exact-head

Sobre `59209794df0cbfccd0e83c23336daf6e31f3f25f`, CI run `37542103206`:

| Check | Resultado | Evidencia |
|---|---|---|
| typecheck | ✅ | job success |
| lint | ✅ | job success |
| unit | ✅ | 121/121 archivos, 1921/1921 tests |
| workflows | ✅ | 57/57 |
| ADR | ✅ | 6/6 |
| build | ✅ | `Compiled successfully in 18.0s` |
| audit | ✅ | 1 moderate + 1 high ya ignorado |
| bundle-budget | ✅ advisory | mismo estado cuantitativo que `develop`; ver nota |
| db-tests | ✅ | `cc023_private_columns.sql ... ok`; 19 archivos / 1827 tests |
| tipos DB | ✅ | generación + `git diff --exit-code` sin drift |
| Vercel | ✅ | deployment success |
| e2e-preview | **BLOCKED esperado** | `BLOCKED / REQUIRES DEVELOP MIGRATION` |

### Nota sobre bundle-budget

El job es advisory y reporta varias rutas admin y `/login/mfa` en 235 kB. Se comparó contra el CI del `develop` base (run `37539812713`): **son exactamente los mismos valores y las mismas rutas excedidas**.

Las rutas de comercio/repartidor relevantes al presupuesto siguen dentro de 180 kB, por ejemplo:

- `/courier/feed`: 159 kB;
- `/merchant/requests/[id]`: 163 kB;
- `/design-system`: 178 kB.

No es una regresión de #287 y no se abre alcance desde T-345.

## e2e-preview bloqueado: estado correcto

La ficha T-345 define explícitamente para el PR 1:

```text
PR 1 · migración RPC → BLOCKED / REQUIRES DEVELOP MIGRATION esperado
```

El run `37542246491` ejecutó el resolver confiable y produjo exactamente ese estado; el job E2E fue omitido, no falló funcionalmente.

El checkpoint real posterior a este merge es `migrate-develop GREEN`.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `e2e-preview` aparece como error | Es el estado contractual del PR 1 con migración; no puede correr contra Develop hasta que la migración esté mergeada/aplicada. |
| La suite PR1 no prueba grants por columna | Correcto: esos grants pertenecen al PR 3. PR1 solo valida la RPC de compatibilidad. |
| La suite RED aborta al no existir la función | Es justamente el RED prescripto por la ficha para este paso; el mismo archivo pasa íntegro tras agregar la migración. |
| `bundle-budget` muestra rutas >180 kB | Son idénticas al target `develop` y no están causadas por este diff de DB/tipos. |
| La RPC es `SECURITY DEFINER` | Es requisito de CC-023; la propiedad se revalida explícitamente antes de leer los campos privados. |

## Metodología

Se revisaron la ficha T-345 desde `develop`, CC-023, el patrón CC-016, el helper CC-007, reglas de coordinación multi-PR, comentarios, bitácora, diff completo y los patrones históricos obligatorios de revisión.

Se reprodujo la evidencia RED mediante el log del PR aislado #286 y se comprobó que usa exactamente el mismo blob de pgTAP que el GREEN. La base se verificó mediante los logs de `db-tests`, sin levantar Supabase ni Docker local.

No se formuló ningún hallazgo, por lo que no hay una propiedad defectuosa que requiera una batería independiente de mutaciones.

La revisión independiente no aprobó ni mergeó la PR.
