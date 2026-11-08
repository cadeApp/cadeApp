# Informe de revisión — PR #658 / T-408 — Ronda 2

**Fecha:** 2026-11-08 · **Revisión independiente**  
**PR:** https://github.com/cadeApp/cadeApp/pull/658  
**SHA FUNCIONAL revisado:** `511940aaa6df0bde2075d7b6bd07bf0a47e5f50c`  
**Head antes del commit del revisor:** `e8a002a808a22fc95c310489f70db32f64afbf53`, exclusivamente bitácora posterior.  
**Base develop:** `fd86f9b2a25b39607e2719e76ad1821f84f44eef`. PR abierto, Draft, mergeable según API (no se pudo ejecutar `git merge-tree` sin clon local).  
**Resultado:** **CON BLOQUEANTES (1 NUEVO)**. H01–H06 de R1 corregidos y contrastados; nuevo H07 de cobertura de rate_limits.

## Verificaciones obligatorias de ronda

- Leídos desde `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y `docs/tasks/T-408.md`; contrato `docs/contracts/CC-047.md`.
- Se inspeccionaron los comentarios de #658 y última bitácora `docs/tasks/log/T-408.md`. Entre el commit propio de revisión `5f61c7fa` y la nueva cabeza solo cambiaron la migración, el pgTAP, `integration/cc031_profile_concurrency.mjs` y la bitácora. **Nadie del autor editó `docs/revision-pr/pr-658/**`. No hay desviación de archivos permitidos.
- `511940aa → e8a002a8` modifica únicamente `docs/tasks/log/T-408.md` (+22 líneas). No confundir documentación con SHA de código.
- Inspección independiente de los tres archivos; matriz de seis condiciones y seis mutaciones **estáticas propias** (alteraciones de pruebas/controles en memoria) contra `511940aa`: baseline 6/6 GREEN; seis mutaciones independientes detectadas 6/6 RED **estáticos**. Script completo, algoritmo y salidas en [evidencia/comandos.md](../evidencia/comandos.md).
- No se ejecutó un Postgres/Supabase propio ni `pnpm` local: el entorno de esta revisión no tiene clon Git accesible ni red Git; el GREEN de BD se verificó directamente en logs de CI del SHA exacto. Los rojos de #660–#662 los ejecutó **el autor** en PR aisladas; la revisión verificó los SHAs de mutación, sus diffs y los logs, sin atribuirse esas corridas.

## Verificación CI del SHA y de mutaciones, comprobada en logs

| Evidencia | SHA | Resultado |
|---|---|---|
| [GREEN 42443782479](https://github.com/cadeApp/cadeApp/actions/runs/42443782479), intento 1, PR #658 | `511940aaa6df0bde2075d7b6bd07bf0a47e5f50c` | `db-tests` success; `Files=44, Tests=3676, Result: PASS`, `cc047` 92/92; escenarios D y E GREEN por `audit_log.before`; tipos/diff, typecheck, lint, unit, build, audit, bundle PASS. Vitest `199/199` archivos, `3755/3755` tests |
| [PR #660](https://github.com/cadeApp/cadeApp/pull/660), [run 42443811683 intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42443811683) | `2cdf82d71fb289d3f924c3dffe8650951547eca7` | Mutante (cinco desvíos sobre la migración): `cc047 Failed 11/92` (2,40,47,51,54,71–74,84,86); `rpc_admin Failed 1/111` (50). Además `cc031` 11/49 como cascada del mutante de profiles. Código de los tests sin adulterar. PR CLOSED sin merge |
| [PR #661](https://github.com/cadeApp/cadeApp/pull/661), [run 42443817780](https://github.com/cadeApp/cadeApp/actions/runs/42443817780) | `bc1bfb0ca26b60dd3e0aec3ae8e6b1400cc0e462` | Solo retiró `FOR UPDATE` de `admin_correct_courier_display_name`; `cc047` y pgTAP completo PASS, **escenario D falla por `before.display_name`** (AssertionError, no timeout). PR CLOSED sin merge |
| [PR #662](https://github.com/cadeApp/cadeApp/pull/662), [run 42443823780 intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42443823780) | `bd8bada932044530e9951ff2781e4679298a3b6a` | Solo retiró `FOR UPDATE` de `admin_revoke_courier_consent`; pgTAP completo PASS, **escenario E falla por `before.consent_status`** (AssertionError). PR CLOSED sin merge |

Los rojos transitorios de suites cc026 y cc030 dentro del GREEN son mutaciones intencionales de su propio harness, restauradas después. El job `db-tests` concluyó **success**. Esta distinción importa: no confundir subtests mutantes internos con el estado final del job.

## Estado de los seis hallazgos de R1

| ID | Estado | Comprobación en SHA 511940aa |
|---|---|---|
| **H01** | **arreglado-verificado** (inspección independiente + CI) | `rate_limits_select_admin FOR SELECT ... USING(false)` en migración líneas 45–50; pgTAP líneas 121–134 verifica 0 filas admin `aal1`/`aal2`, fixture superusuario y `submit_offer`/contador. Mutación #660: test 2 rojo. |
| **H02** | **arreglado-verificado** | Nuevo pgTAP `pg_policies` `schemaname='public' AND cmd <> 'SELECT'` con `qual/with_check` y `is_admin()`, líneas 196–202. Mutación #660 recrea `drops_write_admin`; test 40 rojo. No se modificaron los triggers T-340. |
| **H03** | **arreglado-verificado** | `storage.objects` prueba SELECT, INSERT, UPDATE y DELETE por admin con estado íntegro como superusuario, líneas 309–330. Mutación #660 restauró `courier_docs_admin`: 71–74 rojos. |
| **H04** | **arreglado-verificado** | `integration/cc031_profile_concurrency.mjs` escenarios D/E con dos transacciones `admin/admin`, espera de lock y `audit_log.before` de S2. En GREEN ambos correctos. Mutaciones aisladas #661 y #662 demuestran RED específico por `before`, no timeout. |
| **H05** | **arreglado-verificado** | D3 `aal1`/`aal2` × `profiles.role` y `consent_status`, positivo propio `phone` en ambas AAL y `register_push_subscription` con propietario admin, líneas 371–393. Otras columnas ajenas cubiertas por matriz SEC-01. Mutación #660: tests 84 y 86 rojos. |
| **H06** | **arreglado-verificado**, con limitación explicitada | `admin_set_subscription` solo actualiza `subscription_status/paid_until`; auditoría conserva `p_notes`, líneas 244–262 de migración. pgTAP historias igual, distinta y reescrita, auditoría por `id DESC` y consulta de candidatos sin texto, líneas 212–266. Mutación #660 falla en distinta y reescrita. **Ausencia de limpieza pre-fixture demostrada por inspección del SQL, no por pgTAP**. |

**Interpretación de `arreglado-verificado`:** se ejecutaron controles estáticos independientes sobre el SHA revisado y se contrastaron explícitamente la ejecución en CI y los mutantes de otra persona. **No equivale a decir que el revisor levantó su propia base ni que ejecutó personalmente esas mutaciones de PostgreSQL**. El campo `verificado_metodo` de cada registro conserva esta diferencia.

## Nuevo hallazgo — PR658-H07 — MEDIO / BLOQUEANTE DE COBERTURA

**Archivo:** `supabase/tests/cc047_admin_hardening.sql:121-134, 170-172, 196-202`.  
**Causa:** P08, control incompleto de la clase «`public.rate_limits` solo para RPC `security definer`». La migración real está bien: tiene una sola policy `FOR SELECT ... USING (false)` y ninguna policy de escritura. Pero los controles se concentran en **admin `aal1`/`aal2` leyendo**, **admin borrando** y el catálogo de policies **que mencionan `is_admin()`**. No hay prueba de INSERT directo de un `authenticated` normal ni aserción de catálogo de que `rate_limits` carezca **de cualquier policy no-SELECT**.

**Mutación independiente de análisis (sin ejecutarse en DB):**
```sql
-- Sumar temporalmente a la migración, después de rate_limits_select_admin:
create policy rate_limits_insert_any on public.rate_limits
  for insert to authenticated with check (true);
```
El nuevo control de catálogo no la detecta porque no incluye `app_private.is_admin()` en `qual` ni en `with_check`. Los casos D01 de SELECT del admin sobre `subject='cc047'` siguen viendo 0 filas por la policy `USING(false)`; el DELETE directo de SEC-01 no cambia; el uso correcto de `submit_offer` no depende de negar un INSERT directo. En el SHA 511940aa se comprobó por **inspección ejecutada** que no hay ninguna llamada al helper `pg_temp.run` que intente `INSERT INTO public.rate_limits` como cliente; el único INSERT del pgTAP es el fixture **superusuario**. Por lo tanto, las aserciones existentes no ejercen ese bypass. **Esto NO es una afirmación de CI GREEN del mutante:** para confirmarlo a nivel runtime hace falta una PR de mutación REVIEW ONLY y su `db-tests`. Si no existiese privilegio SQL INSERT para `authenticated`, la policy mutante no bastaría por sí sola para explotar el bypass, pero el **contrato de ausencia de policies no-SELECT** seguiría incumplido. La disponibilidad del privilegio del esquema concreto también debe medirse, no suponerse por defaults de Supabase.

**Impacto:** un futuro restablecimiento accidental de una policy `INSERT ... WITH CHECK(true)` abriría la escritura de contadores por clientes si el grant lo permite. Las tablas de `rate_limits` participan en las RPC de límites por minuto. Se pide reforzar el control de regressión, **no cambiar la lógica productiva actual**.

**Arreglo acotado:**
1. En `supabase/tests/cc047_admin_hardening.sql`, sumar una aserción de catálogo `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='rate_limits' AND cmd <> 'SELECT'` = `0`. Esto prohíbe INSERT/UPDATE/DELETE/ALL directos independientemente de cómo se llame la policy o qué expresión use; respeta `rls_enabled.sql` al dejar la policy SELECT `false`.
2. Sumar INSERT directo como `authenticated` (repartidor `aal1` y admin `aal2`) con `pg_temp.run`, sin `ON CONFLICT` ni `RETURNING`, usando `subject/action` nuevos que no choquen. Exigir rechazo (código distinto de `00000`), más `count(*)=0` verificable como superusuario para cada fila. Opcionalmente medir explícitamente `has_table_privilege('authenticated','public.rate_limits','INSERT')` para entender si el rechazo depende de grants o de RLS. Para UPDATE/DELETE mantener la matriz existente y añadir pruebas por operación si el agente las considera necesarias; el control estructural impide cualquier policy que habilite estas operaciones.
3. Mutación RED: agregar exactamente la policy `rate_limits_insert_any` de arriba, **en PR aislada REVIEW ONLY / NEVER MERGE**. El caso de catálogo debe caer aunque falten grants; el INSERT directo debe caer si `authenticated` dispone de privilegio INSERT. Restaurar y mostrar GREEN del pgTAP completo. **No adulterar tests**.

**Severidad media:** defecto real de control preventivo, no vulnerabilidad abierta demostrada. Bloqueante porque el DoD de T-408 exige prueba de bypass por operación y conservación de la exclusividad de RPC para rate_limits.

## NO TOCAR / decisiones previas

- **D01=B, D02=A**: decisiones ya tomadas, no reabrirlas.
- Los triggers de T-340 son una protección legítima y su papel está documentado. No cambiarlos ni tocar `cc043`/`cc025`/`cc033`.
- No borrar ni modificar `merchants.notes` automáticamente: la inspección no demuestra autoría de notas antiguas. Es correcto dejar ese paso humano.
- No ampliar el hallazgo H07 a una prohibición de TODAS las policies de escritura de `public`: otras tablas necesitan policies de autoservicio. La regla nueva es **únicamente para `rate_limits`**.
- El `e2e-preview` de PR con migración sigue legítimamente `BLOCKED / REQUIRES DEVELOP MIGRATION`. `docs/runbooks/e2e-preview.md:153` indica que no hay E2E post-merge automático en Develop; la validación E2E admin `aal2` en staging y la revisión manual de notas por ambiente siguen siendo gates antes de promoción.

## Acciones de continuación

- Agy implementa solo H07 como test, sin editar migración productiva, ficha, workflow ni revisión; RED de mutación aislada y GREEN del SHA nuevo; bitácora exacta con resultados. La ronda 3 independiente inspecciona y cierra H07.
- **Lautaro073 — manual antes de promover cada ambiente:** ejecutar la consulta de candidatos de `CC-047 `6` y resolver cada coincidencia antes de promover, registrando ambiente, fecha, SHA de migración, cantidad y resolución de merchant_id **sin incluir texto de notas**. No ejecutada por el revisor.
- **Lautaro073 / operación — después de merge:** migración Develop, verificación de tipos y E2E del panel admin `aal2` en staging antes de producción. Este informe **no autoriza merge**.

## Checklist

- [x] Contrato y ficha `develop`, PR, bitácora, SHAs y scope.
- [x] GREEN y mutaciones del autor corroborados por SHA/diff/log.
- [x] Independiente: seis controles estáticos de H01–H06, seis mutaciones propias de esos controles, y mutación H07 de política no cubierta (análisis).
- [ ] H07: pgTAP structural/INSERT + mutación runtime RED/ GREEN, pendiente del agy y de ronda 3.
- [ ] Acción humana de notas por ambiente, sin datos sensibles.
- [ ] E2E admin `aal2` después de la migración; no fingir GREEN pre-merge.
