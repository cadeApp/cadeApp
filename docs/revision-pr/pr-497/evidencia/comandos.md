# Evidencia y comandos — PR #497 / ronda 1

**SHA de análisis:** `b845f260aad15652c566a7d0f37b6c27a2e8b58c` · **Fecha:** 2026-10-21

## Evidencia observada (no inferida)

GitHub Actions `CI`, run **39699652144**, job `unit` **119565507099**, correspondiente al HEAD indicado:

```text
FAIL tools/verify-fichas.test.ts
Estas fichas no tienen fila en docs/implementation-plan.md §8: T-408, T-409
El DoD de estas fichas no coincide con su fila ... Desincronizadas: T-390, T-391
Test Files 1 failed | 154 passed (155)
Tests 2 failed | 3168 passed (3170)
```

Lectura independiente de `supabase/tests/rls_matrix.sql` en `develop@824c4fdb`: `plan(66)`, caso 49 en líneas 518–524: `delete from public.offers ...` ejecutado sin `throws_ok`. En contraste, el CC exige `revoke ... delete`. Esto es una predicción de falla **por inspección**, no ejecución SQL.

## Reproducción por el autor en un clon limpio

```bash
git fetch origin
git switch cc/CC-036-offers-rpc-only
git pull --ff-only
git rev-parse HEAD
git diff origin/develop...HEAD --stat
pnpm exec vitest run tools/verify-fichas.test.ts
grep -n -C 4 -E 'delete from public.offers|-- 49\.|plan\(66\)' supabase/tests/rls_matrix.sql
grep -n 'casos 46, 50 y 51' docs/tasks/T-390.md docs/contracts/CC-036.md docs/implementation-plan.md
```

- Esperado **antes del arreglo**: 2 tests de fichas fallan (observado en CI); caso 49 SQL aparece sin `throws_ok`.
- Esperado **después del arreglo documental**: `verify-fichas` verde, filas T-408/409 presentes y caso 49 en alcance; **no** afirmar que `test:db` pasa, porque la migración de T-390 aún no existe.

## Control independiente adversarial que deberá ejecutar T-390

En el test SQL de T-390, con la migración aplicada y transacción pgTAP:
1. Bajo rol `authenticated` del repartidor, `throws_ok('delete from public.offers ...', '42501'::char(5), null::text, ...)`.
2. Tras el intento, `is((select count(*) ...), 1::bigint, ...)`.
3. En el estado anterior a la migración, la prueba que requiere rechazo por privilegios debe dar **RED** si el viejo camino permite el borrado silencioso de 0 filas (no usar el resultado de `lives_ok` como prueba de cambio).
4. Sumados los `throws_ok` nuevos, ajustar `plan(n)` al total real de aserciones; sin tests falsos, `.skip`, adulteración de `expected` ni mocks que salteen PostgreSQL.

Prueba también explícita de que `has_column_privilege('authenticated', 'public.offers', columna, 'UPDATE')` es `false` para cada `amount_ars`, `eta_minutes`, `message` tras REVOKE.

Esta ronda **no ejecutó mutaciones** por ser documentación y porque no hay entorno SQL local disponible; toda futura evidencia RED/GREEN de base debe registrarse en la bitácora de implementación con SHA/ejecución real, sin inventar una salida.

## Checks al cerrar

```bash
pnpm exec vitest run tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git status --short
git ls-remote origin cc/CC-036-offers-rpc-only
```

No fueron ejecutados localmente por esta revisión; se dejan reproducibles para el autor y la siguiente ronda.
