# Informe revisar-pr — CC-047 / T-408 — ronda 1 — 2026-11-07

**PR:** https://github.com/cadeApp/cadeApp/pull/657  
**SHA inspeccionado:** `f4878f8814f0002a758545d6e9617ae2da7299b7`  
**Base:** `develop@4e700aa2d5f3edb362446675a736903fbb55dd35`  
**Resultado:** **CON BLOQUEANTES (4)**. No aprobar, no mergear.

## Alcance y contexto

Se revisó el diff documental de `docs/contracts/CC-047.md` (nuevo) y `docs/tasks/T-408.md` (reconciliada), contrastado con la ficha original de `develop`, `docs/tasks/log/T-312.md` y el SQL/pgTAP existente. La PR es exclusivamente documental. El contrato cubre SEC-01, SEC-02, SEC-03, SEC-10 y SEC-11. La reconciliación es un cambio de alcance autorizado por el CC y debe reflejar sus pruebas y migraciones exactas.

**Comprobación del repositorio:** head y base coincidentes con PR; el comparador de GitHub mostró un commit por delante, cero por detrás, 2 archivos cambiados y PR mergeable según GitHub. No hubo clon Git local en este entorno ni ejecución de merge-tree; ese control queda pendiente. Se inspeccionaron comentarios (solo bot Vercel) y ausencia de review threads. No había carpeta de revisión previa en ese head.

**Checks:** `typecheck` **NO EJECUTADO**, `lint` **NO EJECUTADO**, `pnpm test` **NO EJECUTADO**, `test:db` **NO EJECUTADO**; no existe implementación SQL en este diff. CI no se usa para afirmar corrección mientras hay bloqueantes. **Hallazgos por inspección, no RED/GREEN ejecutados.**

## H01 · BLOQUEANTE · SEC-02 — La defensa de audit_log comprueba el rol incorrecto

- **Ubicación:** `docs/contracts/CC-047.md:68-70` y `:94-97`.
- **Origen:** agente; el contrato exige protección frente a cliente pero el mecanismo elegido no distingue el rol real.
- **Evidencia [ANÁLISIS]:** el CC define `app_private.audit_log_reject_client_change()` como `SECURITY DEFINER` y lo condiciona a `current_user IN ('anon','authenticated')`. PostgreSQL, al ejecutar una función SECURITY DEFINER, cambia `current_user` al propietario de esa función. En consecuencia, los UPDATE/DELETE/TRUNCATE directos no activarían la comprobación aunque el cliente fuera `authenticated`, si se repusieran grants/policies por error. Los revokes siguen aportando protección primaria; **el fallo es de la defensa adicional prometida**.
- **Arreglo contractual:** función de trigger `SECURITY INVOKER` con `SET search_path = public, pg_temp`, rol efectivo comprobado por `current_user`; mantener dos triggers (fila para UPDATE/DELETE y sentencia para TRUNCATE), revokes de tabla/secuencia y policy de SELECT exclusiva de admin con `aal2`. Registrar expresamente que la invocación de la función por triggers no necesita EXECUTE público; conservar `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` sobre la función. Confirmar por pgTAP que se rechaza aun con grant y policy de prueba permisivos, que service role conserva el mantenimiento E2E y que el `ON DELETE SET NULL` de `audit_log.actor_id` funciona. No usar un check de JWT para el trigger ni un SECURITY DEFINER que encubra al actor.
- **Prueba futura RED→GREEN (no ejecutada):** en transacción pgTAP, reponer de modo temporal GRANT UPDATE/DELETE/TRUNCATE y una policy permisiva para `authenticated`; con función invoker se obtienen `P0001/AUDIT_LOG_IMMUTABLE`. Mutar temporalmente el cuerpo para omitir la guarda o convertir a definer y demostrar fallo del caso; restaurar. No falsear errores con mocks.

## H02 · BLOQUEANTE · SEC-01 — Cambio de alcance rompe el contrato conductual CC-031

- **Ubicación:** `docs/contracts/CC-047.md:53-60` y `:170-196`; `docs/tasks/T-408.md`, «Archivos permitidos»/DoD.
- **Evidencia [ANÁLISIS]:** la eliminación de `profiles_update_admin` invalida las expectativas de `supabase/tests/cc031_courier_display_name_guard.sql:104-108,172-185`: admin `aal2` corrige directamente `display_name` de un repartidor y revoca `consent_status`. Además `supabase/tests/integration/cc031_profile_concurrency.mjs`, escenarios B/C, simula el UPDATE con sesión admin y bloqueo simultáneo del teléfono de repartidor. Ninguno figura en el alcance permitido de T-408; no basta cambiar expectations.
- **Decisión D1=A (Lautaro073):** reemplazar ambas operaciones por **RPC administrativas auditadas**, que exijan `app_private.assert_admin_aal2()`, adquieran `SELECT ... FOR UPDATE` sobre la fila de `public.profiles` con rol `courier` y conserven la serialización de CC-031. Diseño propuesto: `public.admin_correct_courier_display_name(p_courier_id uuid, p_display_name text)` y `public.admin_revoke_courier_consent(p_courier_id uuid)`, ambas `SECURITY DEFINER` con search_path fijo, grants mínimos, validación de actor/estado, UPDATE y un INSERT en `audit_log` atómicos. El segundo establece `consent_status = 'reconsent_required'`. Ajustar los dos controles CC-031 para pasar por RPC real sin perder el lock concurrente.
- **Cobertura:** agregar `supabase/tests/cc031_courier_display_name_guard.sql` y `supabase/tests/integration/cc031_profile_concurrency.mjs` a la ficha; exigir tests de ausencia de UPDATE directo admin `aal1/aal2`, autorización RPC, auditoría y carrera B/C RED→GREEN. Si el motor no conserva garantías de CC-031, el caso queda abierto, no se acepta un mock.
- **D3=B (Lautaro073):** no prohibir el autoservicio de una cuenta admin por defecto; **sí** afirmar por campo que las policies `*_self` y RPC de autoservicio no pueden cambiar `role`, `consent_status`, estados de repartidor, suscripciones ni settings privilegiados, con o sin MFA. Corregir la frase absoluta «admin solo con policies SELECT» para aclarar que se refiere a privilegios administrativos, no a políticas self compartidas.

## H03 · BLOQUEANTE · SEC-11 — Falta rpc_admin.sql en suites afectadas

- **Ubicación:** `docs/contracts/CC-047.md:178-190` y `docs/tasks/T-408.md`, «Archivos permitidos».
- **Evidencia [ANÁLISIS]:** `supabase/tests/rpc_admin.sql:420-452` ejecuta `admin_set_subscription(...,'Pago al día')` y comprueba que `merchants.notes` contiene esa nota tras una llamada posterior sin `p_notes`. Esa expectativa contradice el nuevo contrato de nota interna exclusivamente en `audit_log.after.notes` y va a quedar roja al implementar SEC-11.
- **Arreglo:** incorporar `supabase/tests/rpc_admin.sql` en el Impacto y en los archivos permitidos de T-408. Reemplazar solo la expectativa incompatible por: `merchants.notes` no cambia antes/después de ambas invocaciones; `audit_log.after.notes` registra exactamente la nota suministrada; llamada sin `p_notes` no altera `merchants.notes`. Mantener todas las aserciones de autorización, pago, suscripción y auditoría.
- **Prueba futura RED→GREEN (no ejecutada):** mutar la RPC para reintroducir `notes = p_notes` (o su `CASE` anterior), verificar que la nueva aserción falla y restaurar la versión correcta. Prohibido adulterar tests para que pasen.

## H04 · BLOQUEANTE · SEC-11 — Backfill automático carece de procedencia concluyente

- **Ubicación:** `docs/contracts/CC-047.md:81-85`, `:105-109`, `:136-141`, `:208-215` y `docs/tasks/T-408.md`, DoD SEC-11.
- **Evidencia [ANÁLISIS]:** la coincidencia literal entre `merchants.notes` y `audit_log.after.notes` no demuestra que el comercio no haya vuelto a escribir ese mismo texto. Además `audit_log.created_at` tiene default `now()`: eventos dentro de la misma transacción pueden empatar. Por tanto, un `UPDATE ... SET notes = null` guiado por esa comparación puede borrar información del comercio.
- **Decisión D2=B (Lautaro073):** **la migración NO UPDATE/DELETE `merchants.notes`.** El CC debe entregar una consulta **SELECT únicamente**, de candidatos cuyo `merchants.notes` coincide con la última nota de `admin_set_subscription` ordenada por `audit_log.id DESC` (desempate fiable); la consulta solo devuelve identificadores, IDs de auditoría, fecha y un indicador, nunca el contenido de las notas en resultados/logs. Lautaro073 la ejecuta manualmente **en cada ambiente**; cada candidato se resuelve antes de promover la migración siguiente. Si no hay candidatos, se registra cero candidatos. Jamás usar igualdad como prueba definitiva de autoría; el caso ambiguo no se limpia automáticamente.
- **Prueba futura (no ejecutada):** pgTAP con nota idéntica, distinta y reescrita por comercio; la migración no toca ninguno de los valores. Verificar orden por `id` y que el SELECT únicamente lista candidatos. Mutar el SQL temporalmente agregando borrado y confirmar que la prueba falla.

## Referencias «Actual» y suites pgTAP

- **Archivo:línea contrastados en `develop@4e700aa2`:** `20260922051650_rls_v1.sql:31,165,175,208,237,313,327,340,433,447,453,466,472,501`; `20261009200000_t340_multi_drop.sql:199,228,281,1476,1497`; `20261017090000_t369_publication_credits.sql:1589,1649`; `20260926003900_coordinates_and_distance_rpc.sql:18`; `20261019060000_cc032_request_cancellation_history_rpc.sql:45`; `src/features/merchants/queries.ts:99`, `components/onboarding-form.tsx:596`; `src/features/admin/actions.ts:208,217`; `src/server/e2e/staging-seed.ts:1403`. Las líneas consultadas corresponden a los símbolos citados; no se detectó error material de desplazamiento en esta muestra.
- **Incluidas y justificadas:** `rls_matrix`, `cc007_consent_enforcement`, `cc023_private_columns`, `cc032_request_cancellation_history`, `cc036_offers_rpc_only`, `rls_coordinates`, `rpc_distance`; condicionales `rpc_accept`, `t339_fixed_price`, `t369_publication_credits` y `structure`.
- **Omisiones que deben entrar:** `rpc_admin.sql` (expectativa de `merchants.notes`), `cc031_courier_display_name_guard.sql` y `integration/cc031_profile_concurrency.mjs` (contrato CC-031).
- **Control complementario, sin cambio de alcance automático:** `cc035_register_push_subscription.sql` contiene un actor admin `aal1` en una RPC de autoservicio y no necesariamente debe fallar por D3=B. La política self se mantiene y debe quedar explicitada en la matriz; no se le cambia el claim mecánicamente.
- El contrato de `accept_offer` sin rol admin (SEC-10), el `is_admin()` existente exigiendo `aal2` y la sustitución de `*_admin` por SELECT no se cuestionan en esta ronda, salvo las condiciones de arriba.
- **No atribuir a esta ronda** ejecución de SQL, mutaciones pgTAP, E2E o CI. La evidencia es por inspección del código y del contrato.

## Decisiones ya respondidas (2026-11-07, Lautaro073)

| Decisión | Resultado | Condición |
|---|---|---|
| D1 | A | RPC auditada aal2 para corregir display_name y revocar consentimiento; row lock compatible con CC-031 |
| D2 | B | Ningún borrado automático; SELECT de candidatos ejecutado manualmente por Lautaro073 en cada ambiente y resolución previa a promover |
| D3 | B | Permitir autoservicio de admin; probar que no llega a campos privilegiados ni evita RPC auditadas |

No quedan decisiones de este informe pendientes; sí quedan cambios técnicos que deberá implementar el autor y verificar otra ronda.

## NO TOCAR / falsos positivos descartados

- No introducir `is_admin_aal2()` nuevo: reutilizar `app_private.is_admin()` es consistente con el objetivo de cubrir policies y llamadas compartidas, siempre con pruebas.
- No añadir tabla `merchant_admin_notes`: D2 preserva el historial en `audit_log`, sin crear interfaz nueva.
- No devolver la capacidad de `accept_offer` a admin: el contrato ya la retira.
- No bloquear limpieza `service_role` de E2E, ni el `ON DELETE SET NULL` de `audit_log.actor_id`.
- No ampliar archivos distintos de los de la PR documental en esta ronda. Los archivos SQL y tests serán parte de T-408, después del merge del CC corregido.

## Verificación para ronda 2

1. Obtener nuevo SHA remoto y comparar con `develop`. Leer los comentarios y la bitácora.
2. Confirmar H01: `SECURITY INVOKER` y prueba con reinstalación temporal de grant/policy.
3. Confirmar H02: RPC para corrección y revocación con `FOR UPDATE`, registro de auditoría, y habilitación expresa de suite CC-031 e integración.
4. Confirmar H03: `rpc_admin.sql` permitido y DoD de nota separado.
5. Confirmar H04: **sin UPDATE de backfill**; SELECT de candidatos por `audit_log.id` y paso manual por ambiente.
6. Confirmar D3: autoservicio documentado y matriz de bypass por columna.
7. Ejecutar comprobaciones en un entorno limpio cuando exista clon disponible; CI y E2E de la futura T-408, no simulados en este CC.

## Metodología y límites

Revisión independiente de documentos y fuentes SQL del commit de `develop` mediante GitHub conectado. No hubo clon git ni PostgreSQL local, no se corrieron pruebas ni mutaciones SQL, y no se comprobó merge-tree real. Solo se consultó mergeabilidad del PR; no se modificaron contratos/producto ni se ejecutaron acciones remotas de Supabase/Vercel. Los comandos reproducibles están en `evidencia/comandos.md`.

**Estado final de ronda 1:** CON BLOQUEANTES (4), sin aprobación ni merge.
