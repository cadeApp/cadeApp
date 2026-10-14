# Informe de revisión — PR #291 / T-345 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/291  
**HEAD funcional revisado:** `52afdbc4673ac2274e4a56996785ac7bb4d77e3c`  
**Base:** `develop` @ `7e1629806376a8adf6a54cb53d2a5736c9d6bd74`  
**Fecha:** 2026-10-07

## Resultado

**SIN BLOQUEANTES.**

No quedan decisiones 🔵 pendientes.

La única decisión de alcance de la ronda quedó resuelta por Lautaro073 con **A**: se acepta `supabase/tests/rls_matrix.sql` exclusivamente para adaptar la aserción de `anon` al nuevo `REVOKE SELECT`.

## Alcance e integración

- `develop` vigente coincide con la base del PR.
- Compare `develop...HEAD`: `ahead_by=3`, `behind_by=0`.
- Archivos funcionales:
  - `docs/tasks/T-345.md`;
  - `docs/tasks/log/T-345.md`;
  - `e2e/specs/courier-private-columns.spec.ts`;
  - `supabase/migrations/20261006180000_t345_cc023_private_columns.sql`;
  - `supabase/tests/cc023_private_columns.sql`;
  - `supabase/tests/rls_matrix.sql`.
- No hay `src/**`, cambios de RLS, UI ni publicación Realtime.
- No había historial previo en `docs/revision-pr/pr-291/**`.

## PR291-A01 — ampliación de allowlist

La ficha de `develop` no incluía `supabase/tests/rls_matrix.sql`. La rama de #291 lo agregó afirmando una decisión de Lautaro073 que no estaba registrada previamente fuera de la propia rama.

Durante esta revisión se elevó como decisión humana. Lautaro073 respondió **A** el 2026-10-07:

> aceptar la ampliación de alcance y permitir `supabase/tests/rls_matrix.sql` solo para la aserción «anon no ve delivery_requests».

La adaptación es técnicamente coherente:

- antes de CC-023, `anon` podía ejecutar el SELECT pero RLS devolvía 0 filas;
- después de `revoke select on table ... from anon`, la barrera correcta es `42501`;
- el cambio endurece el control y no modifica ninguna otra aserción de la suite.

Estado: **aceptado**.

## Migración de enforcement

La migración:

```sql
revoke select on table public.delivery_requests from anon, authenticated;
grant select (...) on public.delivery_requests to authenticated;
```

concede exactamente las 20 columnas públicas actuales de `delivery_requests` y deja fuera solo:

- `notes`;
- `cash_change_amount`.

La tabla tiene 22 columnas actuales según `database.types.ts`.

No existe ninguna migración posterior en la rama que vuelva a conceder `SELECT` de tabla completo.

No cambia:

- INSERT;
- UPDATE;
- RLS/policies;
- `service_role`;
- publicación Realtime.

## RED independiente

PR aislada #290:

- `REVIEW ONLY / NEVER MERGE`;
- cerrada sin merge;
- solo cambia:
  - `supabase/tests/cc023_private_columns.sql`;
  - `e2e/specs/courier-private-columns.spec.ts`;
- no incluye la migración de enforcement.

Los blobs de ambas pruebas en #290 y #291 son **idénticos**:

```text
cc023_private_columns.sql:
2bb7e399987daf4d311886508236d782c41fa1fc

courier-private-columns.spec.ts:
d0ac3425e125f0e282965c958f25e97e8b2e0bd0
```

### RED pgTAP

Run `37555951681`, job `db-tests`:

```text
Failed 17/42 subtests
Failed tests: 16-23, 25-30, 32-34
Files=19, Tests=1853
Result: FAIL
```

Los fallos son exactamente:

- 5 controles de catálogo/grants;
- 12 lecturas directas de `notes`, `cash_change_amount` y `*` por actor.

### RED E2E

Run `37556067686`:

```text
Running 43 tests using 1 worker
courier-private-columns.spec.ts → failed
Expected: "42501"
Received: undefined
42 passed
1 failed
```

El spec falló porque el courier todavía podía leer `notes`. El mismo fallo se reprodujo en los dos retries.

No se reescribió la prueba para obtener GREEN.

## GREEN exact-head

CI run `37569273030` sobre `52afdbc4673ac2274e4a56996785ac7bb4d77e3c`:

| Check | Resultado | Evidencia |
|---|---|---|
| typecheck | ✅ | success |
| lint | ✅ | success |
| unit | ✅ | 123/123 archivos, 1941/1941 tests |
| workflows | ✅ | 57/57 |
| ADR | ✅ | 6/6 |
| build | ✅ | `Compiled successfully in 25.4s` |
| audit | ✅ | 1 moderate + 1 high ya ignorado |
| db-tests | ✅ | 19 archivos / 1853 tests |
| tipos DB | ✅ | generación + drift check sin diferencias |
| bundle-budget | ✅ advisory | sin regresión atribuible a T-345 |
| Vercel | ✅ | deployment success |

En `db-tests`:

```text
Applying migration 20261006180000_t345_cc023_private_columns.sql...
cc023_private_columns.sql ......... ok
rls_matrix.sql .................... ok
Files=19, Tests=1853
Result: PASS
```

## e2e-preview de PR 3

Run `37569361231`:

```text
PR interna #291 contra develop.
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Esto es el resultado **esperado** para PR 3 según T-345/CC-023. El E2E del enforcement no puede validarse contra Supabase Develop hasta que la migración haya sido mergeada y aplicada por `migrate-develop`.

No se considera fallo funcional.

## Realtime

El E2E contiene una comprobación real de `postgres_changes` con sesión de courier y exige que el UPDATE no contenga los dos campos privados.

Esa parte **todavía no puede validarse en #291** porque el workflow está bloqueado antes de ejecutar Playwright. El contrato define explícitamente el gate posterior al merge para comprobarla.

Por eso esta revisión no afirma todavía que la publicación actual sea suficiente. La decisión operativa correcta es:

1. merge;
2. `migrate-develop` GREEN;
3. PR `review/T-345-post-enforcement-e2e`;
4. exigir E2E GREEN;
5. si Realtime filtra mal, aplicar CC-023 §5 sin tocar el test.

## Bundle budget

El job advisory mantiene la deuda preexistente de rutas admin/`login/mfa` en 235 kB.

Rutas relevantes:

- `/courier/feed`: 159 kB;
- `/merchant/requests`: 103 kB;
- `/merchant/requests/[id]`: 163 kB;
- `/merchant/requests/new`: 163 kB;
- `/design-system`: 178 kB.

No hay regresión atribuible a este PR de DB/tests.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `e2e-preview` está en error | El resolver devuelve el estado contractual `BLOCKED / REQUIRES DEVELOP MIGRATION` para PR3. |
| No se cambió la publicación Realtime | Correcto: CC-023 exige probar primero los grants y usar la alternativa solo si el gate post-merge demuestra exposición. |
| `rls_matrix.sql` cambia de 0 filas a 42501 | Aceptado por Lautaro073; el REVOKE hace que 42501 sea la barrera correcta y más fuerte. |
| El comercio sigue insertando campos privados | CC-023 revoca SELECT, no INSERT/UPDATE. pgTAP cubre `insert ... returning id`. |
| `get_trip_details` sigue devolviendo datos privados | Es la vía permitida post-match y está cubierta por pgTAP. |

## Cierre

La implementación técnica queda **SIN BLOQUEANTES**.

Queda pendiente únicamente el flujo post-merge obligatorio de T-345. Hasta que ese gate E2E no esté GREEN, #281 permanece abierto.

La revisión independiente no aprobó ni mergeó la PR.
