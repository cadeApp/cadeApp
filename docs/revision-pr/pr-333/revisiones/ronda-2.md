# PR #333 — CC-024 / T-340 Gate 2 — Ronda 2 independiente

- Fecha: 2026-10-14. SHA de implementación revisado: `f718cdc6a6bc1c5005c1cbc7021a7ddc47cd7fa4`; base develop `3a453762445ce866a373eeab4a86365aacaca7e5`.
- **Resultado: CON BLOQUEANTES H04, H06 y H07**; H01/H02/H03/H05 arreglados-verificados por lectura de código y CI del SHA inspeccionado. H04/H06 son PARCIALES; H07 NUEVO ALTO.
- Opción A de Lautaro073 para runner CC-024 dedicado e invocación mínima CI YA IMPLEMENTADA; no se requiere otra decisión.

## Revalidación de hallazgos anteriores
- **H01 ARREGLADO-VERIFICADO:** SQL `20261014110000_cc024_atomic_multi_drop.sql:257–313` separa reintento y alta. pgTAP retry idempotente en DB run 38587334612 PASS 2151 tests.
- **H02 ARREGLADO-VERIFICADO:** SQL `:100–110` evalúa `v_fixed_price_value` antes de cast; pgTAP `t340_multi_drop.sql:2293–2310` autoAssign=true + precio 1500 pasó en CI.
- **H03 ARREGLADO-VERIFICADO:** Unit job 115932705704, 2144/2144 tests, ramas `rpc-contracts.ts=100%`, `rpc-fake.ts=90%`; thresholds intactos.
- **H05 ARREGLADO-VERIFICADO:** DB job 115932709215 ejecutó generación real `pnpm db:types --local` y `git diff --exit-code` sin drift.

### H04 — PARCIAL Y BLOQUEANTE DE PRUEBA
El pgTAP ahora cubre N drops, límites, roles/PII, estados posteriores y rollback con triggers `AFTER INSERT` en todas las fases. En `supabase/tests/t340_multi_drop.sql:2696`, `pg_temp.test_cc024_rollback()` **devuelve el campo audit**, pero `:2701–2741` **nunca lo compara con cero**. Los tests verdes no demuestran que tras una falla de fase/publicación se preserven **cero eventos** en `audit_log`, aunque ese valor se recolecte. Añadir asserts `audit=0` para cada fase; conservar los tests existentes. No atribuir fallos de audit sin correr el caso: aquí se denuncia una aserción ausente.

### H06 — PARCIAL Y BLOQUEANTE DE CONCURRENCIA
Nuevo runner de 321 líneas `supabase/tests/integration/cc024_atomic_concurrency.mjs` y una sola invocación permitida en `db-tests`. Logs registran 4 escenarios normales GREEN con PostgreSQL real, `pg_stat_activity` y `pg_blocking_pids`, lo cual es evidencia útil. Pero:
1. `runScenario:192–227` recibe `holderFirst` para permutar las instancias **sin cambiar firstActor=holderActor/secondActor=waiterActor y sin cambiar holderPayload enviado por first**. Por ello «orden-A-mismo-payload» y «orden-B-mismo-payload» son la misma contienda funcional con otros nombres. Se requieren ganadores realmente opuestos (actor/huella ganadora) y aserciones de datos persistidos.
2. `runScenario:239–241` hace `second.send('commit;')`, espera `setTimeout(50)` y consulta estado final. **Dormir 50 ms no confirma el COMMIT** de la segunda sesión, contrariamente al DoD sin sleeps como oráculo. Esperar marcador PostgreSQL de COMMIT de esa misma conexión y errores de sesión, luego afirmar invariantes.
3. El CI ejecutó mutaciones H15 históricas T-340; ninguna mutación negativa del propio runner nuevo para CC-024 fue ejecutada. Registrar RED dirigido genuino (idempotencia/bloqueo/actor/orden) y restauración GREEN.

### H07 — NUEVO ALTO, BLOQUEANTE DE VALIDACIÓN SQL
`supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:141` contiene `v_drop->>'recipientConsentDeclared' <> 'true'`. `->>` convierte tanto JSON boolean `true` como JSON string `"true"` al mismo texto, entonces la llamada directa de un usuario autenticado puede enviar string `"true"` como declaración de consentimiento. `src/domain/rpc-contracts.ts` exige `z.literal(true)`. Corregir la comparación de tipo `jsonb`: `v_drop->'recipientConsentDeclared' is distinct from 'true'::jsonb` y agregar pgTAP de string true rechazado y cero filas. **Hallazgo por lectura semántica; no se ejecutó mutación SQL por el revisor.**

## Evidencia de CI
- `CI` run 38587334612, job db-tests **115932709215**: `Files=21, Tests=2151, Result: PASS`; runner CC-024 «4 escenarios GREEN»; suite histórica H15 RED→GREEN de H13/H14/H01/H02; generación real de tipos sin diff. Estos RED históricos NO prueban el nuevo runner CC-024.
- Unit job **115932705704**: 129 archivos, 2144 tests PASS, coverage contractual 100%/90%; typecheck/lint/build/audit/bundle-budget/approval-policy/Vercel PASS.
- `e2e-preview`: status ERROR, no GREEN. PR incluye migración aún sin desplegar a develop; el error no demuestra falla funcional del RPC, pero tampoco reemplaza el checkpoint real posterior a `migrate-develop`.
- **Revisor NO ejecutó** SQL local, mutaciones propias, pnpm local, Docker ni despliegue; dictamen estático + CI del HEAD inspeccionado. La cobertura de H04/H06/H07 requiere pruebas nuevas.

## Dictamen
PR #333 sigue Draft, **NO APROBAR / NO MERGEAR**. Cambios acotados a esta migración CC-024, pgTAP, runner y bitácora pueden resolver todo; no tocar contratos previos ni writer #330 ni CI. Solicitar R3 con RED→GREEN auténticos para H04/H06/H07 y `db-tests` completo GREEN sobre SHA final. Gate 3 `migrate-develop` y RPC real en Develop se verifican solo tras merge autorizado.
