# Revisión independiente — PR #373 / CC-026 — ronda 2

**SHA inspeccionado:** `f62a385c6e152ea206598aa3460eeec31f97b2a1` (**PR sigue en Draft WIP, no solicitó revisión final**). **Base:** `develop` @ `687e2043817340b2951714cb6e7b179be2e3973a`. Fecha: 2026-10-15.  
**Resultado:** **CON BLOQUEANTES; NO MERGEAR.** Ronda incremental solicitada por el usuario sobre trabajo WIP, no certificación de DoD.

## Fuentes, método y alcance

- Comparado el único commit de autor desde ronda 1 (revisión `2799748` → actual) contra `docs/contracts/CC-026.md` en `develop`, `docs/tasks/T-366.md`, `AGENTS.md` y skill de revisión.
- Inspeccionados 17 archivos de PR (9 cambian después de R1: migración, pgTAP, harness, cron, fixtures, tipos y dominio) y el código vigente relevante de RLS/aceptación.
- Revisados checks reales de `CI #38711509294`, junto con los logs de `typecheck`, `unit`, `db-tests` y `build`. No ejecutar secretos ni DB remota. 
- El revisor **NO** ejecutó tests/SQL/mutaciones/CI localmente (sin clon con node_modules y Supabase local prohibido); las observaciones de SQLSTATE, errores TS y test HTTP son evidencia de CI GitHub a SHA `f62a385c6e152ea206598aa3460eeec31f97b2a1`. Los tests RED del autor no se reproducen por esta ronda. No usar `verificado_en_sha` para marcar correctos sin verificación independiente en ejecución.

## Resolución parcial de R1

| R1 | Situación en el SHA revisado |
|---|---|
| H01 — `VALIDATION_ERROR` omitido | **Corregido por inspección, no verificado de forma independiente**: errorCodes lo declara y el test adversarial lo requiere; `unit` no está en verde global |
| H02 — Conteo vs IDs inconsistentes | **Corregido por inspección, no verificado de forma independiente**: `superRefine` cruza conteo, unicidad y máximo de 50; test de salida remota invalida `INTERNAL_ERROR` |
| H03 — matriz de permisos/estados/batches | **Avanzó** con casos de roles y 50/51/101 en fake, mutaciones declaradas; **pendiente** pgTAP y concurrencia real en CI (ver H05/H06) |
| H04 — desigualdad temporal docs | **Abierto**: `docs/master-plan.md` sigue usando `now() > expires_at`; domino y SQL `>=` / `<=`. Reconciliar con alcance documental aprobado, no degradar contrato |

## Hallazgos nuevos R2

### PR373-H05 — CRÍTICO / BLOQUEANTE — bypass temporal por actualización directa

**`supabase/tests/cc026_reconcile_expired_requests.sql:242-246` / `supabase/migrations/20260922051650_rls_v1.sql:298-311,368-376`**

El job `db-tests` del SHA revisado muestra **test 34** `UPDATE delivery_requests.expires_at` como merchant propio, y **test 36** `UPDATE offers.decided_at` como courier: `SQLSTATE NULL` (la sentencia no lanzó el 42501 esperado). Se revisó la RLS original: `delivery_requests_update_merchant` congela estados/timestamps operativos pero **no** `expires_at`; `offers_update_courier` congela request/status pero **no** `decided_at`. Es una brecha de escritura directa; no representa mero problema de `assert`.

**Corregir:** en la **migración nueva sin merge** de CC-026, aplicar barrera PostgreSQL real para ambas columnas sin permitir que cliente prorrogue vencimiento ni altere fecha de decisión. Preferir inventario de `GRANT UPDATE` y permisos por columna *si preserva todas las escrituras legítimas*; si no, trigger `BEFORE UPDATE` con `OLD/NEW` y control de actor (distinguir callers SQL legítimos y RPC `SECURITY DEFINER` sin confiar en parámetros cliente). Nunca confiar en `WITH CHECK` que mira solo fila nueva. Repetir pgTAP con fila visible, verificar denegación **y** que fechas no cambian; intentar alterar cada campo sensitive adicional, no desactivar test 34/36. Verificar transición legítima de expiración vía RPC y aceptación al mismo tiempo.

### PR373-H06 — ALTO / BLOQUEANTE — harness SQL de concurrencia no está integrado al CI y permite errores silenciosos

**`supabase/tests/integration/cc026_reconcile_expired_requests.mjs:18-46,146-223`, `.github/workflows/ci.yml:186-195`**

El archivo existe, pero el workflow corre únicamente `t340_concurrency.mjs` y `cc024_atomic_concurrency.mjs` (además de T340 de mutación). El nuevo harness **nunca se ejecuta** en `db-tests`. Incluso al correrse manualmente, `PsqlSession` invoca `psql -v ON_ERROR_STOP=0`; los marcadores `\\echo` se imprimen aunque un SQL falle, y en el escenario de aceptación/republicación no se parsea ni afirma la respuesta de la propia reconciliación. El resultado del test no demuestra la carrera con el rigor declarado.

**Corregir:** obtener aprobación/alcance **explícito** de `.github/workflows/ci.yml` o crear PR previo separado autorizando un runner equivalente; añadir llamada en job `db-tests` para `node .../cc026_reconcile_expired_requests.mjs` con `DB_CONTAINER` existente. Hacer fail-fast en `psql` o comprobar `ERROR`/exit code del comando, estructurar assertions del JSON devuelto por cada sesión y exigir mutación RED retirando lock o revalidación. No adulterar mocks, no afirmar carreras verificadas sin run GREEN.

### PR373-H07 — MEDIO / BLOQUEANTE CI — limpieza pgTAP viola FK

**`supabase/tests/cc026_reconcile_expired_requests.sql:135-145,248`**

CI: `clear_requests` intenta eliminar `delivery_requests` sin borrar primero las filas de `offers`; SQLSTATE de FK `offers_request_id_fkey` referencia request `...0004` y detiene el setup después de algunas aserciones. El supuesto `ON ERROR` impide cobertura completa.

**Corregir:** crear `clear_requests()` que borre ofertas pertenecientes a solicitudes de merchant de fixture **antes** de borrar el parent; preservar audit y otras tablas hijas según FK. No deshabilitar constraints, no ignorar error. Asegurar pgTAP completa GREEN.

### PR373-H08 — MEDIO / BLOQUEANTE CI — regression test del endpoint cron quedó con fixture obsoleto

**`src/app/api/cron/sweep/route.test.ts:62-199`, `src/server/cron/sweep.ts:71-83`**

CI unit: **2240/2241 PASS** y el caso GET/POST cron con secreto válido devolvió 500 (esperado 200). El fixture `setAdminClientMock` en route.test no provee `rpc`, porque fue diseñado para el sweep PostgREST anterior; `runSweep` ahora llama `supabase.rpc('reconcile_expired_requests_cron',{p_limit:200})`.

**Corregir:** extender **alcance contractual** con `src/app/api/cron/sweep/route.test.ts`; actualizar el mock para resolver la RPC con respuesta válida (IDs, count, hasMore, courierIdsByRequest). Mantener assertions de 200/401/500 reales, sumar assertion de RPC invocada y de no exposición de secretos. **No** cambiar 200 por 500 ni esconder el test.

### PR373-H09 — ALTO / BLOQUEANTE CI — tipos de base no regenerados

**`src/types/database.types.ts` (omitido del diff), `src/server/cron/sweep.ts:73`**

Blob `database.types.ts` actual no declara `reconcile_expired_requests` ni `reconcile_expired_requests_cron`. CI `typecheck`/build: `TS2345` en RPC cron. El autor reconoce que su Docker local no responde. 

**Corregir:** en entorno local de implementador permitido, restablecer Docker de forma reproducible, aplicar migración en Supabase local y ejecutar `pnpm db:types --local` (seguir comando del repo, no inventar `--db-url` ni usar Supabase remoto). Commitear salida completa **generada**, no castear string ni editar a mano. CI `db-tests` compara tipos reales con migración. Resolver el error del source, no cambiar tsconfig/checks.

### PR373-H10 — MEDIO / CORRECCIÓN — cron ignora `hasMore` y corre solo un lote de 200

**`src/server/cron/sweep.ts:72-84`**

La RPC cron devuelve `hasMore`, pero `runSweep` hace exactamente **una invocación** con `p_limit=200` y solo usa `expiredCount`. Con >200 solicitudes vencidas, el cron diario dejará pendientes hasta el siguiente día. CC-026 promete *batches con tiempo límite y reintento futuro*, no omitir `hasMore`.

**Corregir:** loop acotado de lotes sobre la RPC, sumando `expiredCount` real y notificando cada batch cambiado; separar `hasMore=true` causado por SKIP LOCKED de filas bloqueadas: si `expiredCount=0`, no hacer spin; continuar en próxima ejecución y/o reportar backlog controlado. Test de 201/401 IDs con contadores, push best-effort e invariancia de purga de documentos/suscripciones. No cambiar `vercel.json` ni cron sin decisión de producto.

## Gates y evidencias aún pendientes

- CI run [#38711509294](https://github.com/cadeApp/cadeApp/actions/runs/38711509294): `lint` y `audit` PASS; `typecheck`, `build`, `unit` y `db-tests` FAIL, `bundle-budget` SKIPPED. Vercel FAILURE. `approval-policy` FAILURE; no atribuir verde a otro SHA. No E2E Preview GREEN comprobado.
- El `db-tests` llegó a ejecutar pgTAP pese a avisos de Docker Hub Rate Exceeded. El harness de concurrencia no llegó a correr porque ni está invocado.
- La PR sigue Draft y el body dice explícitamente WIP y que aún no solicitó revisión final.
- T-366 permanece bloqueada y asignada a KiraK72, hasta que CC se mergee, el contrato migre a Develop, y T-366 se reconcilie en develop.

**Resultado R2:** hubo progreso real sobre R1, pero el diagnóstico de seguridad nuevo es PRIORIDAD 1 y la prueba de concurrencia no está ejecutada. **NO APROBAR, NO MERGEAR, NO DESBLOQUEAR T-366**. Ronda 3 cuando el autor corrija y solicite la revisión.
