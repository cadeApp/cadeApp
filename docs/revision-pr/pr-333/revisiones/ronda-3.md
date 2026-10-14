# PR #333 — CC-024 backend — Ronda 3 independiente

**Fecha:** 2026-10-14. **HEAD revisado:** `4996f1b772f249eb2f6f269e5afa8deb835ff484`. **Base:** develop `3a453762445ce866a373eeab4a86365aacaca7e5`.
**Resultado: CON BLOQUEANTE DE INTEGRIDAD DE EVIDENCIA (H08).** H04, H06, H07 ya corregidos en código y cobertura real SQL/runner. Los H01–H03 y H05 siguen cerrados. Sin nuevas decisiones humanas.

## H04 — CERRADO, revisado desde R2
El helper pg_temp.test_cc024_rollback devuelve `audit` y las siete fases en `supabase/tests/t340_multi_drop.sql:2817–2864` afirman `audit='0'` además del error `CC024_TEST_FAILURE` y ausencia de padre/contactos/drops. CI DB run 38597699521 job 115968551905 ejecutó pgTAP real: **Files=21, Tests=2177, Result=PASS**.

## H06 — CERRADO, revisado desde R2
El runner exclusivo `supabase/tests/integration/cc024_atomic_concurrency.mjs:202–337,484–535` ahora verifica actor y contenido de dos ganadores distintos, dos órdenes de colisión entre merchants, cardinalidad, auditoría y bloqueo real `pg_blocking_pids`. Ya no usa un sleep como oráculo: espera marcador del segundo COMMIT. Job DB imprime **5 escenarios concurrentes GREEN** y mutante SQL del bit `idempotent` que activa una aserción real. Este arreglo es válido.

## H07 — CERRADO, revisado desde R2
El guard SQL `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:141` compara con `v_drop->'recipientConsentDeclared' is distinct from 'true'::jsonb`; pgTAP en `t340_multi_drop.sql:2439–2526` prueba JSON string `"true"`, false/null/1 y ausencia de filas al rechazar. DB GREEN 2177/2177. **No confundir la validación funcional correcta con el formato de su demo RED**, señalado en H08.

## PR333-H08 — NUEVO ALTO, BLOQUEANTE DE CREDIBILIDAD DEL RED→GREEN
Son controles en los que la operación mutada y sus expectativas se acomodaron para producir un **test PASS etiquetado como RED**, no un fallo auténtico de una prueba de negocio que anteriormente estaba GREEN:
- `cc024_atomic_concurrency.mjs:384–391`: se instala en DB efímera el viejo guard que acepta string `"true"` y se ejecuta `assert.equal(consentProbe(...), 'NO_ERROR')`. Esa aserción **pasa** al introducir el defecto y se imprime `RED obtenido`. Pero la prueba normal que requiere `VALIDATION_ERROR` no se ejecuta bajo el defecto. La condición de alerta de consentimiento es real en producción SQL; la demostración de sensibilidad no es un RED auténtico.
- `cc024_atomic_concurrency.mjs:460–473`: el supuesto mutante del orden modifica `expectedWinnerIndex=1` mientras `winningIndex=0`; modifica el **oráculo esperado**, no quién ejecuta o gana en PostgreSQL. Comprueba que la propia comparación del runner responde a expectativa errónea, pero no que una regresión funcional de elección de ganador sea detectada.
- `t340_multi_drop.sql:2870–2894`: muta el **trigger instrumental de la prueba** para no lanzar excepción; `throws_matching(...,'CC024_MUTANT_ASSERTION_FAILED')` ESPERA exactamente la excepción secundaria y da PASS. No falla el pgTAP de contrato de rollback; es un control negativo/diagnóstico válido, pero no debe reportarse como mutación RED→GREEN funcional.

**Reparación de alcance acotado:** el SQL de la RPC y los tests normales H04/H06/H07 ya están bien; no reescribirlos. Cambiar el harness para que al menos el guard textual H07 haga **fallar el caso pgTAP inalterado** «CC-024 rechaza consentimiento JSON string \"true\"» (exit !=0, subtest exacto), luego restaurar función y mostrar **GREEN con el mismo test**. Etiquetar el chequeo del ganador y del trigger como **controles negativos que pasan (instrumentación)** si no se muta el comportamiento real, o añadir mutaciones reales sin alterar la expectativa. No cambiar thresholds/CI para fabricar verdes ni atribuir resultados no ejecutados.

## Resultados del HEAD en GitHub
- Run CI [38597699521](https://github.com/cadeApp/cadeApp/actions/runs/38597699521) SHA **4996f1b7**; DB job **115968551905**: Files=21 Tests=2177 Result PASS; runner 5 GREEN, `db:types --local` y diff cero.
- `unit` 2144 PASS, typecheck/lint/build/audit/bundle-budget SUCCESS; approval-policy y Vercel SUCCESS. Revisión independiente no atribuye resultados de SHA antiguo al HEAD actual.
- `e2e-preview` status ERROR en PR de Gate 2 que introduce migración ausente de develop; workflow `repository_dispatch` que se consultó corre en HEAD **develop**, no es E2E de esta nueva RPC y no debe considerarse GREEN de PR333. T-340 permite checkpoint posterior a merge autorizado y `migrate-develop`.
- **No ejecuté** Docker/Supabase local, CI manual, mutaciones propias ni pgTAP local; evidencia por inspección del código y logs GitHub, no falsificar independencia. La comparación de instrumentos no prueba que alguien actuó de mala fe.

## Dictamen
PR #333 todavía Draft. **CON BLOQUEANTE H08 de evidencia**, no por defecto de atomicidad SQL demostrado. Completar demostración RED real con prueba inalterada, corregir descripción/bitácora, obtener ronda 4 independiente. No aprobar ni mergear; luego, con autorización de Lautaro073, Gate 3 `migrate-develop` y checkpoint de #330.
