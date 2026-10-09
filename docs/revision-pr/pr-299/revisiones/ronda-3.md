# Informe independiente — PR #299 / T-339 — Ronda 3

**Fecha:** 2026-10-08 · **HEAD revisado:** `4836122bbbea3266e3832a2f8d670b52b411dc70` · **Base:** `develop` @ `a773c05cc488a1fc60bfb36512cdca35d12d1271`.
**Resultado: CON BLOQUEANTES (4: H05, H14, H15, H16). NO MERGEAR.**

## Metodología y CI

Ronda independiente sobre el SHA remoto. Se cotejaron los seis archivos cambiados desde el commit de ronda 2: migración, pgTAP T-339, fake, test de dominio, E2E y bitácora. La carpeta de revisión no fue modificada por el autor. Leídos los jobs fallidos/completados y el status de e2e-preview. No se ejecutaron Docker, Supabase local ni SQL directamente; no hay worktree local para `git merge-tree`. PR abierta y `mergeable: true` no bastan para merge.

**GitHub Actions run 37759343648 (SHA inspeccionado):**

| Check | Resultado | Detalle |
|---|---|---|
| typecheck, lint, build, audit, bundle-budget | ✅ | Success |
| unit | ✅ | **2004 Vitest** pasan; `rpc-fake.ts` ramas **90.04%** (mínimo 90%); job `113251668686` success |
| db-tests | ❌ | Migraciones aplicadas; `rpc_requests.sql ... ok`, `rpc_offers.sql ... ok`; `t339_fixed_price.sql` ejecuta 42/45 aserciones, **#23 falla** (NULL en lugar de published), y aborta en línea 449 por RLS. Job `113251668412` |
| Vercel | ✅ | Deployment complete para SHA del código |
| e2e-preview | ❌ **sin ejecutar** | Status `BLOCKED / REQUIRES DEVELOP MIGRATION [dpl_EcxxBqNC7FqbpPW6B6qvdGiHErkm]`; workflow 37759512274: `resolve-preview success`, `e2e-preview skipped` |

**Por qué E2E no corre:** el gate confiable en `.github/workflows/e2e-preview-target.mjs` no permite E2E contra Develop cuando la PR incluye `supabase/migrations/**`; no es la cuota de Vercel en este SHA. No escribir «E2E verde» ni modificar el gate.

El log TAP `Failed 4/45 subtests` **no** significa cuatro regresiones conductuales: corrieron 42, la #23 falló, el SQL abortó y tres no corrieron. `plan(45)` coincide con 45 sentencias, pero todavía NO es PASS.

## Hallazgos anteriores — resultados

| ID | R3 | Fundamento |
|---|---|---|
| H01 | CERRADO R2 | Migración compila y alinea variable de consentimiento |
| H02 | Código reparado, E2E pendiente | `accept_offer` toma request antes que offer; carrera escrita pero no ejecutada |
| H03 | Código reparado, SQL pendiente | Precio fijo protege idempotencia; pgTAP sin PASS |
| H04 | Pendiente de verificación | plan 45/45, 42 ejecutadas y fallo |
| H05 | **ABIERTO BLOQUEANTE** | E2E `Promise.all` con clientes reales escrito pero **skipped**, available=false es secuencial, H05.5 no prueba consentimiento |
| H06 | **CERRADO** | CI unit success, 90.04% branches |
| H07 | Corregido en test y unit verde | 10 solicitudes distintas y 11.ª RATE_LIMITED |
| H08 | Código E2E de formulario presente, ejecución pendiente | e2e-preview blocked |
| H09 | CERRADO R2 | Sin `any`, typecheck PASS |
| H10 | Mejora opcional | Piso dinámico visible diferido, no bloquea |
| H11 | **CERRADO** | `request_cycle` usa `now()`, `rpc_requests.sql` PASS |
| H12 | **CERRADO** | Motivo se valida antes de incidente, `rpc_requests.sql` PASS |
| H13 | Setup reparado, suite pendiente | INSERT zonas válido; nuevo fallo SQL H15 |

## Bloqueantes

### H14 — Oráculos de consentimiento filtrados por RLS [CI rojo, alto]

**Ubicación:** `supabase/tests/t339_fixed_price.sql:269–313`. Tras `select pg_temp.act_as(pg_temp.courier_reconsent_id());`, la prueba valida ambos errores de denegación y luego usa `select is(...)` para contar `offers` y leer `delivery_requests` **sin recuperar el rol inspector**. RLS oculta la fila: test #23 muestra `have NULL / want published`; incluso `count=0` puede pasar sin probar ausencia de efectos.

**Arreglo exacto:** ejecutar `select pg_temp.reset_actor();` **justo después de los throws_ok de pending/reconsent y ANTES del primer select de oráculo**, aproximadamente línea 285. Leer todas las postcondiciones (ofertas, accepted_offer_id, estado, rate_limits) desde postgres, no desde el actor rechazado. Restablecer `act_as` para los tests que de verdad requieran ese usuario.

**RED exigido:** bajo usuario reconsent, SELECT de solicitud devuelve NULL por RLS; bajo inspector la misma solicitud devuelve published. Mutar en fixture una fila de oferta después de la denegación: conteo privilegiado debe ponerse rojo, nunca false-green por ocultamiento.

### H15 — Oferta imposible sembrada bajo rol merchant [CI rojo, alto]

**Ubicación:** `supabase/tests/t339_fixed_price.sql:426–455`. Se acepta `courier_1` y queda solicitud matched; sin cambiar rol (sigue merchant autenticado) el test ejecuta `insert into public.offers (...status='pending')` como si otro courier pudiera presentar oferta después del match. PostgreSQL lo rechaza por RLS en línea 449.

**Arreglo preferido, sin forzar estado imposible:** ANTES del primer `accept_offer` sobre `req_fixed_manual`, mientras aún está published y `courier_1` tiene pending, cambiar actor a `pg_temp.courier_2_id()`, hacer `select lives_ok('select public.take_request(pg_temp.req_fixed_manual(),15,null)', ... )` y comprobar que genera la segunda pending legítima (si sumás una aserción, ajustar `plan(46)` o al total verdadero). Restaurar merchant y aceptar la primera oferta; helper marca rechazada la de courier2. Usar el ID de **esa oferta REAL de courier2** en el posterior `throws_ok(public.accept_offer(...), 'P0001','ALREADY_MATCHED')`. Eliminar el `INSERT public.offers` artificial y `pg_temp.other_offer_id()`. NO crear bypass RLS ni aflojar policies. Confirmar una `accepted` y la otra `rejected`.

**RED exigido:** pasar como argumento la oferta ganadora en una copia temporal: debe dejar de devolver ALREADY_MATCHED y devolver reintento idempotente; su aserción debe fallar por semántica, no por fixture.

### H16 — Falso E2E de gate CC-007 [ANÁLISIS, alto]

**Ubicación:** `e2e/specs/fixed-price.spec.ts:527–544`. El caso titulado `H05.5: CC-007 aislamiento de consentimiento` únicamente seedea una solicitud published, la lee y valida **sus valores antes de actuar**. No muta actor a pending/reconsent, no llama `take_request`, no verifica respuesta de denegación ni efectos posteriores. El propio comentario declara que los couriers E2E tienen consentimiento activo. Test podría pasar si se eliminara el gate: no es cobertura CC-007.

**Arreglo:** eliminar el test engañoso y dejar consentimiento bajo pgTAP real de H14 + wrapper unit, o crear genuino actor no consentido por un fixture existente autorizado, ejecutar RPC y comprobar UNAUTHORIZED_ACTOR + snapshots sin cambios. No inventar mocks ni «RED» de mera detección regex. Si no hay fixture, **eliminar** y documentar la limitación es preferible.

### H05 — Concurrencia E2E escrita, no demostrada [BLOQUEANTE DE VALIDACIÓN]

**Ubicación:** `e2e/specs/fixed-price.spec.ts:299–487`. Se agregaron 3 pruebas auténticamente orientadas a red (dos `take_request`, dos `accept_offer`, cruce submit/take con mismo courier). Es avance válido, NO prueba falsa por `Promise.all`. Falta ejecución E2E: status expresamente bloqueado por migración. La prueba `set_availability(false)` **antes** del take comprueba rechazo determinista pero no la carrera simultánea de suspensión/cambio de disponibilidad que pide T-339/CC-021. No se afirma ausencia de `40P01` como hecho demostrado.

**Cierre:** obtener ejecución real autorizada contra el esquema compatible (no sobre el entorno develop desactualizado). Revisar 3 escenarios, match único, loser ALREADY_MATCHED y cero deadlocks en logs DB. Mantener `available=false` como caso secuencial; corrida concurrente de suspensión necesita fixture admin autorizada y el control correspondiente. No declarar 5 escenarios realmente concurrentes si solo 3 lanzan RPC en paralelo.

## 🔵 Única decisión pendiente del dueño: validación E2E con migración

El workflow exige **migración primero** y rechaza el E2E premerge de PRs con SQL migratorio, independientemente de que Vercel esté verde.

**A (recomendada):** mantener protección, obtener `db-tests` GREEN y acordar validación después de la aplicación controlada de migración a Develop, con smoke/E2E posteriores y riesgo de rollback explícito; cualquier excepción al DoD de «e2e-preview GREEN premerge» requiere aprobación de Lautaro073.
**B:** separar la migración en PR previa para que el esquema esté disponible en Develop y después ejecutar el E2E funcional como PR sin migración. Esto amplía coordinación/alcance y necesita autorización. Revisión no decidió A/B ni disparó workflows.

## NO TOCAR

No tocar políticas RLS, constraints, migraciones previas, CC, fichas, thresholds, workflows, configuración de pruebas ni `docs/revision-pr/**` desde el agy. No recurrir a Docker/Supabase local/remoto manual, no aprobar/mergear y no afirmar CI/E2E verde sin ejecución. Preservar decisión A anterior sobre `src/ui/ui-system.test.tsx`.

**Limitación:** no se ejecutó `git merge-tree` ni PostgreSQL local. Detectores estáticos propios y mutaciones de cadenas en memoria constan en `evidencia/comandos.md`; no equivalen a mutaciones SQL reales.

