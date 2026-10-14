# Revisión independiente — PR #317 / T-340 — ronda 6

**Fecha:** 2026-10-11. **SHA de código revisado:** `00ec6a77a445ae6db677e80b27c111079200a5fa`. **Base:** `develop` `7cf1a653dfa193f254d41611b47ae65930435b84` (behind=0). Autor: `asako669`, P2.  
**Resultado: CON BLOQUEANTES (2: H13 residual y H14 nuevo). NO MERGEAR; no iniciar paso 2.**

## Ronda 5: verificación de las correcciones

| ID | Resultado | Evidencia |
|---|---|---|
| **H08 — carreras contra publicación** | **ARREGLADO-VERIFICADO** | Ahora en las **cuatro B** la sesión S1 llama `public.publish_request(reqId)` como `authenticated` antes de confirmar. `pg_backend_pid()` identifica ambas conexiones y `pg_blocking_pids(waiterPid)` + `wait_event_type='Lock'` corroboran bloqueo específico. Cada sesión usa `ON_ERROR_STOP=1`; respuesta `published`, error esperado de S2 y estado final se inspeccionan. Las cuatro A ya usaban la RPC. CI del SHA exacto corrió 8/8. La verificación del revisor es lectura independiente + sondas estructurales adversariales EN MEMORIA + logs CI; no se ejecutó Postgres mutado. |
| **H13, oráculos de estado y legacy** | **CORRECCIONES VERIFICADAS, PERO H13 AÚN PARCIAL** | El caso «no `in_transit`» ahora usa solicitud `matched`, oferta aceptada real y exige exactamente `INVALID_STATE_TRANSITION`. El caso legacy N>1 usa una solicitud `in_transit` separada con oferta aceptada y dos drops, de modo que puede alcanzar la guarda `drops_count>1`; CI pasa. **Falta cobertura de actor de la segunda RPC**, ver H13 residual. |

**Alcance:** desde la revisión anterior el agente solo modificó `supabase/tests/integration/t340_concurrency.mjs`, `supabase/tests/t340_multi_drop.sql` y `docs/tasks/log/T-340.md`, todos autorizados. No alteró migración, código de producto, workflows, contratos ni `docs/revision-pr/**`. La opción A permanece autorizada por Lautaro073 y registrada en la ficha.

## Bloqueantes vigentes

### H13 (residual) — ALTO — `mark_drop_failed` sin pruebas negativas de autorización y elegibilidad

**Archivos:** `supabase/tests/t340_multi_drop.sql:741–925` y `supabase/migrations/20261009200000_t340_multi_drop.sql:1085–1230`. **Contrato:** CC-022 §6 (actor, elegibilidad y pertenencia a oferta aceptada antes de transición) y tests §«Estados»: transiciones válidas e inválidas **por actor**.

**Hecho:** la nueva suite prueba `UNAUTHENTICATED`, `UNAUTHORIZED_ACTOR` para comercio y repartidor ajeno **solo mediante `public.mark_drop_delivered`**. Todas las llamadas de las funciones pg_temp de prueba a `public.mark_drop_failed` se hacen con `pg_temp.courier_1_id()`, el repartidor válido. Algunas ejecutan `reset_actor()` **después** de la RPC, que no constituye un test de actor rechazado. Tampoco existe caso de repartidor suspendido/no aprobado para ninguna de las dos RPC.

**Consecuencia:** una regresión que elimine `v_offer.courier_id is distinct from v_actor_id`, `courier.status <> 'approved'` o el guard de rol en **`mark_drop_failed`** no quedaría detectada por su actual suite de actores. No se afirma que exista un bypass en el SQL productivo actual: el guard está presente; lo que falta es un test que lo haga fallar ante una mutación de código productivo.

**Corrección delimitada:** en `supabase/tests/t340_multi_drop.sql`, agregar pruebas **directas** de `public.mark_drop_failed` como (1) no autenticado, (2) comercio, (3) repartidor ajeno **aprobado pero no asignado**, (4) repartidor asignado **suspendido**, (5) repartidor asignado **no aprobado**; añadir al menos elegibilidad suspendida/no aprobada de `mark_drop_delivered`. Usar fixtures aislados o cambio de status con restauración verificable dentro de función, sin perturbar el courier de tests existentes. En cada caso, comprobar excepción exacta según precedencia CC-022 §6 y ausencia de mutación en drop/solicitud; no aceptar regex `A|B` que permita rechazos por otras precondiciones. `pg_temp.act_as` debe simular JWT/actor real; `SET ROLE` si aplica la convención de suite. Añadir mutaciones productivas reales en entorno efímero y reversible: quitar SOLO el guard de pertenencia de `public.mark_drop_failed` y quitar SOLO el guard suspendido/aprobado en cada RPC. Cada prueba correspondiente debe ponerse RED, y volver GREEN al restaurar. No inventar resultados ni modificar tests para acomodar mutaciones.

**Control independiente EN MEMORIA:** el texto de migración contiene `v_offer.courier_id is distinct from v_actor_id` en `mark_drop_failed`; al quitarlo por reemplazo en memoria, la protección desaparece. Ninguno de los seis wrappers de pgTAP que invocan `mark_drop_failed` lo hace con `courier_2_id`, merchant o actor sin JWT. Esto demuestra la ausencia del **caso de prueba**, no una vulnerabilidad runtime. Ver `evidencia/comandos.md`.

### H14 — ALTO — Falta la prueba obligatoria de dos marcas concurrentes de las últimas entregas

**Archivos:** `supabase/tests/integration/t340_concurrency.mjs:155–591` y `supabase/tests/t340_multi_drop.sql:791–976`. **Fuente:** CC-022 §6, líneas 304–305 («dos marcas concurrentes de las últimas entregas se serializan y el cierre ocurre exactamente una vez»); CC-022 pruebas §«Estados», línea 511; ficha T-340 DoD «Estados». Ambas RPC públicas (`mark_drop_delivered` y `mark_drop_failed`) **ya se exponen en la migración del paso 1**.

**Hecho:** el runner de dos sesiones prueba exactamente ocho carreras `public.publish_request` frente a escrituras de hijos, y **nunca llama `mark_drop_delivered` ni `mark_drop_failed`**. pgTAP sí marca entregas individualmente, pero todas sus llamadas son **secuenciales en una sola conexión/transacción**. No se comprueba la propiedad de cierre concurrente; los 1.972 tests verdes no equivalen a esa prueba.

**Corrección delimitada, sin archivos nuevos:** ampliar `supabase/tests/integration/t340_concurrency.mjs` (ya autorizado para el paso 1) con una **nueva clase de carreras**, sin tocar el rollout/UI: sembrar solicitud `in_transit` con DOS drops `pending`, oferta `accepted`, `courier` aprobado/asignado con JWT válido y dos sesiones `psql` independientes. En sesión A `BEGIN; SELECT public.mark_drop_delivered(drop1)` (retener transacción/lock); en sesión B `BEGIN; SELECT public.mark_drop_failed(drop2,'motivo')` (y en una segunda fixture invertir orden/RPC), corroborar el bloqueo exacto por `pg_blocking_pids`, confirmar A y después B; comprobar dos drops terminales, `delivery_requests.status='delivered'` y `delivered_at` consistente, ausencia de drops `pending`, que la primera RPC no cerró anticipadamente el padre y la última sí, y que reintentar no vuelve a crear la transición. Concretar aserción de **«una sola vez»** mediante artefacto de estado/auditoría disponible; si no existe contador/evento observable, no inventarlo: demostrar cierre por una única transición `in_transit→delivered` con estado visto tras cada commit y timestamps estables tras reintento. Ejecutar también la variante de **ambas `failed`** para confirmar cierre `delivered`.

**Mutaciones RED recomendadas:** quitar temporalmente el `FOR UPDATE` de `delivery_requests` dentro de ambas RPC en copia efímera de Postgres o reemplazarlo por bloqueo insuficiente; la prueba debe fallar al perder la contención específica, mientras que sin mutar corre GREEN. Las pruebas con estados terminales deberían detectar carreras sin serializar o no cerrar el padre. No versionar SQL mutado, no tocar staging/producción ni afirmar haberlo ejecutado si solo hay sonda textual.

**No hace falta decisión de Lautaro073:** el contrato y la ficha ya lo ordenan; el runner y la invocación en `db-tests` están permitidos mediante opción A. Solo agregar casos al archivo de pruebas existente y mantener los 8 anteriores. No ampliar contratos, fichas, workstreams o permisos sin autorización.

## CI real exact SHA y límites

**SHA** `00ec6a77a445ae6db677e80b27c111079200a5fa`. Workflow run `38162310109`; `db-tests` job `114537608013`. Log interno:
- Migración aplicada sin error. Bootstrap `Files=1, Tests=10, Result: PASS`.
- T-340 `t340_multi_drop.sql ... ok`, `plan(69)`, **suite `Files=21, Tests=1972, Result: PASS`**.
- Runner nuevo **ocho escenarios 1A→4B OK** (con `publish_request` real en ambas órdenes ahora, ver fuente). El script concluye 8/8 a las 18:09 UTC. `pnpm db:types --local` y diff sin drift, job verde.
- `unit`, `lint`, `typecheck`, `build`, `audit`, `bundle-budget` ✅. `approval-policy` ❌ (no tratado por esta PR), Supabase Preview SKIPPED. No hubo cambios de código productivo entre rondas 5 y 6.

**Checks propios locales:** n.e.; lectura con GitHub conectado, sonda JS independiente sobre texto exacto y logs reales de CI. No se ejecutó Postgres/Docker/Supabase local, remoto ni mutaciones SQL reales (por política). **No se confunden sondas estructurales con RED→GREEN ejecutado**. No se ejecutó E2E ni checkpoint post-merge.

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente — ronda 6

**Resultado: CON BLOQUEANTES (2).**

Checks locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (CI `db-tests` ✅ SHA exacto).

BLOQUEANTES:
- H13 (residual) `supabase/tests/t340_multi_drop.sql:741–925`: falta prueba de actores ilegítimos/suspendidos/no aprobados de `mark_drop_failed`, y elegibilidad de `mark_drop_delivered`. Completar matriz y mutaciones negativas específicas.
- H14 (nuevo) `supabase/tests/integration/t340_concurrency.mjs:155–591`: no se prueban dos marcas concurrentes de las últimas entregas y cierre único del padre, exigidos en CC-022 §6. Añadir sesiones paralelas para delivered/failed y all-failed, comprobar barrera + estado, mutación RED.

MEJORAS: terminar de documentar resultados de mutaciones SQL reales si el CI efímero lo permite; si no, declararlo no ejecutado. Mantener logs libres de información sensible de destinatarios.

No revisado: mutación runtime de RPC, integración a Develop ni despliegue/checkpoint legacy.

**Sin decisiones adicionales. No aprobar ni mergear.**
