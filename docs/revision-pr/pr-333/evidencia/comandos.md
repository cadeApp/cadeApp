# Evidencia — PR #333 / ronda 1

## Verificado por revisión GitHub (sin clon local)
- `get_pr_info(#333)`, `fetch_pr_patch(#333)`, `fetch_file` y REST Git trees del HEAD `f12b9d5a2b0ee68d4ab8225b6db32229cf77fcdf`: 9 archivos; no hay carpeta anterior `docs/revision-pr/pr-333/`.
- Docs leídos DESDE develop: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `.agents/skills/contract-change/SKILL.md`, `docs/tasks/T-340.md`, `docs/contracts/CC-024.md`, `AGENTS.md`, `.github/workflows/ci.yml`.
- `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:98–108`: utiliza `v_fixed_price` antes de asignación; `:231–308`: conflicto de retry; `:310–357`: inserts y `request_cycle`.
- `supabase/tests/t340_multi_drop.sql` sección 11: plan sube de 136 a 154, `test_cc024_retry` espera idempotent true; otras pruebas de actor/rollback parciales.
- `src/domain/rpc-contracts.ts:53–135` Zod CC-024; `src/domain/testing/rpc-fake.ts` implementación CC-024; `src/server/rpc/requests.ts` wrapper y push; `src/types/database.types.ts:897` firma agregada manualmente.

## LOGS REALES DEL MISMO SHA (no reproducidos localmente)
- [GitHub CI run 38575667108](https://github.com/cadeApp/cadeApp/actions/runs/38575667108) job 115892299551 db-tests: `# Failed test 148: CC-024 repite el mismo payload sin republicar`; `have NULL`, `want true`; `Failed 1/154 subtests`; `Files=21, Tests=2057, Result: FAIL`. El fallo es del dominio, no un fallo por infraestructura.
- Unit job 115892298749: 2141 tests PASS; exit 1 por branches (76.66% rpc-contracts.ts y 89.13% rpc-fake.ts contra threshold 90%).
- Restantes checks: typecheck/lint/build/audit/bundle-budget success; approval-policy failure; Supabase Preview skipped; no pase E2E de la nueva RPC declarado.

## RED→GREEN exigido a agy (PROPUESTO, NO EJECUTADO por revisor)
- H01: pgTAP existente #148 verdadero RED en CI. Revalidar su salida antes del fix; resolver SQL sin relajar el test; pgTAP verde tras corrección. Mutante alternativo `if not v_inserted then raise` reintroducido localmente vuelve a romper el test #148.
- H02: construir pgTAP autoAssign=true + fixedPriceArs válido, exigir published; actualmente falla en `VALIDATION_ERROR`; tras fix verde. Mutante cambiar guarda de vuelta a v_fixed_price (antes de asignación) y exigir rojo en esa aserción.
- H03: mutar conditionals del Zod/fake en workspace temporal por caso y exigir `vitest` rojo en test de negocio; restaurar; cobertura >=90%, no alterar thresholds.
- H04: inyectar en pruebas SQL trigger temporal `BEFORE INSERT` contra `delivery_request_drop_contacts` que cause P0001 para la solicitud de prueba; la llamada debe fallar y las tablas padre/hijas mostrar 0 filas. Mutante simulado que atrapa el error dentro de SQL sin rethrow debe dejar test rojo; restaurar.
- H05: `pnpm db:types --local` con DB efímera de CI (no `--linked`), `git diff --exit-code -- src/types/database.types.ts` verde tras commitear output genuino. El job actual no llegó a este gate por falla previa.
- H06: nuevo runner de concurrencia observa bloqueo real por dos `psql`, final 1 request/1 publicación/1 set de hijos, segundo retry idempotente; mutación dirigida que republica o ignora la exclusión de requestId tiene que fallar por estado/conteo del negocio. Restaurar mutantes antes de commit.

## No ejecutado por el revisor
- Ninguna prueba Node local, pnpm coverage, PostgreSQL/Docker local, concurrencia directa, mutación SQL de prueba, `db:types --local` ni Supabase/Vercel remotos. No atribuir mutaciones RED inexistentes. Prohibido usar `pnpm db:types` sin --local si lleva al proyecto remoto.

## Ronda 2 — f718cdc6a6bc1c5005c1cbc7021a7ddc47cd7fa4
- get_pr_info, compare_commits y fetch_file (ronda1+11 commits, 9 archivos de autor, sin ediciones a docs/revision-pr/pr-333 de otro autor).
- Logs reales CI 38587334612: db-tests job 115932709215 `Files=21 Tests=2151 Result PASS`; runner `[CC-024] 4 escenarios concurrentes GREEN`, H15 histórico RED→GREEN; tipos `pnpm db:types --local` y diff sin drift.
- Unit job 115932705704 129 archivos/2144 tests PASS; ramas rpc-contracts.ts 100 y rpc-fake.ts 90; todos otros checks técnicos SUCCESS; e2e-preview ERROR (migración nueva pendiente de develop).
- H04: búsqueda de asserts en t340_multi_drop.sql:2696 devuelve 'audit'; :2701–2741 nunca comprueba `->>'audit'`; observación por lectura; no SQL propio.
- H06: cc024_atomic_concurrency.mjs:192–227 firstActor/holderPayload constantes ante holderFirst, :239–241 sleep 50 ms tras send(commit), test normal 4 escenarios PASS pero ninguna mutación CC024 propia. Lectura de código + logs.
- H07: migración :141 compara `->>` string con 'true'; PostgreSQL JSONB ->> produce igual representación para boolean true y JSON string 'true'; falta prueba de string true. No ejecución de SQL adversarial por revisor.
- Mutaciones futuras RED→GREEN (NO ejecutadas): H07 restaurar comparador textual hace que pgTAP string true falle con NO_ERROR versus VALIDATION_ERROR; H04 añadir assert audit=0 y remover temporalmente trigger abort del audit inserción debe fallar en assert de error; H06 alterar la respuesta idempotent o propiedad de ganador en el runner debe fallar en assert explícita (NO setup/timeout), restaurar y GREEN.
- Revisión sin mutantes propios por prohibición de Docker local y falta de worktree de repo; no atribuir RED del autor como independiente.
