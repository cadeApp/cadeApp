# Revisión independiente — PR #317 / T-340 — ronda 5

**Fecha:** 2026-10-11 · **SHA de código revisado:** `09d2a9206591cb8202e99daee0dafd1fc12dbde0` · **Base:** `develop` `7cf1a653` (behind=0).  
**Estado: CON BLOQUEANTES (2; H08 y H13 parciales). NO MERGEAR ni iniciar paso 2.**

## Resultado de las correcciones de ronda 4

| ID | Resultado independiente | Estado |
|---|---|---|
| H08, concurrencia | Existe runner real de 2 procesos `psql`, integrado correctamente a `db-tests`; los 4 casos «hijo primero» (A) sí ejecutan `public.publish_request` y completan en CI. **Los 4 casos «publicación primero» (B) no ejecutan la RPC**: sustituyen la publicación por un `UPDATE delivery_requests SET status='published'` manual. El detector de espera también acepta cualquier lock de la base y las sesiones no detienen `psql` al primer error. | **PARCIAL → BLOQUEANTE** |
| H13, estados por entrega | Ahora hay fixtures y 17 aserciones de comportamiento real; `mark_drop_delivered` y `mark_drop_failed` sí se invocan como actores simulados en pgTAP. **Dos oráculos son falsos negativos**: el caso «no `in_transit`» no llega a la validación de estado, y el caso `mark_delivered` legacy se ejecuta cuando el request ya fue finalizado. | **PARCIAL → BLOQUEANTE** |

El nuevo código está restringido a los cuatro archivos autorizados para H08/H13: `supabase/tests/t340_multi_drop.sql`, `supabase/tests/integration/t340_concurrency.mjs` (nuevo), `.github/workflows/ci.yml` solo dentro de `db-tests`, y `docs/tasks/log/T-340.md`. No se modificó código productivo, dependencias ni pasos 2–4. Se comprobaron `behind=0` y los comentarios/bitácora. La carpeta `docs/revision-pr/pr-317` no fue escrita por el agente en estos commits.

## H08 — ALTO — cuatro pruebas pasan sin ejecutar la publicación que dicen comprobar

**Fuente:** `supabase/tests/integration/t340_concurrency.mjs:200–245, 296–339, 391–435, 486–529`; CC-022 §2b y ficha T-340. En todos los escenarios B la sesión denominada `S1_PUBLISH_B` hace:

```sql
begin;
set role authenticated;
select set_config('request.jwt.claims', ..., false);
select status from public.delivery_requests where id = ... for update;
\echo S1_LOCKED

-- tras lanzar la escritura concurrente:
reset role;
update public.delivery_requests set status = 'published' where id = ...;
commit;
\echo S1_COMMITTED
```

**Nunca llama `public.publish_request` en B.** Por lo tanto prueba que el trigger de hijo compite con una **actualización manual de estado**, no con todas las lecturas, validaciones, escrituras de drops, cálculo de ruta y transacción que realmente ejecuta la RPC. Un defecto interno de `publish_request` en este orden podría quedar invisible. En los escenarios A sí existe `select public.publish_request(...)` y CI confirma los estados finales. **No se descarta todo el trabajo:** los ocho casos abren dos `psql` y provocan contención real, pero la cobertura A/B no es la anunciada.

**Controles secundarios que reducen fiabilidad del runner:**
1. `waitForBlockedLock():79–87` acepta cualquier `pg_locks.granted=false` de **cualquier sesión** (solo excluye `pg_backend_pid()` del observador). No demuestra que la escritura/publish del escenario actual esté esperando el lock de la solicitud de la sesión contraria. Con otro job/query bloqueado sería falso positivo.
2. `PsqlSession` crea `psql` sin `-v ON_ERROR_STOP=1`, y `waitFor('S1_LOCKED')` o `waitFor('S2_DONE')` solo busca `\echo`; un comando SQL podría fallar y emitir el marcador siguiente. El estado final de los casos A reduce este riesgo, pero la herramienta se presenta como evidencia de bloqueos específicos y debe ser infalsificable.

**Arreglo exigido dentro de archivos ya autorizados:** conservar el `SELECT ... FOR UPDATE` inicial como barrera de la sesión publicadora si es necesario, pero cuando se confirma que el hijo está bloqueado, ejecutar **`select public.publish_request(reqId)` bajo `authenticated` y JWT verdadero ANTES del commit**, no `reset role; update delivery_requests...`. Comprobar respuesta JSON, estado `published`, `drops_count`/drop/contacts y efecto de la mutación tardía. Capturar `pg_backend_pid()` de cada conexión y verificar `pg_blocking_pids(waiter_pid)` que contiene el PID preciso del otro actor y, de ser posible, `wait_event_type='Lock'`. Hacer que `psql` corte ante errores inesperados (`ON_ERROR_STOP=1`) y registrar finalización real; distinguir explícitamente el error `INVALID_STATE_TRANSITION` esperado del caso B. Mantener timeouts, limpieza, datos privados fuera de logs y dependencia cero.

**Mutación negativa concreta:** quitar `FOR UPDATE` del **trigger productivo** en un entorno efímero o cambiar su modo `SECURITY INVOKER→DEFINER`, ejecutar la batería real de dos sesiones y documentar el caso que deja de cumplir la serialización; restaurar y GREEN. Solo hacer mutación real si está aislada y revertible, sin modificar migraciones persistentes ni staging/producción; no afirmar RED sin haberlo ejecutado.

**Comprobación independiente EN MEMORIA:** los cuatro bloques B tienen el patrón `reset role; update delivery_requests set status='published'` y **ninguno** la invocación a `publish_request`; sustituir el fragmento en memoria hace que los cuatro bloques cumplan el control de «RPC presente», sin modificar archivos de repo. Ver `evidencia/comandos.md`. Esta sonda **no** ejecuta PostgreSQL ni demuestra la mutación funcional.

## H13 — ALTO — dos oráculos SQL no ejercen la condición que dicen medir

**Fuente:** `supabase/tests/t340_multi_drop.sql:685–750, 879–937`, `supabase/migrations/20261009200000_t340_multi_drop.sql` (función `app_private.request_cycle`, guard general de estado antes de guard multi-drop); CC-022 §6.

**(a) «No está in_transit».** El fixture `300...3530` se crea como `published`, **sin oferta aceptada** ni `accepted_offer_id`. El test `test_rpc_drop_not_in_transit()` permite indistintamente la expresión `UNAUTHORIZED_ACTOR|INVALID_STATE_TRANSITION`. Como la RPC chequea la oferta aceptada **antes** de verificar `request.status='in_transit'`, hoy el caso puede pasar por `UNAUTHORIZED_ACTOR` sin demostrar que se rechace un estado distinto del requerido. Corregir fixture con request `matched` y oferta `accepted` real para el mismo courier, y exigir **solo `INVALID_STATE_TRANSITION`**.

**(b) «mark_delivered legacy rechaza N>1».** El test invoca `public.mark_delivered(reqId=300...3500)` **después** de `test_mark_last_drop_closes_parent()`, que ya cambió ese request a `delivered`. En `app_private.request_cycle` el rechazo genérico `mark_delivered && status <> in_transit` se ejecuta **antes** del guard `drops_count>1`. Si se eliminase el guard multi-drop, el test continuaría verde por el estado `delivered`; es incapaz de detectar precisamente la regresión que declara. Usar un fixture exclusivo `in_transit`, `drops_count=2`, oferta `accepted`, courier autorizado, y llamar `mark_delivered` **antes de cualquier cierre**. Demostrar mutación que elimina SOLO el guard `drops_count>1`: el test debe fallar con código/estado cambiado, y restaurar guard debe dar GREEN.

Los otros casos `mark_drop_delivered/failed` tienen llamados funcionales y efectos persistidos, a diferencia de la ronda 4. No se pide rehacerlos todos: corregir **estos dos falsos oráculos** y asegurar evidencia RED→GREEN real de las condiciones.

## CI exacto y límites

**SHA:** `09d2a9206591cb8202e99daee0dafd1fc12dbde0`. Run `38156727884` — job `db-tests` `114521129594`. Log interno:
- Migración T-340 aplicada; `Files=1, Tests=10, Result: PASS` (bootstrap).
- `supabase/tests/t340_multi_drop.sql` OK; suite `Files=21, Tests=1972, Result: PASS`. Archivo T-340: `plan(69)`, 69 aserciones y cero `pass()`.
- Runner `t340_concurrency.mjs` ejecutado: **8 líneas de escenario OK y resumen `8/8`** en CI (entre 16:48:51 y 16:48:55 UTC), pero **las 4 B no invocan `publish_request`** como se explicó.
- `pnpm db:types --local`, sin drift (job terminó PASS); checks unit/lint/typecheck/build/audit/bundle-budget SUCCESS, `approval-policy` FAILURE, Supabase Preview SKIPPED.

**Checks locales propios:** no corridos: revisión remota por conector GitHub y sondas JS de lectura/mutación **en memoria**. No se levantó Docker/Supabase local ni remoto, no se disparó workflow, no se ejecutaron mutaciones de base. El CI verde es real, pero no equivale a cobertura semántica de los oráculos defectuosos.

**Sin decisiones nuevas para Lautaro073.** La opción A y los dos archivos adicionales ya están autorizados en la ficha. Los dos bloqueantes son reparables dentro del alcance actual. La PR permanece abierta, sin aprobar ni mergear.

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente, ronda 5  
**Resultado: CON BLOQUEANTES (2).**  
**Checks locales:** typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (**CI db-tests ✅ exact SHA**).  
**BLOQUEANTES:**
- H08 `supabase/tests/integration/t340_concurrency.mjs:229,324,419,514`: escenarios B usan `UPDATE status` manual en lugar de `publish_request` y el observador no atribuye el lock → llamar la RPC real, identificar los PIDs y validar errores/finalidad de sesión.
- H13 `supabase/tests/t340_multi_drop.sql:743–750, 930–937`: tests de estado e incompatibilidad legacy pasan por razones ajenas al guard bajo test → sembrar estado/actor válidos y mutación RED de cada guarda.
**MEJORAS:** evitar duplicación estructural de ocho bloques del runner al darles mantenimiento, siempre que no retrase ni debilite cobertura.
**No revisado:** mutaciones SQL reales sobre DB, merge/despliegue Develop/cliente legacy.
