# Revisión independiente — PR #317 / T-340 — ronda 7

**Fecha:** 2026-10-11 · **SHA exacto de código revisado:** `8b38d1a13a61dca47bfada86807a8cb5f0eb93e8` · rama `feat/T-340-varias-entregas` contra `develop` `7cf1a653dfa193f254d41611b47ae65930435b84`; `behind=0`.  
**Resultado: CON BLOQUEANTES (1, H15: evidencia RED→GREEN no demostrada). NO MERGEAR todavía ni iniciar paso 2.**

## Ronda 6: verificación independiente de las correcciones

| ID | Estado | Evidencia |
|---|---|---|
| **H13** — autorización de `mark_drop_delivered` / `mark_drop_failed` | **ARREGLADO-VERIFICADO** | `supabase/tests/t340_multi_drop.sql:766–862` agrega siete controles concretos: sin autenticación, comercio, repartidor ajeno, suspendido y no aprobado para `mark_drop_failed`; suspendido/no aprobado para `mark_drop_delivered`. Todos llaman las RPC productivas sobre drop pendiente con oferta aceptada y exigen errores concretos. Las comprobaciones de estado no mutado se apoyan en pgTAP y en el caso posterior que verifica `pending`; la suite `plan(77)` pasa en CI. |
| **H14** — dos marcas terminales simultáneas | **ARREGLADO-VERIFICADO** | `supabase/tests/integration/t340_concurrency.mjs:637–847` incluye **tres carreras de dos conexiones PostgreSQL distintas**: delivered+failed, failed+delivered y failed+failed. En cada una, `waitForBlockedLock(s1.pid,s2.pid)` valida contención real mediante `pg_blocking_pids`, se comprueba estado `in_transit` previo, ambos drops terminales, `delivered_at` no nulo y 0 pendientes. En el primer escenario hay además reintentos idempotentes. CI registra 3/3 y conserva H08 8/8. |

**H08** permanece **ARREGLADO-VERIFICADO** (ocho escenarios de publicación real). El autor limitó los tres archivos modificados desde la ronda 6 a `supabase/tests/t340_multi_drop.sql`, `supabase/tests/integration/t340_concurrency.mjs` y `docs/tasks/log/T-340.md`, todos autorizados. No alteró migración, fuente de producto, workflows, contratos, ficha ni carpeta `docs/revision-pr/**`.

### H15 — ALTO — Falta demostración RED→GREEN ejecutada que exige el DoD

**Fuente:** `docs/tasks/T-340.md` desde `develop`, DoD: «**RED de cada prueba nueva demostrado por el comportamiento que falta y anotado en la bitácora**». También se marca `[x]` en el cuerpo de la PR «Pruebas pgTAP con demostración RED→GREEN real».

**Evidencia:** la bitácora `docs/tasks/log/T-340.md`, nueva sesión `2026-10-11 15:45`, aporta **solo** ejecución verde de tests locales y GitHub Actions run `38164838441`; no identifica ninguna modificación temporal de la función productiva, comando para aplicarla, salida de prueba *not ok*/RED, vuelta a código original ni GREEN posterior para las nuevas garantías H13/H14. `.github/workflows/ci.yml` ejecuta migraciones, `pnpm supabase test db` y el runner, pero no hay paso de mutación negativa. La comprobación independiente en memoria detecta referencias a RPC y locks, pero **no sustituye una ejecución de PostgreSQL alterado**.

**Importante:** H13/H14 son pruebas reales que pasan. **No se afirma que el código productivo sea incorrecto**, ni se desconoce el valor del CI. Este hallazgo es de evidencia de aceptación exigida y del marcado prematuro de RED→GREEN como terminado.

**Corrección mínima exigida, sin ampliar implementación de negocio:** ejecutar en el **Postgres efímero de `db-tests`** un control negativo por cada clase de invariante nueva y guardar el **log real** con:
1. **H13, guard de pertenencia:** usar `pg_get_functiondef('public.mark_drop_failed(uuid,text)'::regprocedure)` sobre DB efímera para construir una redefinición temporal (no migración versionada) que elimine **solo** `v_offer.courier_id is distinct from v_actor_id`. Ejecutar pgTAP sobre el mismo esquema mutado y exigir que el test «`mark_drop_failed rechaza repartidor no asignado a la oferta aceptada`» se ponga **RED** precisamente por esa mutación; guardar el TAP `not ok` y exit de la ejecución. Restaurar el cuerpo original o `pnpm supabase db reset`; verificar **GREEN**.
2. **H14, lock de ambas RPC:** construir variantes efímeras temporales de `public.mark_drop_delivered` y `public.mark_drop_failed` quitando los `FOR UPDATE` del **lock de `delivery_requests` en ambas**, no los asserts del runner. Ejecutar **el mismo runner de dos sesiones** y exigir fallo de contención `pg_blocking_pids` o del invariante final. Restaurar la DB de prueba y confirmar **11/11 GREEN**.
3. Si se implementa runner de mutaciones, hacerlo **dentro de `db-tests`** y un archivo permitido ya existente (por ejemplo, un submodo `--mutation-check` del runner o comandos temporales `/tmp` en workflow), sin dependencias nuevas ni scripts versionados adicionales. Las mutaciones son transitorias **solo sobre DB local de Actions**, nunca staging, producción ni migraciones del repositorio. `db-tests` no debe terminar verde si faltó el RED esperado o su baseline posterior.

**Riesgos y contención:** los cambios DDL a RPC son transaccionales, pero dos conexiones bloqueadas pueden volver intermitente un ensayo si no se controlan los PIDs y los tiempos; usar DB reset/backup efímero y `try/finally`. Si una mutación no es viable sin riesgo o coste excesivo, documentar el bloqueo real en la bitácora y solicitar expresamente un cambio de criterio al dueño en vez de marcar el DoD como demostrado. **No hay una nueva decisión de producto: el requisito de RED ya está aprobado**, y se dispone de archivos de test/CI autorizados.

## Comprobaciones y límite de la revisión

**CI SHA exacto:** Workflow run `38165347809` / job `db-tests` `114546652154`:
- Migración T-340 aplicada en CI. Bootstrap `Files=1, Tests=10, Result: PASS`.
- `supabase/tests/t340_multi_drop.sql ... ok` y suite completa **`Files=21, Tests=1980, Result: PASS`** (pgTAP T-340 `plan(77)`, sin `pass()`).
- Runner real **H08 8/8** y **H14 3/3**, con mensajes individuales 1A…4B y 5…7, entre 18:52:29–18:52:37 UTC.
- `pnpm db:types --local` ejecutado, `git diff --exit-code -- src/types/database.types.ts` sin drift (job success).
- `unit, typecheck, lint, build, audit, bundle-budget` ✅; `approval-policy` ❌, `Supabase Preview` skipped. No se atribuye por inferencia la causa exacta de `approval-policy`.

**Batería independiente:** evaluación en V8 sobre blobs fuente del SHA y controles adversariales **EN MEMORIA**. H13 baseline con 7 wrappers identificados y mutación que elimina un wrapper detectada; H14 baseline con 3 escenarios, dos `PsqlSession` por escenario, tres esperas por PID, RPCs reales y aserciones de estados; quitar todas las esperas o una RPC de marcas en la fuente *en memoria* hace fallar el detector. **Esto no es RED SQL runtime**. Script reproducible documentado en `evidencia/comandos.md`.

**Checks locales propios:** n.e., no se dispone de checkout del SHA; no Docker/Supabase local ni remoto, no workflows manuales. No revisar aún merge/despliegue Develop, checkpoint de cliente legacy post-merge ni tareas siguientes.

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente — ronda 7

**Resultado: CON BLOQUEANTES (1 — H15 evidencia RED→GREEN faltante).**

Checks locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (db-tests CI real ✅).

**Verificados:** H13 y H14 corregidos, H08 ya verificado; código productivo de la PR sin cambios en esta ronda.

**BLOQUEANTE H15** `docs/tasks/log/T-340.md` sesión 15:45 y DoD de `docs/tasks/T-340.md`: solo se registran 77 pgTAP y 11 carreras GREEN, sin demostrar un RED de control negativo **sobre comportamiento productivo** → ejecutar mutaciones temporales del SQL en DB efímera de CI, capturar TAP/carreras RED de H13/H14, restaurar y documentar GREEN.

**MEJORA no bloqueante:** el runner H14 verifica el estado intermedio *antes* del primer commit pero no registra explícitamente `delivered_at` inmediatamente *después* de ese commit, ni compara el timestamp global tras reintentos. Añadir aserciones específicas si se desea demostrar más estrictamente «una sola transición»; la actual evidencia de 3 carreras y estado final demuestra serialización, por eso esta mejora **no bloquea**.

No hay decisiones de negocio adicionales. No aprobar, no mergear ni iniciar paso 2.
