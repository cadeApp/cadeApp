# Revisión independiente — PR #686 / T-430 / CC-048

**Fecha:** 2026-11-11. **Resultado:** CON BLOQUEANTES (2). **Revisor:** ChatGPT (revisión independiente).
**Head revisado:** `0ed66974fc931d5819d707665671924192dcea05`.
**Base:** `develop@f33acf8a2a03e5c54f7da3fe6926464cc1dcbe10`.

## Método y límites

Se leyó la documentación de revisión, la skill, `AGENTS.md`, ficha base T-409, cuatro archivos modificados, migraciones y pruebas relevantes por el conector GitHub sobre SHAs inmutables. No hay clon local ni Supabase/Docker accesible en esta sesión; no se ejecutaron pgTAP, CI, typecheck, lint ni tests del repositorio. El resultado de `pnpm exec vitest run tools` (10 archivos/123 tests) es **declaración del autor**, no verificación independiente. El contraste documental independiente, ejecutado **en memoria** con contenido de GitHub, pasó y detectó cinco mutaciones documentales (M1–M5); ver [comandos](../evidencia/comandos.md). El riesgo multisesión H01 es **análisis, no reproducción**.

## Verificación de «Actual» contra develop@f33acf8a

- **Correcto:** `supabase/migrations/20261009200000_t340_multi_drop.sql:288-310` define `delivery_requests_update_merchant` con `USING (merchant_id = auth.uid())`, sin estado. Conserva la comprobación `app_private.is_active_operational_actor()` en `WITH CHECK` (línea 293) y el congelamiento de columnas de ciclo y, fuera de `draft`, `fixed_price_ars` y `auto_assign`.
- **Correcto:** `supabase/migrations/20261015084902_cc026_reconcile_expired_requests.sql:178-192` concede UPDATE por las mismas doce columnas enumeradas en CC-048 y el DoD.
- **Correcto:** `supabase/migrations/20260922051650_rls_v1.sql:331-338` define `contacts_insert_merchant` y `contacts_update_merchant` sin validar el estado de la solicitud; las líneas del CC son correctas.
- **Correcto:** `supabase/migrations/20261108020000_cc047_admin_hardening.sql:29-32` quita las policies de escritura admin, incluyendo `delivery_requests_update_admin` y `contacts_write_admin`. El modelo de dos capas de permisos/roles se mantiene.
- **Correcto:** `supabase/migrations/20261009200000_t340_multi_drop.sql:52-65,164-277` ya limita las tablas de drops y drop_contacts en `draft` y restringe grants.
- **No afirmado como verificado en runtime:** si `anon` o `authenticated` poseen efectivamente `TRUNCATE` antes de la migración. CC-048 lo condiciona correctamente a `has_table_privilege` en RED; la inspección de fuentes no sustituye una consulta a PostgreSQL.

## Alcance y reconciliación

Los 4 archivos modificados están incluidos en «Archivos permitidos» de la ficha propuesta: `docs/contracts/CC-048.md`; `docs/implementation-plan.md`; `docs/tasks/T-430.md`; `docs/tasks/log/T-430.md`. T-430 **no existe en la base**; es ficha nueva y no se trató como cambio a una ficha previa. La modificación de T-409 se limita a la celda DoD de la fila en `docs/implementation-plan.md:436` y reproduce literalmente el primer DoD de `docs/tasks/T-409.md` de la base; T-430 es fila `:457` y coincide con el primer DoD de su ficha.

Comparación «Impacto exacto en la tarea» de CC-048 con ficha: migración, `cc048_merchant_draft_only.sql`, `rls_matrix.sql`, posibles ajustes en `cc019_aguilares_service_area.sql`, `structure.sql` y `rpc_requests.sql` están presentes en «Archivos permitidos»; el DoD enumera las 12 columnas y matrices `published`/`matched`, borrador positivo, contactos, `request_id`, grants, suites del ciclo y RED→GREEN. **Falta una suite multisesión** para la promesa de concurrencia (H01) y una aserción no vacía del caso H07 (H02).

## BLOQUEANTES

### PR686-H01 · Falta serializar escrituras de `delivery_request_contacts` contra publicar

**Ubicación:** `docs/contracts/CC-048.md:51-55,83-86` y `docs/tasks/T-430.md:29,66-83`. **Severidad:** alto. **Evidencia:** [ANÁLISIS, no pgTAP ejecutado].

La policy `EXISTS (select ... delivery_requests ... status='draft')` consulta otra tabla sin tomar un lock de la fila padre. En `READ COMMITTED`, una operación concurrente puede empezar sobre un borrador, bloquearse por la fila contacto y terminar después de una publicación: la comprobación del estado sobre el padre no queda serializada por la mera lectura de RLS. La sección `Concurrencia` dice «No aplica» y no pide un test de esa intercalación.

**Contraste:** `supabase/migrations/20261009200000_t340_multi_drop.sql:71-132` incluye el helper `app_private.lock_draft_request_for_child_write` y triggers para `delivery_request_drops` y `delivery_request_drop_contacts`, **no para `delivery_request_contacts`**. Las RPC adquieren lock de `delivery_requests` en `t340_multi_drop.sql:643` y consultan contactos, entre otros lugares, en `:727` y `:794`. El runner `supabase/tests/integration/t340_concurrency.mjs` ya tiene escenarios de dos sesiones y se ejecuta en `.github/workflows/ci.yml:197-200,251-262`.

**Arreglo contractual concreto:** en `§Propuesto` añadir una quinta parte: en la migración nueva, `CREATE OR REPLACE` del helper existente con una rama adicional para `TG_TABLE_NAME = 'delivery_request_contacts'` obteniendo `NEW.request_id` (insert/update), preservando su `SECURITY INVOKER`, guard de `current_user` y `SELECT ... FOR UPDATE` del padre; añadir un trigger `BEFORE INSERT OR UPDATE` en contactos legacy. No editar la migración histórica T-340. Documentar secuencia y bloqueo, incluidos deadlocks/regresión. Añadir `supabase/tests/integration/t340_concurrency.mjs` a «Impacto exacto», ficha y fila T-430 del plan. Exigir escenarios multisesión en ambos órdenes: edit→publicar conserva la edición previa; publicar→editar termina sin cambio posterior a la publicación. También asegurar que las RPC `SECURITY DEFINER` siguen funcionando y que no hay `40P01`.

**RED→GREEN futuro:** extender el harness multisesión sin sleeps y con sincronización por locks. Mutación aislada: quitar solo el trigger de contactos legacy de una copia temporal de la migración y demostrar que la prueba rechaza esa pérdida; restaurar migración correcta y GREEN. En esta ronda no se ejecutó.

### PR686-H02 · H07 prueba ausencia de excepción, no update real

**Ubicación:** `docs/contracts/CC-048.md:139-143` y `docs/tasks/T-430.md:77-79`. **Severidad:** medio. **Evidencia:** [ANÁLISIS].

`supabase/tests/rls_matrix.sql:282-287` usa `lives_ok('update ... where id = req_m1_pub_id()')`. Una sentencia UPDATE que afecta cero filas no falla, por lo que ese caso puede quedar verde incluso si una migración rompe el UPDATE legítimo. La ficha exige trasladarlo a borrador y preservar la aserción de `set_updated_at`, pero no define una comprobación del efecto.

**Arreglo contractual:** describir un borrador propio separado (la fixture de H07 actualmente es `published`), fijar su `updated_at` inicial a un valor anterior, ejecutar UPDATE de `notes` como `authenticated` y comprobar exactamente una fila, persistencia del nuevo `notes` y `updated_at` posterior al valor semilla. Agregar una prueba aparte de `published` que demuestre 0 filas y valor igual. Respetar los valores previos de las demás pruebas que usan la fixture publicada.

**RED→GREEN futuro:** mutación 1: cambiar solo el `WHERE id` positivo a un UUID inexistente; la aserción de fila modificada debe fallar. Mutación 2: deshabilitar temporalmente el trigger `delivery_requests_set_updated_at` en una copia efímera para demostrar rojo en el timestamp. Restaurar y verificar verde.

## MEJORAS

- **M01:** `docs/tasks/T-430.md:73-76`: separar explícitamente `INSERT` fuera de `draft` (violación de `WITH CHECK` → SQLSTATE `42501`) de `UPDATE` fuera de `draft` (`USING` filtra la fila → 0 filas, valor inalterado). «Rechazados» sin modalidad puede inducir un falso test con `throws_ok` para UPDATE.
- **M02:** `docs/implementation-plan.md:457`: su descripción de archivos solo menciona «fila T-430», mientras la ficha permite además sincronizar «fila T-409». Opcionalmente aclarar ese alcance puntual, sin abrir cambios a otras filas.

## NO TOCAR — riesgos descartados

- No quitar permisos de `service_role`: seed E2E usa `admin` y cron su cliente autorizado; los revokes del contrato apuntan a `anon, authenticated`.
- No mover toda la edición de borradores a RPC: D1=A fue la decisión registrada; el flujo de borradores se conserva.
- No cambiar RPC, tipos generados ni contratos de dominio solo por políticas o grants.
- No atribuir a `cc019_aguilares_service_area.sql` un fallo de permisos: su helper `pg_temp.try_dml` indica expresamente que ejecuta DML como `postgres`.
- No eliminar la corrección de T-409: la celda nueva coincide exactamente con su ficha en base.

## Checks y dudas

- **Ejecutado:** contraste documental por GitHub (GREEN) + cinco controles mutados que dieron RED, en memoria.
- **No ejecutado:** `pnpm exec vitest run tools`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, E2E, job db-tests. El GREEN declarado en el cuerpo de la PR no se atribuye a esta revisión.
- **Duda técnica pendiente del futuro test:** confirmar en PostgreSQL la intercalación de la carrera H01 y que el trigger propuesto conserve el orden de locks sin deadlock. Es un riesgo fundamentado por inspección, no un bypass reproducido en este entorno.
- **Duda runtime:** grants efectivos previos de `TRUNCATE`, `REFERENCES` y `TRIGGER`; medirlos en la prueba RED en vez de deducirlos de migraciones.

## Cierre

No aprobar ni mergear. El siguiente commit del autor debe modificar solo el contrato, ficha, plan si hace falta y bitácora, manteniendo esta carpeta exclusiva de la revisión. Repetir revisión independiente sobre el nuevo SHA.

