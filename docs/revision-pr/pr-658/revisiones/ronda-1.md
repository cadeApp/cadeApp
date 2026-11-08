# Informe de revisión — PR #658 / T-408 / CC-047 — Ronda 1

**Revisor:** revisión independiente · **Fecha:** 2026-11-08  
**PR:** https://github.com/cadeApp/cadeApp/pull/658  
**SHA funcional revisado:** `3a396ee1258b39c6c6e111f157399fccdb8ae42f`  
**Head de la PR previo al commit de esta revisión:** `1f0cbc4d3678aa158f92f7822558ae46e0499751` (solo bitácora; compare 1 archivo)  
**Base:** `develop` / `fd86f9b2a25b39607e2719e76ad1821f84f44eef`  
**Resultado:** **CON BLOQUEANTES (6)**; no aprobar ni mergear. D01=B y D02=A resueltas por Lautaro073 antes del cierre.

## Alcance y comprobaciones

- Leídos desde `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-408.md` y `docs/contracts/CC-047.md` (CC mergeado en #657).
- Revisados los 18 archivos del diff, comentarios y bitácora; contraste mecánico de la ficha: solo tres rutas añadidas a «Archivos permitidos» (cc043 y concurrencias cc025/cc033), **autorizadas D02=A**; no se detectó otro cambio de alcance.
- Comparación de las RPC redefinidas frente a su última migración pre-CC: `accept_offer` pierde rol admin y bypass de dueño; `admin_set_subscription` deja de escribir `merchants.notes`. No se halló otra modificación funcional de esas dos RPC.
- Lectura del trigger de T-340 confirma que para un cliente `lock_draft_request_for_child_write` exige comercio dueño y solicitud `draft` (migración `20261009200000_t340_multi_drop.sql` líneas 71-132). Por eso los casos 13–16 del RED son **verdes aun sin migración** y no certifican ausencia de policy administrativa.
- El contrato especifica `admin_correct_courier_display_name` y `admin_revoke_courier_consent` con `assert_admin_aal2`, `SECURITY DEFINER`, `search_path`, `FOR UPDATE` y auditoría; las definiciones observadas cumplen por lectura. Los scripts de concurrencia B/C invocan las RPC reales.
- `courier_docs_admin` se elimina y la policy de inserción del propio repartidor exige `app_private.is_courier()` y carpeta propia; no hay indicio por inspección de bypass real admin en Storage.
- No se encontró edición de `docs/revision-pr/pr-658/` por el autor antes de esta ronda. La API reportó PR mergeable, pero **no se ejecutó `git merge-tree`** porque el entorno de revisión no disponía de clon Git local con red.
- Sin Supabase/Docker local, sin peticiones a bases remotas, sin operaciones sobre secretos. **No se corrió una batería pgTAP propia**: se inspeccionaron los logs originales de CI y se ejecutaron controles estáticos de contenido en memoria del SHA. `pnpm typecheck/lint/test` locales no corridos por el revisor.

## CI: evidencia corroborada, no solo badges

| Caso | SHA / run | Resultado verificado |
|---|---|---|
| RED sin migración | `908fa32d` / [42438514865](https://github.com/cadeApp/cadeApp/actions/runs/42438514865) | `cc047` 48/66 rojos; 13–16 verdes; pgTAP 44 archivos / 3648 pruebas, FAIL |
| GREEN | `3a396ee1` / [42439999763](https://github.com/cadeApp/cadeApp/actions/runs/42439999763) | `db-tests`: 44 archivos / 3651 pruebas, PASS. Vitest: 199 archivos / 3755 pruebas, PASS. typecheck, lint, build, audit, bundle PASS |
| Mutaciones **del autor** (#659) | `0d881d08` / [42440751262](https://github.com/cadeApp/cadeApp/actions/runs/42440751262) | `cc047` 18/67 rojos; `rpc_admin` 1/111 rojo. Seis mutaciones agrupadas; no acreditan aisladamente cada falla. |
| Revisión propia **estática** | `3a396ee1` por lectura GitHub + harness JS | Original GREEN; restaurar `drops_write_admin`, quitar `FOR UPDATE` de la RPC de revocación, insertar UPDATE destructivo de `merchants.notes` y omitir el DROP de Storage → 4/4 RED estáticos. NO equivale a pgTAP ni a mutaciones de DB. |

`e2e-preview` quedó `BLOCKED / REQUIRES DEVELOP MIGRATION` de acuerdo con `docs/runbooks/e2e-preview.md`. No es fallo del código. El runbook no implementa E2E post-merge automático en Develop (línea 153); después del merge, migrar Develop y validar E2E del panel admin en staging antes de promover. Mantener este gate pendiente, sin marcarlo verificado.

## Hallazgos bloqueantes

### PR658-H01 · D01=B: denegar SELECT en rate_limits (MEDIO)

**Archivo:** `supabase/migrations/20261108020000_cc047_admin_hardening.sql:45-50`  
**Diagnóstico [ANÁLISIS]:** `rate_limits_select_admin` actualmente tiene `USING (app_private.is_admin())`, lo que permite al admin `aal2` consultar sujetos, acciones, ventanas y contadores. El CC sugería solo quitar la policy; el test transversal `rls_enabled.sql` exige al menos una. Lautaro073 eligió explícitamente **D01=B**, sin excepcionar el test transversal.

**Arreglo:** mantener una sola policy `FOR SELECT TO authenticated USING (false)` (mismo nombre), sin policy de escritura. En `cc047_admin_hardening.sql`: verificar con fixture presente que admin `aal1` y `aal2` reciben **cero filas** y que una RPC real `SECURITY DEFINER` que manipula `rate_limits` (p. ej. `submit_offer` con un segundo request publicado válido) funciona y modifica el contador observable como superusuario. `rpc_offers.sql` ya contiene casos positivos y límite de `submit_offer`: conservarlos.

**RED/VERDE exigido:** mutar temporalmente la policy a `USING (app_private.is_admin())`, verificar rojo del caso `aal2`; restaurar `false`, ejecutar `db-tests` y confirmar verde. No falsear expectativas, datos ni mocks.

### PR658-H02 · P08: una policy administrativa puede volver sin disparar casos 13–16 (ALTO)

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:115-155`  
**Diagnóstico [ANÁLISIS + CI RED del autor]:** la ausencia de cambio observada por estos casos se debe al trigger T-340, no a la eliminación de `drops_write_admin` ni `drop_contacts_write_admin`. Las cuatro pruebas 13–16 pasaron **antes** de aplicar CC-047 y pueden continuar verdes con policy administrativa reinstalada.

**Arreglo:** **preservar** los cuatro tests funcionales y añadir control de catálogo separado en pgTAP. Sobre `pg_policies` filtrado a `schemaname='public'`, contar policies cuyo `cmd <> 'SELECT'` y `qual` o `with_check` refieran `app_private.is_admin()`. Exigir conteo **0**, incluyendo `FOR ALL`. No usar solo nombres `*_admin`: la clase incluye cualquier policy, aunque se renombre. Usar una consulta estructural real de catálogo, no strings de tests ni salteos.

**RED/VERDE exigido:** crear temporalmente `drops_write_admin` `FOR ALL TO authenticated USING (app_private.is_admin()) WITH CHECK (app_private.is_admin())` en esquema efímero del CI o PR aislada REVIEW ONLY; el nuevo caso de catálogo debe ser ROJO, mientras 13–16 pueden seguir verdes por diseño; al restaurar GREEN. No desactivar `trg_lock_draft_drops`, `trg_lock_draft_drop_contacts` ni sus guards para fabricar fallas.

### PR658-H03 · SEC-03: pruebas de escritura Storage incompletas (ALTO)

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:254-257`  
**Diagnóstico [ANÁLISIS]:** solo hay `SELECT` de `storage.objects` bajo admin `aal2`; CC-047 exige también demostrar la imposibilidad de INSERT/UPDATE/DELETE directo de `courier-docs`.

**Arreglo:** usando los helpers reales `pg_temp.run` y un objeto del bucket sembrado y comprobado previamente como superusuario, intentar INSERT en carpeta ajena, UPDATE del nombre/metadata del objeto y DELETE del objeto con admin `aal2` (cuando sea relevante, también `aal1`). Aceptar error explícito o 0 filas, **siempre** afirmar después desde superusuario que no se insertó ni cambió/borró nada y que el objeto previo existía. No alterar la policy de inserción propia del repartidor.

**RED/VERDE exigido:** reintroducir temporalmente la policy `courier_docs_admin` del esquema anterior en PR aislada de DB (nunca en la tarea), registrar al menos una nueva prueba de escritura ROJA y luego GREEN sin policy. No aplicar mutación peligrosa a un Preview público.

### PR658-H04 · D1: el FOR UPDATE correcto no tiene prueba funcional que falle al quitarlo (ALTO)

**Archivo:** `supabase/tests/integration/cc031_profile_concurrency.mjs:240-342` y `supabase/tests/cc047_admin_hardening.sql:263-296`  
**Diagnóstico [ANÁLISIS]:** B/C prueban el UPDATE y el bloqueo con courier, pero la RPC también obtiene lock por el UPDATE posterior: una mutación `FOR UPDATE → FOR SHARE` / omisión del lock previo puede conservar B/C verdes. El autor declara que no mutó `FOR UPDATE`.

**Arreglo:** sumar al script de concurrencia una carrera real **admin/admin sobre el mismo courier**, para ambas RPC si es posible: S1 corrige nombre (o revoca consentimiento) dentro de transacción abierta; S2 invoca la misma RPC con el mismo courier; verificar bloqueo observable con `pg_stat_activity`/`pg_blocking_pids`, hacer commit de S1, terminar S2, y afirmar `audit_log.before` de S2 igual al valor realmente confirmado por S1 (y `after` correcto) más estado final. El contrato exige auditoría atómica con `before` coherente; sin lock sobre el SELECT, S2 puede leer el valor antiguo antes de bloquearse en UPDATE. Mantener B/C y testear ambos caminos. No sleeps, no mocks que eviten SQL.

**RED/VERDE exigido:** mutar **solo** el `FOR UPDATE` de cada RPC de D1 a `FOR SHARE` o eliminarlo en CI de mutación aislado; la aserción de auditoría/concurrencia debe dar RED por valor equivocado, no solo por timeout; GREEN al restaurar. Un check estático por `pg_get_functiondef` sirve solo como complemento, no como sustituto de una carrera real.

### PR658-H05 · D3: enumeración incompleta (MEDIO)

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:298-309`  
**Diagnóstico [ANÁLISIS]:** el caso 66 mezcla `aal1`/`aal2` en un `AND` y no prueba `profiles.consent_status` propio con `aal1`. Falta cobertura explícita por nivel MFA y por cada columna privilegiada; el único positivo local es teléfono propio en `aal1`. La suite `cc035_register_push_subscription.sql` sí cubre una suscripción push de admin, pero no debe sustituir la matriz requerida de este CC.

**Arreglo:** añadir filas/casos separados para admin `aal1` y `aal2` × `profiles.role` propio y `profiles.consent_status` propio, más negativas por `couriers.status`, `merchants.subscription_status`, `platform_settings.value` y contactos ajenos (usando fixtures existentes y validación posterior desde superusuario). Positivos diferenciados de campo propio no privilegiado y push propia o `register_push_subscription` con aserción de propietario, manteniendo intacto CC-035. No contar como aprobado un UPDATE de cero filas si no existía el fixture.

**RED/VERDE exigido:** mutar temporalmente `profiles_update_self` para permitir cambiar `consent_status` propio manteniendo rol admin y comprobar caso `aal1` rojo; volver al esquema correcto para GREEN. La mutación debe ir aislada y revertirse sin tocar la rama de la tarea.

### PR658-H06 · SEC-11 / D2: tres historias de notas, y backfill como revisión de SQL (MEDIO)

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:183-210` y migración `:190-273`  
**Diagnóstico [ANÁLISIS]:** caso 37–39 prueba nota distinta en una llamada; 40–41 simulan coincidencia **después** de aplicar la migración. La suite no alcanza a probar limpieza ejecutada **antes del fixture**, por construcción temporal. La inspección de la migración actual no encontró UPDATE de `merchants.notes`.

**Arreglo:** tres escenarios explícitos sobre `admin_set_subscription`: (1) `merchants.notes` coincide previamente con `p_notes`, (2) difiere, (3) comercio la reescribe y después admin invoca de nuevo RPC; en todos, `merchants.notes` queda idéntica al valor anterior y `audit_log.after.notes` contiene el `p_notes` de esa llamada, ordenada por `audit_log.id`. Para D2 verificar candidato según la **última** auditoría, candidato distinto excluido y sin exponer texto de notas. Mantener inspección de la migración por el revisor como garantía separada de no-backfill: **no solicitar una supuesta mutación pgTAP que no puede verse**. Se admite el control estático independiente M-R3, identificado como estático, no como DB.

**RED/VERDE exigido:** restaurar temporalmente en `admin_set_subscription` la asignación `notes = case when p_notes ...`; cada escenario que corresponde debe dar rojo y volver a verde tras restaurar. No tocar datos anteriores ni limpiar por inferencia.

## NO TOCAR — decisiones y falsos positivos descartados

| Punto | Motivo |
|---|---|
| D02=A: `cc043`, `integration/cc025` y `cc033` | Aprobados por P1; las expectativas originales dependían de una policy admin que CC-047 elimina. Conservar los tests y su semántica. |
| `lock_draft_request_for_child_write` | Es protección adicional válida; no quitarla para fabricar RED de policies. |
| `accept_offer` sin admin | Comparada con su versión anterior, el cambio de actor y dueño coincide con el contrato; `rpc_offers` cubre camino comercio. |
| `audit_log` `security invoker` | Es necesario porque el trigger consulta `current_user`; logs del autor incluyen pruebas con grants/policies restituidos. |
| `merchants.notes` sin backfill | D2=B exige cero limpieza automática, más revisión humana por ambiente, no un pgTAP imposible. |
| `e2e-preview` bloqueado | Es estado esperado para PR con migración; gate real posterior. |
| Mutaciones agrupadas #659 | Son evidencia del autor; nunca reportarlas como mutaciones independientes propias ni asumir que cubren locks/borrado histórico. |

## Condiciones para ronda 2 y acciones humanas

1. Agente implementa H01–H06 **solo** en archivos acotados del prompt en el comentario de la PR; prueba control base GREEN y mutaciones en RED sin adulterar pruebas. Actualiza `docs/tasks/log/T-408.md` (hecho/pruebas/falta; nunca «verificado») y hace commit/push normal.
2. La revisión independiente vuelve a inspeccionar todas las clases (RLS, RPC, Storage, concurrencia, notas), reejecuta mutaciones nuevas, verifica comentarios y commits. El `verificado_en_sha` sigue `null` hasta esa ronda.
3. **Acción exclusivamente humana, antes de promover cada ambiente:** Lautaro073 ejecuta en su ambiente la consulta de CC-047 `6`, registra ambiente/fecha/SHA/cantidad/decisión por `merchant_id` sin texto sensible; no promueve con candidatos pendientes. No ejecutar esa consulta desde el agente ni guardar resultados con texto de notas.
4. **Tras merge, no antes:** la migración se aplica a Develop por `migrate-develop`; verificar drift de tipos. Como el runbook no tiene E2E post-merge automático en Develop, validar panel admin con `aal2` en el gate de staging y bloquear promoción si falla. No es autorización de merge.

**Nota de límites:** no hubo checkout Git local del repo ni base local en este entorno. Los cuatro rojos propios son sobre lectura de fuente y checks estáticos, no pruebas PostgreSQL. Ver [evidencia/comandos.md](../evidencia/comandos.md).