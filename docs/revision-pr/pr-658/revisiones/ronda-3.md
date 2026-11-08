# Informe de revisión — PR #658 / T-408 / CC-047 — Ronda 3

**Revisor:** independiente · **Fecha:** 2026-11-08  
**PR:** https://github.com/cadeApp/cadeApp/pull/658  
**SHA de código revisado:** `0fd186af738fd3bf993c79f97cd09bf5c34ea4be`  
**Head previo a commit de revisión:** `5f3512aede017bfcdf651de57b43e8e14119d200` (**solo bitácora** posterior al código).  
**Target:** `develop` / `fd86f9b2a25b39607e2719e76ad1821f84f44eef`.  
**Resultado: SIN BLOQUEANTES DE CÓDIGO.** H07 **arreglado-verificado**, total H01–H07 **7/7 cerrados**. No se aprobó ni mergeó.

## Fuentes y alcance

1. Lectura de las tres fuentes normativas desde `develop` antes del diff: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`; ficha `docs/tasks/T-408.md` desde `develop`; CC aprobado `docs/contracts/CC-047.md`.
2. Diff **desde el commit de revisión R2** `456d6cc4` al SHA funcional `0fd186af`: exactamente `supabase/tests/cc047_admin_hardening.sql` (+27/-1) y `docs/tasks/log/T-408.md` (+8). La comparación `0fd186af..5f3512ae` añade **solo** `docs/tasks/log/T-408.md` (+13). El autor no tocó `docs/revision-pr/**`, migración productiva, ninguna otra suite ni app.
3. Contrastado todo el bloque de `cc047_admin_hardening.sql:136-160` con el contrato `rate_limits` RPC-only (CC-047, D01=B) y con el hallazgo H07 de [ronda 2](ronda-2.md). Se mantiene intacto el catálogo global H02 de policies que referencian `is_admin()` en `cc047_admin_hardening.sql:222-228`.
4. Leídos el diff y SHA de [PR de mutación #663](https://github.com/cadeApp/cadeApp/pull/663) (`35de0dd24ef1337282fc29f82a663fc87a92ba1f`): **solo** agrega `rate_limits_insert_any FOR INSERT TO authenticated WITH CHECK(true)` a la migración, 3 líneas; ningún test tocado. PR CLOSED **sin mergear**.
5. Ejecutada una verificación **independiente de estructura en memoria** sobre los textos originales y mutados recuperados de GitHub por SHA exacto: original tiene una policy `FOR SELECT USING(false)` y cero no-SELECT, mutante tiene la misma SELECT y una `FOR INSERT`; el pgTAP realiza catálogo sin filtro por nombre/predicado, tres INSERT autenticados y tres verificaciones de ausencia. **10 comprobaciones estáticas, todas verdaderas.** Esto no es una ejecución independiente de PostgreSQL. El resultado PostgreSQL se corroboró leyendo los logs de CI/pgTAP del autor.

## H07 — arreglo verificado

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:136-160`

- **Estructural:** nuevo `select is((select count(*)::bigint from pg_policies where schemaname='public' AND tablename='rate_limits' AND cmd <> 'SELECT'), 0::bigint, ...)`. La condición no depende del nombre, del rol ni de que una policy contenga `is_admin()`. Incluye `FOR ALL` y las operaciones INSERT/UPDATE/DELETE.
- **Funcional:** tres `pg_temp.run(actor, aal, INSERT...)` con `subject` únicos y `action='cc047-direct'` para admin `aal1`, admin `aal2` y courier `aal1`. Exigen SQLSTATE **42501**; en sentencia aparte tres `count(*) = 0` como superusuario comprueban que ninguna fila quedó. El fixture superusuario anterior para `rate_limits` y la RPC positiva `submit_offer` permanecen. Plan pasó **92 → 99** exactamente (1+3+3 aserciones).
- **Prueba de regresión:** #663 introduce una policy de inserción permisiva que **no** menciona `is_admin()`, la clase que escapaba a H02. El nuevo test de catálogo falla (`have 1 / want 0`); los tres INSERT dan `00000` en vez de `42501` y los tres `count(*)` pasan a 1. Por lo tanto hay grant INSERT efectivo para `authenticated` y RLS es la defensa real. Esta conclusión está sustentada en el log de pgTAP, no inferida de defaults.
- **No debilitó H02:** la aserción de catálogo general sigue presente. **No mutó migración productiva, triggers ni grants** de la rama correcta.

## CI y contraste real de RED/GREEN

| Contexto | Ejecución y SHA | Prueba efectiva |
|---|---|---|
| GREEN, CI de la PR real | [run 42446531770](https://github.com/cadeApp/cadeApp/actions/runs/42446531770), `0fd186af738fd3bf993c79f97cd09bf5c34ea4be`, intento 1 | Job `db-tests` 128626513818 **success**, `cc047_admin_hardening.sql ... ok`, **Files=44 Tests=3683 Result: PASS**; D/E de CC-031 GREEN por `before`; drift de `database.types.ts` PASS. Jobs typecheck/lint/unit/build/audit/bundle-budget success. Unit: **199/199 archivos, 3755/3755 tests**. |
| RED mutación H07, aislada | [run 42446535180](https://github.com/cadeApp/cadeApp/actions/runs/42446535180), `35de0dd24ef1337282fc29f82a663fc87a92ba1f`, intento 1 | `cc047 Failed 7/99` (índices **6–12**): #6 catálogo `have 1, want 0`; #7–9 SQLSTATE `have 00000, want 42501`; #10–12 persistencia `have 1, want 0`. Job `db-tests` **failure**. Solo se mutó la migración; tests idénticos. |
| Diferencia de código R2→R3 | `456d6cc4..0fd186af` | Solo un test SQL y bitácora. H01–H06 y todo código productivo intactos. |
| Prueba independiente del revisor | Inspección estructural ejecutada con los textos de `0fd186af` y `35de0dd2` | Baseline: **0 DML policies** en `rate_limits`, mutante: **1 DML policy**; tres actores y pruebas por código/persistencia presentes; fuente pgTAP idéntica entre mutante y original. Script y resultado detallados en [evidencia/comandos.md](../evidencia/comandos.md). **No es un RED PostgreSQL propio.** |

En el log GREEN aparecen fallas/timeout dentro de *harnesses de mutación efímera* de suites ajenas (cc026, cc030, T-340 H14, CC-031), seguidos de su restauración a GREEN. El resultado final de `db-tests` es **success**. No confundir esos mensajes con defectos de la PR.

## Estado agregado después de R3

| Hallazgo | Estado | SHA de verificación |
|---|---|---|
| H01 rate_limits SELECT deny | arreglado-verificado en R2 | `511940aa` |
| H02 catálogo admin DML | arreglado-verificado en R2; test intacto en R3 | `511940aa` |
| H03 Storage write guards | arreglado-verificado en R2 | `511940aa` |
| H04 D1 admin/admin race | arreglado-verificado en R2; escenarios D/E GREEN nuevamente en R3 | `511940aa` |
| H05 D3 AAL/columnas | arreglado-verificado en R2 | `511940aa` |
| H06 SEC-11 notas + D2 | arreglado-verificado en R2; no-backfill exclusivamente inspección de SQL | `511940aa` |
| **H07 rate_limits RPC-only DML** | **arreglado-verificado en R3** | **`0fd186af`** |

No aparecen hallazgos nuevos al contrastar el cambio único de esta ronda.

## Limitaciones y gates humanos

- **Checks locales del revisor:** typecheck n.e.; lint n.e.; unit n.e.; `test:db` local n.e. (no hay checkout Git local con dependencias ni base Supabase propia en esta sesión). Los checks del CI oficial se corroboraron **por jobs y logs de los SHA exactos**. No se corrió `git merge-tree`; la API de GitHub marcó la PR como `mergeable=true` en esta fecha.
- **e2e-preview** en el SHA de código `0fd186af`: estado `error BLOCKED / REQUIRES DEVELOP MIGRATION`, [run 42447133352](https://github.com/cadeApp/cadeApp/actions/runs/42447133352), **esperado** porque la PR toca migraciones. Según `docs/runbooks/e2e-preview.md:109-115`, la migración de Develop corre tras merge; la línea 153 aclara que un E2E post-merge automático sobre el despliegue de Develop todavía **no está implementado**. No afirmar E2E verde.
- **Acción manual, antes de promover cada ambiente:** Lautaro073 ejecuta la consulta de **solo lectura** de candidatos `merchants.notes` de CC-047 `6, resuelve cada `merchant_id` y registra ambiente, fecha, SHA, cantidad y resultado **sin texto de notas**. Si queda candidato pendiente, no promover. El revisor no consultó Supabase remoto ni guardó datos sensibles.
- **Tras merge:** `migrate-develop` aplica migración y comprueba drift; validar el **E2E del panel admin `aal2` en staging** antes de producción (según runbook; no inventar E2E automático en Develop). **No es aprobación ni merge.**
- No hay correcciones de código pendientes por esta revisión; las acciones anteriores son **gates operativos separados** que el usuario debe gestionar.

## Cierre

**SIN BLOQUEANTES DE CÓDIGO.** H01–H07 corregidos y contrastados en los SHAs citados. Cierre documental de R3 en rama de la tarea, preservando intactos los informes históricos de R1 y R2. No hubo aprobación, merge ni intervención de bases remotas.
