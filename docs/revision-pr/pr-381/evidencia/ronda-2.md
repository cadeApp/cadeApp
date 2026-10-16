# Evidencia independiente — PR #381 / Ronda 2

**Código auditado:** `d119d0bfe1c79f08a9a56c24e2c63795555d2784`; **fecha:** 2026-10-16. Solo GitHub source, compare y logs de Actions. Revisor NO ejecutó Supabase/Docker ni mutó PostgreSQL en esta sesión.

## Evidencia CI original
[CI Run 38859800234](https://github.com/cadeApp/cadeApp/actions/runs/38859800234), SHA HEAD funcional, SUCCESS.
- unit job 116839262943: `Test Files 135 passed`; `Tests 2382 passed`.
- db-tests job 116839263033: `Files=26, Tests=2341, Result=PASS`; migración B0 aplicada en DB efímera; `db:types --local` generado.
- B0 runner Test 1 rutas idénticas -> 4 docs; Test 2 distintas -> segundo VALIDATION_ERROR, 4 docs; Test 3 REST mismo path -> 23505, REST path alternativo -> **2 dni_front**, RPC posterior -> INTERNAL_ERROR. Test 4 revocación consent concurrente -> CONSENT_REQUIRED/0 docs.
- H02 mutation: SQL B0 original se reescribe temporalmente SIN `FOR UPDATE`; `RED confirmado ... se insertaron 8 documentos`; restaurar `FOR UPDATE`; `GREEN confirmado ... count = 4, 0 duplicados`. El runner exige exactamente esos conteos; no hay `catch(err) { mutationCaught = true }` ni `pg_sleep` como sincronización.
- Audit/typecheck/lint/build/bundle-budget/approval-policy success.

## Revisión de código real
- Migración B0 líneas 48–74: courier `FOR UPDATE`, deniega status rejected/suspended; segundo `profiles FOR SHARE` valida rol/consent de snapshot actual. No abre grants de tabla.
- PgTAP B0 líneas 413–493: rejected/suspended denegados, approved permitido. Líneas 496–537: demuestra INSERT directo con `storage_path` alternativo permitido bajo RLS legacy, 2 filas para dni_front, RPC subsecuente falla por ambigüedad. Solo se preserva H01 como límite de fase B0.
- Runner `cc025_b0_concurrency.mjs`: Test 4 dos sesiones y revocación, Test 5 exige countRed=8 y countGreen=4. Sus eventos son reales del CI, no del revisor.
- GitHub compare contra develop: ahead=10 behind=0; los archivos CC-027, CC-028, T-358 que figuran desde la revisión anterior entraron por MERGE de develop y no son delta final atribuible a B0.
- Se comprobaron que PR #376 y #364 continúan abiertas. No merge, approval, nueva decisión ni SQL remoto.

## Limitación de verificación
Revisor no reejecutó DB, ni creó/ejecutó mutación SQL independiente del autor; `verificado_en_sha=null` en cuatro registros. El H01 está **aceptado en alcance** como vulnerabilidad/limitación temporal declarada, NO `arreglado`; hay una verificación real del bypass por el CI del autor. No es lícito afirmar unicidad global antes de fase C.
