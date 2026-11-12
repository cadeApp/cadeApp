# Ronda 2 — revisión independiente PR #689 (T-430 / CC-048)

**Fecha:** 2026-11-12  
**Head revisado:** `3912c5fc4a8bfca3b8d7373b2749fa6985425e25` · **código:** `e9aa88484647791f7a79b220718d2177f6f10cd7` · **base:** `develop@c823fae1`  
**Estado:** **SIN BLOQUEANTES · SIN HALLAZGOS ABIERTOS**. PR689-H01 **arreglado-verificado**; PR689-A01 **aceptado**. **No aprobar ni mergear.**

## 1. Diferencial de la ronda

La comparación `47cd4655...3912c5fc` da exactamente **2 commits, 0 behind**, y dos archivos modificados: `supabase/tests/cc048_merchant_draft_only.sql` (+36/-1, el plan pasa 107 → 111) y `docs/tasks/log/T-430.md` (+17). El commit `e9aa8848` modifica el test y añade bitácora; el `3912c5fc` cambia solo la bitácora, de modo que los logs GREEN de `e9aa8848` son válidos para el **mismo contenido de código** de `3912c5fc`. El SHA del blob de test es `5c00a3ef27c9c8706a0e41e46bacfb99969c89d7` en ambos.

El commit de mutación `7d93e30c` (#696) tiene como padre **`e9aa8848`** y cambia solo una línea de `supabase/migrations/20261111120000_cc048_merchant_draft_only.sql`: elimina `and r.status = 'draft'` del `WITH CHECK` de la policy `contacts_insert_merchant`, conservando propietario, trigger, resto de policies, **mismas 111 pruebas** y fixtures. La rama de mutación y la PR #696 están **cerradas, no mergeadas**. La migración del head real conserva esa condición.

El alcance permanece en las rutas autorizadas por la ficha, incluido el cambio de pruebas permitido D01-A. No aparecieron cambios en los otros módulos, privilegios o RPC.

## 2. Verificación de PR689-H01 (P08; D02-A)

**Dónde:** `supabase/tests/cc048_merchant_draft_only.sql:260-295`.

La cobertura añadida crea una tabla temporal de resultados y ejecuta tres INSERTs como `pg_temp.merchant()` tras `ALTER TABLE public.delivery_request_contacts DISABLE TRIGGER trg_lock_draft_contacts` **en un bloque PL/pgSQL con excepción capturada**. El `RAISE EXCEPTION ... ERRCODE='U0048'` hace rollback de la subtransacción, deshace el `ALTER TABLE` y cualquier INSERT exitoso, y deja persistentes las variables PL/pgSQL; los códigos se insertan a `cc048_policy_probe` después del bloque. Las cuatro `select is(...)` están **fuera** de él; se conserva el conteo TAP.

| Prueba | Control independiente |
|---|---|
| 108 | INSERT del primer contacto en `req_published_nc()` → `42501` por RLS sin el trigger |
| 109 | INSERT del primer contacto en `req_matched_nc()` → `42501` por RLS sin el trigger |
| 110 | INSERT en `req_foreign_draft()` → `42501` por falta de propiedad |
| 111 | `pg_trigger.tgenabled = 'O'` tras revertir el bloque |

**GREEN real de CI:** [run 43150132171](https://github.com/cadeApp/cadeApp/actions/runs/43150132171) sobre `e9aa8848`, concluido success. Se cotejó el log completo del job `db-tests` (job 130957189954): `cc048_merchant_draft_only.sql ............ ok`, `All tests successful.`, **`Files=45, Tests=3801, Result: PASS`** (dos veces en el log), y runner **`[CC-048] ... (8/8)`**. Los jobs `unit`, `audit`, `build`, `lint`, `typecheck` y `bundle-budget` también concluyeron success. El log incluye fallos **esperados en mutaciones internas de otros controles** y descargas temporales con rate limit recuperadas; no confundimos esas líneas con fallos del job.

**RED real de CI:** [run 43150138719](https://github.com/cadeApp/cadeApp/actions/runs/43150138719) de #696, SHA `7d93e30c`, conclusión failure solo en `db-tests` (job 130957112735). Extracto directo:

```text
# Failed test 108: "CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud published"
#         have: 00000
#         want: 42501
# Failed test 109: "CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud matched"
#         have: 00000
#         want: 42501
# Looks like you failed 2 tests of 111
Failed tests: 108-109
Files=45, Tests=3801
Result: FAIL
```

Esto demuestra **específicamente** que la barrera RLS `WITH CHECK status='draft'` es ejercida y que las aserciones fallan al romper **solo** esa barrera, aunque el trigger normal exista en la migración. El tercer caso (comercio ajeno) queda protegido por la condición de propietario; el cuarto verifica la restauración del trigger. A diferencia del RED de #692/#695, este RED no se debe a retirar el trigger. Es la prueba pedida por D02-A.

**Control propio adicional:** el revisor inspeccionó el test y ejecutó un validador estructural **en memoria** sobre el blob del head: baseline **GREEN** y **8/8 mutaciones del propio test RED**, detectando cambios en plan, rollback, trigger, actor, fixtures y expectativas. El harness íntegro reproducible queda en [evidencia/probe-ronda-2.mjs](../evidencia/probe-ronda-2.mjs), y sus límites constan en [comandos](../evidencia/comandos.md). **No se ejecutó PostgreSQL por la revisión**; el GREEN/RED DB procede de GitHub Actions real, con SHAs, logs y PR de mutación contrastados independientemente.

**Decisión de cierre:** `PR689-H01` pasa a **`arreglado-verificado`**, `ronda_arreglo = 2` y `verificado_en_sha = e9aa8848...`. No queda residual técnico de H01.

## 3. Regresiones, alcance y veredicto

- Se cotejó el patch completo del arreglo: las primeras 107 aserciones se conservaron; el único cambio al tramo previo es `plan(111)`. Las 108-111 se agregan luego de 107 y antes de `finish()`; no hay `.only`, `.skip`, mocks ni debilitamiento de expectativas.
- La policy productiva conserva `merchant_id = auth.uid()` y `r.status = 'draft'`; solo la **rama aislada** se usó para RED.
- La aprobación D01-A es una decisión de alcance y sigue **aceptada**, no «verificada técnicamente»; se registra su SHA documental original `47cd4655`.
- Los checks completos de GitHub CI son positivos para el SHA de código. No se obtuvo prueba propia local de PostgreSQL ni una ejecución E2E por diseño del gate de migración.
- No se encontraron regresiones atribuibles a la corrección. **Ningún nuevo hallazgo.**

**Resultado:** **SIN BLOQUEANTES · SIN HALLAZGOS ABIERTOS**. La PR puede seguir su proceso normal de integración sujeto a los gates del repositorio y la aplicación de migraciones; esta revisión no ejecuta aprobación, merge ni despliegue. Si se cambia SQL/tests/código tras `e9aa8848`, revalidar el SHA nuevo antes de considerar vigente este cierre.
