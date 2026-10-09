# Informe independiente — PR #299 / T-339 — Ronda 2

**Fecha:** 2026-10-08 · **SHA del código revisado:** `5250d51922bf67a2f2555fe824c791ffe94ab1a3` · **Base:** `develop` @ `a773c05cc488a1fc60bfb36512cdca35d12d1271`.

**Resultado: CON BLOQUEANTES (5). NO MERGEAR.** Cuatro pendientes nuevos/anteriores impiden confiar en CI y uno incumple DoD de concurrencia. La decisión A (`src/ui/ui-system.test.tsx` permitido para 29 códigos) sigue vigente. No hay decisiones de producto nuevas.

## Método y checks

Se cotejaron 6 archivos cambiados desde la revisión: `docs/tasks/log/T-339.md`, migración SQL, `supabase/tests/t339_fixed_price.sql`, tests/fake de dominio y E2E. Ningún archivo `docs/revision-pr/pr-299/` fue alterado por el autor. Ficha T-339 leída en `develop`; HEAD de PR coincide con el remoto y GitHub informa `mergeable: true` (esto NO es `git merge-tree` local ni cobertura de conflictos futuros). No se levantó Docker/Supabase local.

CI run **37750956332** del SHA revisado:
- `typecheck`, `lint`, `build`, `audit` y `bundle-budget` ✅.
- `unit` ❌. Job `113223757529`: 125 archivos / 1999 pruebas Vitest pasan, pero `rpc-fake.ts` tiene **89.74%** de cobertura de ramas frente a mínimo **90%**. La bitácora del autor declara **91.62% local**; no corresponde al CI y no puede reemplazarlo.
- `db-tests` ❌. Job `113223757743`: migración nueva **se aplica**, y `rpc_offers.sql` pasa; en `rpc_requests.sql` fallan **7/1241** pruebas, cinco fechas `clock_timestamp` versus `now()` y un chequeo de prioridad `REASON_REQUIRED`, además de un caso adicional de fecha. `t339_fixed_price.sql` aborta **antes de la primera aserción** por constraint `zones_centroid_lng_bounds` en línea 68; el reporte «Failed 45/45» indica suite no ejecutada, no 45 fallos conductuales.
- Vercel comenta `api-deployments-free-per-day` (>100 despliegues diarios). `e2e-preview` del SHA **no quedó validado**. Se necesita ejecución real cuando haya cuota; no se da por verde.

## Revalidación de la ronda 1

| ID | Estado en R2 | Evidencia |
|---|---|---|
| H01 | **Corregido/verificado parcialmente** | `request_cycle` declara y usa `v_consent_status`. La migración se aplica en CI; las pruebas posteriores siguen rojas por otras causas |
| H02 | **Arreglado sin verificar** | `accept_offer` lee offer sin lock, toma request FOR UPDATE, luego offer FOR UPDATE. Falta prueba real de dos aceptaciones simultáneas (H05) |
| H03 | **Arreglado sin verificar** | SQL/fake añaden guarda `fixed_price_ars IS NOT NULL` para idempotencia. Fake pasa, pero pgTAP no se ejecutó |
| H04 | **Arreglado sin verificar** | `plan(45)` y 45 aserciones de texto + precios 999/1000/1001/1499/1500/1501. CI se interrumpe en fixture antes de la primera |
| H05 | **ABIERTO — bloqueante** | «Carrera» de líneas 459–484 de pgTAP: un `take_request` ejecutado de forma secuencial, seguido por dos conteos. No hay conexiones concurrentes, interleaving, comprobación de `submit_offer` vs `take_request` ni suspensión/disponibilidad concurrente |
| H06 | **ABIERTO — bloqueante** | CI remoto con cobertura de ramas 89.74%, bajo 90% |
| H07 | **Arreglado sin verificar con mutación** | Fake usa diez solicitudes distintas, exige diez éxitos, 11.ª RATE_LIMITED y vencida REQUEST_EXPIRED; Vitest CI verde, no se reprodujo RED de mutación independiente |
| H08 | **Arreglado sin verificar** | Tres E2E ahora navegan a alta comercial, completan formulario y consultan persistencia real; Vercel bloqueó ejecución y sigue faltando confirmación E2E |
| H09 | **Verificado** | Sin `any` y acceso tipado `RPC_CONTRACTS.take_request`; `typecheck` verde en SHA inspeccionado |
| H10 | **Mejora diferida** | Mostrar mínimo dinámico sigue siendo opcional, no se exige en esta ronda |

## Cinco bloqueantes efectivos para corregir

### H05 — Concurrencia real ausente [ANÁLISIS + comprobación de contenido]

**Archivo:** `supabase/tests/t339_fixed_price.sql:459-484`. El nombre «Carrera» no sustituye dos sesiones: hace un único `take_request` del courier1 y comprueba que el match dejó una oferta accepted y ninguna pending. Esto demuestra funcionamiento secuencial, NO carrera de dos couriers ni deadlock cruzado.

**Corrección:** conservar pruebas pgTAP unitarias y crear casos **E2E de integración concurrente** dentro del archivo permitido `e2e/specs/fixed-price.spec.ts`, con `createAuthenticatedClient` para dos usuarios distintos y `Promise.all` sobre dos **clientes Supabase independientes** (red real), consulta de resultado y oráculo SQL tras commit; agregar prueba de dos `accept_offer` simultáneos sobre ofertas pending distintas de la misma solicitud, prueba `submit_offer` vs `take_request` del mismo courier en solicitudes distintas y carrera contra cambio a unavailable/suspended si infraestructura lo permite. Afirmar explícitamente cero SQLSTATE 40P01, un match y ninguna oferta accepted/residual extra, sin depender solo del orden de promesas. Probar mutación de lock que deje la prueba en rojo. En un único pgTAP envuelto en BEGIN sin sesiones remotas esto no se reproduce: no fingir concurrencia allí. No agregar una suite fake como sustituto.

### H06 — Cobertura remota insuficiente [CI ROJO]

**Archivo:** `src/domain/testing/rpc-fake.ts` y `src/domain/t339-fixed-price.test.ts`. 1999 Vitest pasan, pero 89.74% branches. Agregar tests que atraviesen guardas **reales** no cubiertas (no asserts vacíos), sobre ramas de `take_request` y `submit_offer`; comprobar en CI el valor final >= 90% y exit 0 del job `unit`. No tocar threshold, exclusiones, instrumentación ni fixtures para disimular ramas.

### PR299-H11 — Regresión de tiempo transaccional [CI ROJO, omitida en R1]

**Archivo:** `supabase/migrations/20261007090000_t339_fixed_price.sql:131`, función `app_private.request_cycle`. La versión anterior en `develop` (migración `20261002010000_cc015_admin_cancel_requires_incident.sql`) usa `v_now timestamptz := now();`. T-339 la reescribe con `clock_timestamp()`. Al ejecutar `rpc_requests.sql` dentro de una transacción, las fechas dejan de ser iguales al `now()` que forma parte del contrato probado. CI falla en tests 1098, 1103, 1104, 1148, 1154 y 1198. **Arreglo exacto:** devolver **solo el reloj de `app_private.request_cycle`** a `now()`. No cambiar `v_now` de `app_private.match_offer` ni el resto sin justificativo, ni degradar/relajar los seis tests. RED: volver a `clock_timestamp()` en copia temporal provoca las seis diferencias de timestamp; GREEN: `rpc_requests.sql` debe pasar completo.

### PR299-H12 — Error de precedencia al cancelar [CI ROJO, omitido en R1]

**Archivo:** misma migración `:202-210`, `app_private.request_cycle`. Se movió el bloque de «admin en `in_transit` sin incidente» **por delante** de la guarda de motivo obligatorio. En `develop`, primero se responde `REASON_REQUIRED` y solo después se evalúa ausencia de incidente. CI caso 1161: recibido `INVALID_STATE_TRANSITION`, esperado `REASON_REQUIRED`. **Arreglo exacto:** conservar el orden previo (después de AAL2, verificar `REASON_REQUIRED` antes de comprobar existencia de incidente), sin cambiar códigos ni prueba. RED: invertir de nuevo esas dos guardas; GREEN: `rpc_requests.sql` todo verde.

### PR299-H13 — Fixture invalida la suite completa [CI ROJO, omitido en R1]

**Archivo:** `supabase/tests/t339_fixed_price.sql:67-69`. Se hace `INSERT zones (...centroid_lat, centroid_lng) VALUES (..., -27.4333, -27.4333)` y después `UPDATE ... SET centroid_lng=-65.6133`. El INSERT **ya viola** `zones_centroid_lng_bounds` y aborta la transacción antes de las 45 aserciones. **Arreglo exacto:** sembrar `centroid_lng = -65.6133` directamente en INSERT, borrar ese UPDATE redundante; no debilitar constraint ni pasar el valor inválido en un fallo capturado. RED: mutar la longitud a -27.4333 y verificar error 23514; GREEN: pgTAP ejecuta realmente sus 45 aserciones y termina con `Files/Tests/Result: PASS`.

## NO TOCAR

- No revertir decisión A; `src/ui/ui-system.test.tsx` está autorizado y queda fuera de esta corrección.
- No usar Docker ni Supabase local/remoto manual; `db-tests` de CI valida esquema y pgTAP. No bajar la cobertura.
- No alterar `docs/revision-pr/pr-299/revisiones/ronda-1.md`. R2 es nuevo archivo; la bitácora del autor no puede certificar lo que verificó la revisión.
- No alterar `now()` en otras funciones sin comparar la referencia contractual y ensayar regresiones. Respetar piso `min_offer_ars`, consentimiento CC-007, grants CC-023 y privacidad de contactos.
- No afirmar que el E2E pasó hasta que corra; Vercel está limitado por cuota, es una dependencia externa.

## Comprobaciones independientes

Se releye el SQL del SHA y se hacen pruebas estáticas sobre patrones (ver `evidencia/comandos.md`), contrastando versiones de `develop`; se leyeron logs CI íntegros de jobs fallidos. NO se ejecutó `git merge-tree` en un clon ni tests locales. H11/H12/H13 y H05 son nuevos hallazgos de defectos **ya presentes en ronda 1**: los omitió esta revisión; no son regresiones introducidas por la reparación del agente. Se corrige explícitamente esa omisión en vez de atribuirla a la ronda 2.

