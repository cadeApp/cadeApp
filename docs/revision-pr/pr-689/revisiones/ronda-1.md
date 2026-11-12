# Ronda 1 — revisión independiente PR #689

**Fecha:** 2026-11-12 · **Tarea:** T-430 · **Contrato:** CC-048 · **SEC:** SEC-06  
**Head revisado:** `7ce8a7f15b28f8624d025efb5f17949c982b858e` (el commit respecto de `93d4fa33` modifica solo la bitácora).  
**Base:** `develop@c823fae1` · **Resultado:** **SIN BLOQUEANTES demostrados · 1 MEJORA acordada pendiente**.  
**No se aprueba ni mergea.** El informe no afirma verificación de base ejecutada por la revisión.

## 1. Alcance y vigencia

Se leyeron la ficha de T-430 en `develop`, CC-048 en `develop`, la bitácora de T-430 en el SHA, el cuerpo de la PR y comentarios (no había discusiones de review; solo aviso automático de Vercel). Comparación de GitHub: rama 18 commits por delante y 0 por detrás de `develop`, PR mergeable, sin cambio de contrato numérico o migración conflictiva informado por la API. **No se ejecutó `git merge-tree` local**, pues en este entorno no fue posible clonar.

Los diez archivos modificados incluyen la migración, las pruebas y la documentación declarada. Dos archivos no figuraban en `Archivos permitidos` de la ficha **de `develop`**: `supabase/tests/t339_fixed_price.sql` y `supabase/tests/integration/cc026_reconcile_expired_requests.mjs`. La rama agrega ambos a T-430, CC-048 y el plan, sin camuflar el cambio. El caso 11/12 de T-339 pasa de un rechazo `42501` a **0 filas + valor publicado conservado**, porque la fila deja de cumplir el `USING`; el runner de CC-026 cambia únicamente quién toma el lock preparatorio, preservando las aserciones de las RPC.

**D01-A — ACEPTADA por Lautaro073 en conversación el 2026-11-12.** Se ratifica específicamente esta ampliación y no se registra como incumplimiento pendiente. Registrar como `PR689-A01` (aceptado por decisión, no como arreglo técnico verificado).

## 2. Implementación revisada

- `supabase/migrations/20261111120000_cc048_merchant_draft_only.sql:4-25`: `delivery_requests_update_merchant` pasa a `USING (merchant_id = auth.uid() and status = 'draft')` y conserva las restricciones de `WITH CHECK` sobre la fila resultante.
- `:27-49`: `contacts_insert_merchant` exige dueño y `draft` en `WITH CHECK`; `contacts_update_merchant` exige lo mismo en ambas cláusulas, y su `USING` tiene `FOR UPDATE OF r` para bloquear primero el padre.
- `:51-60`: revokes de `delete/truncate/references/trigger` de clientes; para contactos, INSERT y UPDATE solo en las columnas permitidas, sin UPDATE de `request_id`.
- `:63-124`: helper `security invoker` con `search_path` fijo; fallback de errores `INVALID_STATE_TRANSITION`/ `NOT_FOUND`; trigger `trg_lock_draft_contacts` exclusivamente `BEFORE INSERT`.
- `supabase/tests/cc048_merchant_draft_only.sql:91-154`: barrido de las 12 columnas concedidas, 24 rechazos por estado y 12 actualizaciones legítimas en draft; `:155-257`: contactos, privilegios y estructura del trigger.
- `supabase/tests/rls_matrix.sql:295-330`: tres aserciones separadas del UPDATE en draft y rechazo de publicada, no solo `lives_ok`; la mutación de `updated_at` se detecta en CI.
- `supabase/tests/integration/t340_concurrency.mjs:865-1261`: ocho escenarios nuevos con espera observada por `pg_blocking_pids`, persistencia final y comprobación de ausencia de deadlock por inspección de las salidas.

**Limitación de certeza:** los logs de CI validan las carreras declaradas, pero no equivalen a ejecutarlas personalmente. Ningún hallazgo funcional de SEC-06 fue demostrado con el SQL vigente.

## 3. Hallazgos

### PR689-H01 — MEJORA (medio, test-coverage, P08) · cobertura independiente de `contacts_insert_merchant`

**Dónde:** `supabase/tests/cc048_merchant_draft_only.sql:155-166`, en relación con `supabase/migrations/20261111120000_cc048_merchant_draft_only.sql:28-34,119-124`.

**Hecho comprobado por inspección:** los rechazos de INSERT fuera de `draft` pasan primero por `trg_lock_draft_contacts`, que produce `INVALID_STATE_TRANSITION`. La prueba de INSERT y la mutación #692/#695 que retira el trigger prueban esa barrera y parte del comportamiento global. **No aíslan la cláusula `status = 'draft'` de `contacts_insert_merchant WITH CHECK`.**

**Riesgo hipotético, no bypass actual demostrado:** si se eliminara solo esa condición del `WITH CHECK`, el trigger seguiría rechazando los casos de INSERT publicados y la batería funcional podría continuar verde. La batería **estática propia** detecta esta eliminación en rojo; eso solo comprueba la estructura y no sustituye la mutación de PostgreSQL contra pgTAP.

**D02-A — DECIDIDA:** agy debe agregar a `cc048_merchant_draft_only.sql` una prueba independiente que deshabilite `trg_lock_draft_contacts` dentro de una subtransacción/savepoint, intente como comercio dueño insertar el **primer** contacto en `req_published_nc()` y `req_matched_nc()`, exija `42501` de la RLS y luego restaure el estado con rollback de subtransacción; idealmente incluir `req_foreign_draft()`. Registrar y verificar la restauración del trigger. Evitar incluir aserciones pgTAP *dentro* del savepoint que se revierte, ya que el rollback podría revertir su contador: capturar el resultado en variables PL/pgSQL, deshacer la subtransacción y ejecutar `is()` afuera.

**RED exigido:** en una PR de mutación aislada `review/T-430-insert-with-check` (`REVIEW ONLY / NEVER MERGE`) quitar exclusivamente `and r.status = 'draft'` del `WITH CHECK` de `contacts_insert_merchant` en la **migración de esa rama de mutación**, conservando el trigger productivo normal; la prueba aislada deshabilita el trigger solo durante su probe. Deben fallar las nuevas aserciones de `published` y `matched` porque INSERT entra; al restaurar la condición y dejar la rama real intacta, GREEN. El agente no puede auto-marcar `arreglado-verificado`.

**Estado:** abierto / no bloqueante por ahora. Al haber elegido mejorar el instrumento, solicitar la corrección antes de considerar el cierre definitivo de la PR. La revisión independiente debe revalidar el RED/GREEN en una ronda posterior.

### PR689-A01 — ALCANCE (D01-A)

**Dónde:** `docs/tasks/T-430.md:48-54` y archivos de prueba indicados. Ampliación de dos archivos ratificada expresamente el 2026-11-12. **Estado: aceptado**; no pedir revert ni PR documental nueva.

**BLOQUEANTES funcionales:** ninguno observado/demostrado.  
**MEJORAS:** PR689-H01 (pendiente).  
**Decisiones abiertas:** ninguna (D01-A y D02-A resueltas).

## 4. Pruebas, CI y límites de reproducción

**Logs examinados, todos contra SHAs concretos:**

| Evidencia | SHA/run | Observado |
|---|---|---|
| RED sin migración | `93db713d` / 43139076669 | `db-tests` falla; bypass por columnas y fixtures fuera de draft muestran falla |
| GREEN de implementación | `93d4fa33` / 43141703429 | jobs verdes; db-tests `Files=45, Tests=3797, Result: PASS`; CC-048 integración 8/8; `git diff --exit-code -- src/types/database.types.ts` |
| Mut. #690 quita filtro draft del UPDATE de solicitud | `e4e093ea` / 43141096829 | falla `db-tests` por bypass |
| Mut. #691 quita lock del `USING` de UPDATE contacto | `09c52762` / 43141101157 | falla el escenario de espera del lock 8A |
| Mut. #692 quita trigger INSERT | `6e4dfdc9` / 43141105058 | falla pgTAP contactos |
| Mut. #695 continúa mutación trigger | `51ad5922` / 43142454194 | integración 9C detecta contacto indebido tras saltar verificaciones previas; **no** es mutación independiente de solo un control, se omitieron temporalmente pruebas para alcanzarla |
| Mut. #693 cambia ID legítimo por inexistente | `2609334d` / 43141110457 | fallan aserciones 21-23 de `rls_matrix` |
| Mut. #694 quita trigger de updated_at | `2c758864` / 43141114874 | fallan `rls_matrix` 23 y `structure` 41 |

**Batería propia, estática:** control original GREEN, **7/7 mutaciones RED** del SQL revisado. Script íntegro y reproducción en [evidencia/comandos.md](../evidencia/comandos.md). No se confundió la detección estructural con un RED de pgTAP.

**Otros controles:** `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` del run 43141703429 concluyeron success. La unidad de CI registra 3775/3775 Vitest según bitácora; el job también ejecuta tests Node. El `e2e-preview` del SHA de código figuró en `error` porque el workflow fue explícitamente **BLOCKED / REQUIRES DEVELOP MIGRATION**, no porque los E2E corrieran y fallaran; se omitieron en ese SHA. Aplicación/validación posterior de la migración `migrate-develop` queda para después del merge y fuera de esta ronda.

**No ejecutados por la revisión:** clon/worktree local (resolución de red inaccesible), `git merge-tree` real, `pnpm typecheck/lint/test` propios, pgTAP propio, Docker/Supabase local (prohibidos por protocolo) y E2E contra preview. Se cotejaron evidencia y archivos por GitHub, no se falsificaron resultados. El único commit de la revisión modifica documentos; siguiendo la décima regla no se exigirá un nuevo CI GREEN solo por bitácora/documentación.

## 5. Próximo paso

Agy: ejecutar D02-A según instrucciones exactas del comentario único de cierre de esta ronda, sin tocar `docs/revision-pr/**`, aportar mutación RED real y GREEN en CI, commit y push. Después, ronda 2 independiente sobre el nuevo SHA de código.
