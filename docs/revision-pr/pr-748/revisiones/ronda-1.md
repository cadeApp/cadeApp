# Informe de revisión independiente — PR #748 / T-438 / CC-053 — Ronda 1

**Fecha:** 2026-11-15 (America/Argentina/Tucuman)  
**PR:** https://github.com/cadeApp/cadeApp/pull/748  
**Base:** `develop` @ `4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a`  
**HEAD revisado:** `93b34c056d039e0ec66785fb5d82221e5f566898`  
**Resultado:** **CON BLOQUEANTES (8)** · MEJORAS: 1 · Decisión D3-C **ratificada**, pendiente de plasmar en documentos.

## 1. Alcance, método y resultado

La PR tiene exactamente cuatro cambios: `docs/contracts/CC-053.md` nuevo (226 líneas), `docs/tasks/T-438.md` nueva (135 líneas), una fila en `docs/implementation-plan.md` y `docs/master-plan.md` `6.3 (+5/-1). `docs/tasks/T-438.md` **no existe en develop**: corresponde alta de ficha, no modificación de una ficha preexistente. Las cuatro rutas son documentales y compatibles con el trámite de contract-change. No hay SQL de implementación, código ni tests modificados.

Se leyeron antes del diff `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`; se aplicó la excepción vigente: los entregables de revisión van en la rama de la PR, solo en `docs/revision-pr/pr-748/`. Se consultó `.agents/skills/contract-change/SKILL.md`, `AGENTS.md` y CC-032. Comentarios al inspeccionar: solo bot de Vercel, sin respuesta correctiva del autor. No existe `docs/tasks/log/T-438.md` en `develop` ni venía entre los 4 cambios del PR; por ser CC documental, se pide bitácora del arreglo, sin confundirlo con ejecución de T-438. No había carpeta `pr-748` previa en el HEAD revisado.

La PR es un commit delante de la base (ahead=1, behind=0); metadata GitHub `mergeable=true`. No se pudo ejecutar `git merge-tree --write-tree`, por lo que no se atribuye verificación local de conflictos. CI `43660925817` = **cancelled**; se admite porque esta PR solo cambia documentación; no se presenta como green ni se exige re-ejecutarlo solamente por la ronda.

La comparación de afirmaciones de «Actual» y el barrido de las ocho funciones se documentan en `evidencia/comandos.md`. **El diseño de lock inicial tiene una explicación válida**: `admin_suspend_courier` bloquea `couriers` y luego actualiza `offers`; `accept_offer` bloquea `delivery_requests`, `offers` y luego `couriers`; el ciclo de espera es posible. Esto es un **riesgo de deadlock demostrado por orden estático**, no un `40P01` reproducido ejecutando PostgreSQL. El orden `couriers → delivery_requests → drops → offers` resuelve esa inversión concreta si se aplica de forma completa; no certifica ausencia de todos los ciclos con otras RPC.

## 2. Hallazgos (prioridad y evidencia)

### PR748-H01 — BLOQUEANTE · Decisión incorrecta en admin_resolve_incident

- **Archivo:** `docs/contracts/CC-053.md:5,21,61,138`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** se escribe `admin_resolve_incident(suspend_courier)`. El código real de `supabase/migrations/20260927120000_cc012_incidents_contract.sql:186-190,208` admite `'preventive_suspension'` y las otras decisiones `no_action`/`warning`, **no** `suspend_courier`. `src/server/rpc/admin.ts:435-438` también consume `preventive_suspension` para la purga post-éxito.
- **Arreglo:** corregir todas las apariciones del nombre de decisión, incluyendo «Actual», «Propuesto», tabla de locks, escenario de concurrencia y pgTAP/DoD de la ficha. No renombrar la RPC existente ni crear un alias inventado.
- **Control:** `rg -n 'suspend_courier|preventive_suspension' docs/contracts/CC-053.md docs/tasks/T-438.md` + contraste con SQL real; el símbolo `admin_suspend_courier` **sí existe** y no se reemplaza.

### PR748-H02 — BLOQUEANTE · La ampliación del historial omite el contrato SQL y aislamiento existentes

- **Archivo:** `docs/contracts/CC-053.md:102-111,201-204`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** `get_request_cancellation_history` hoy solo filtra `rcr.action = 'courier_cancel_match'` en `supabase/migrations/20261019060000_cc032_request_cancellation_history_rpc.sql:63-75`; primero valida pertenencia al pedido, para repartidores exige cancelación propia y después pagina sobre los eventos filtrados. Agregar un segundo tipo requiere rediseñar **filtro, clasificación por acción, proyección, keyset (limit+1 después del filtro), guardas por rol y fallback**. Decir «devuelve también» no define esas ramas con precisión, y el DoD deja fuera la regresión de paginación/aislamiento entre repartidores.
- **Arreglo:** añadir matriz explícita `merchant dueño/admin/courier participante/courier tercero/anon/consentimiento inactivo`, con acciones visibles y campos por rol; preservar `NOT_FOUND` cuando no pertenece y `rawReason=null` fuera de admin para cancelaciones ordinarias; exponer el nuevo evento **únicamente a dueño y admin**. D3-C exige que el evento **público** se llame `assignment_unavailable`, sin exponer `courier_suspended` ni el motivo administrativo. Si se mantiene una acción interna administrativa en la tabla protegida, documentar expresamente la traducción al payload público. Registrar contrato de paginación y pruebas SQL `cc032_request_cancellation_history.sql`.
- **Control:** pgTAP de mixed events, paginación y aislamiento, incluyendo un repartidor que canceló previamente y no recibe los eventos de suspensión aunque tenga acceso a su historial.

### PR748-H03 — BLOQUEANTE · D3-C aprobada contradice el identificador público documentado

- **Archivo:** `docs/contracts/CC-053.md:76,102-111,175-180`; `docs/tasks/T-438.md:21,96-104`; `docs/master-plan.md:137-138`. **Evidencia:** [ANÁLISIS + decisión de Lautaro073].
- **Diagnóstico:** D3-A automática quedó pendiente; ahora Lautaro073 ratificó **D3-C el 2026-11-15**: aviso neutro, acción pública `assignment_unavailable`, causa real solo en datos administrativos, rollout compatible del lector. El plan actual usa `action = 'courier_suspended'` en la respuesta, observable por cualquier consumidor autorizado de la RPC aunque la etiqueta de UI sea neutra. La causa sensible no debe inferirse de un identificador público.
- **Arreglo:** reemplazar D3-A pendiente por D3-C aprobada con fecha/autorización, separar evento interno auditable de proyección pública neutra (por ejemplo, `request_cancellation_reasons.action='courier_suspended'` solo en tabla interna; `events[].action='assignment_unavailable'` para dueño/admin); `category=null`, `categoryLabel=null`, `actor=null`, `rawReason=null`; sin push; incluir negativos que comprueben ausencia literal de `courier_suspended`, motivo administrativo, nombre del repartidor en salida JSON y UI. El admin ve el motivo por `audit_log` **con autorización**, nunca por el historial público.
- **Control:** pgTAP inspecciona JSONB completo, dominio parsea discriminated union, test de UI asegura texto correcto sin rendering de `null` ni «Repartidor no disponible» como actor inexistente.

### PR748-H04 — BLOQUEANTE · El «Impacto exacto» no cabe íntegramente en «Archivos permitidos»

- **Archivo:** `docs/contracts/CC-053.md:209-218`; `docs/tasks/T-438.md:48-70,28-30`; fila T-438 de `docs/implementation-plan.md`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** `CancellationHistoryCard` delega el rendering de eventos a `src/features/trips/components/cancellation-history-list.tsx`, que hoy imprime `event.categoryLabel` y `event.actor?.displayName ?? unknownActor` aun si el nuevo evento trae `null` en ambos campos; fuente de textos `src/features/trips/cancellation-history-copy.ts` y prueba que renderiza la lista `src/features/trips/cancellation-history.test.tsx`. **Los tres faltan en archivos permitidos y en la fila del plan.** También falta la suite preexistente `supabase/tests/cc032_request_cancellation_history.sql` (crítica para preservar CC-032). No basta autorizar solo `cancellation-history-card.tsx` y «(+ test)». Hace falta permitir `docs/contracts/CC-032.md` para registrar la autorización nueva.
- **Arreglo:** ampliar la lista **con rutas exactas** en CC-053, T-438 y la fila del plan: `src/features/trips/components/cancellation-history-list.tsx`, `src/features/trips/cancellation-history-copy.ts`, `src/features/trips/cancellation-history.test.tsx`, `supabase/tests/cc032_request_cancellation_history.sql` y `docs/contracts/CC-032.md`. Poner sus comprobaciones en DoD; no ampliar con `src/features/trips/**` sin justificación.
- **Control:** contraste mecánico entre impacto CC ↔ archivos de ficha ↔ fila de plan; comprobar que la lista realmente consume y renderiza cada tipo, con tests.

### PR748-H05 — BLOQUEANTE · Desajuste entre 8 locks y número total de funciones redefinidas

- **Archivo:** `docs/contracts/CC-053.md:5-8,54-61,190`, `docs/tasks/T-438.md:41,84`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** las ocho definiciones que alteran orden/permisos son `accept_offer`, `submit_offer`, `take_request`, `request_cycle`, `mark_drop_delivered`, `mark_drop_failed`, `admin_suspend_courier` y `admin_resolve_incident`. **Además** `get_request_cancellation_history` debe redefinirse para emitir `assignment_unavailable`: **9 funciones afectadas más el helper nuevo**. «Una migración que redefine 8 funciones» y el DoD no expresan la novena redefinición.
- **Arreglo:** documentar «8 funciones con cambios de bloqueo + 1 función de historial; además el helper». Nombrarlas individualmente en el DoD. El archivo de migración único cubre las nueve, o justificar explícitamente el despliegue por fases.
- **Control:** lista de definiciones `create or replace function` en la migración de T-438 y tests de contrato de las nueve.

### PR748-H06 — BLOQUEANTE · Rollout incompatible con el lector anterior

- **Archivo:** `docs/contracts/CC-053.md:162-166` y `docs/tasks/T-438.md:36-38`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** el parser anterior `requestCancellationHistoryEventSchema` de `src/domain/rpc-contracts.ts` acepta **solo** `action='courier_cancel_match'`. Si la DB emite el evento nuevo antes de desplegar el lector, `request-cancellation-history.ts` devuelve `INTERNAL_ERROR` y la UI presenta fallo del historial. El documento admite esa ventana como «aceptada», incompatible con D3-C ratificada («rollout compatible»).
- **Arreglo:** definir una transición **desplegable en fases** y su gate. **Opción preferida**: preparar y desplegar primero un lector que admite ambos eventos (sin emitir aún el nuevo); verificarlo en Develop; solo entonces migrar SQL para producir `assignment_unavailable`; verificar que la versión vieja desplegada ya no pueda recibir payload nuevo. Si requiere PRs sucesivas para T-438, dejar la autorización expresa de Lautaro073 y el orden en CC/ficha conforme `AGENTS.md` `5; si no se separa, implementar un mecanismo verificable de compatibilidad hacia atrás (sin exponer eventos al lector legacy) **antes** del primer write. No basta aceptar errores temporales.
- **Control:** test de compatibilidad para `lector viejo + fase inicial`, `lector nuevo + esquema viejo` y `lector nuevo + esquema nuevo`; documentar checkpoint y rollback.

### PR748-H07 — BLOQUEANTE documental · Enmienda CC-032 1-A aprobada, aún no registrada

- **Archivo:** `docs/contracts/CC-053.md:102-111,178-180,222-226`. **Evidencia:** [ANÁLISIS + decisión de Lautaro073].
- **Diagnóstico:** `docs/contracts/CC-032.md:60-62,304` consagra decisión 1-A «exclusivamente courier_cancel_match» y «NO reabrir». Lautaro073 **autorizó expresamente el 2026-11-15 modificar 1-A de CC-032 para admitir el nuevo evento de CC-053**. Está **decidido**, no es una nueva pregunta. La rama aún no registra la enmienda, ni autoriza `docs/contracts/CC-032.md`.
- **Arreglo:** en `docs/contracts/CC-032.md` registrar adenda `CC-053 / 2026-11-15 / Lautaro073` que preserva el alcance original y añade **solo** `assignment_unavailable` para comercio dueño y admin (no `report_no_show`/`cancel_request`). Modificar referencias a «solo»/«exclusivamente» donde corresponda o acotarlas explícitamente a versión previa. Reconciliar decisión/producto/DoD y checklist de aprobación en CC-053 y ficha T-438. Sin reabrir las decisiones 2-A, 3-A, 4-A de CC-032.
- **Control:** búsqueda de afirmaciones contradictorias y verificación del alcance del payload por actor.

### PR748-H08 — MEJORA · Documentación incorrecta del mapeo de 40P01

- **Archivo:** `docs/contracts/CC-053.md:41-43`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** se afirma que el deadlock `40P01` llega como `DATABASE_ERROR`. `src/server/rpc/offers.ts:52-97` mapea códigos ajenos al contrato a `INTERNAL_ERROR`. `src/server/rpc/admin.ts:62-88` también usa `INTERNAL_ERROR`.
- **Arreglo:** decir «PostgreSQL interrumpe una transacción con SQLSTATE 40P01; en los wrappers actuales el código no reconocido llega como INTERNAL_ERROR»; no agregar códigos nuevos de dominio solo por la documentación.
- **Control:** leer `mapOfferRpcError` y `mapAdminRpcError`; no es un runtime reproducido en esta revisión.

### PR748-H09 — BLOQUEANTE · D1-A debe comprobar todos los efectos persistidos

- **Archivo:** `docs/contracts/CC-053.md:70-81`, `docs/tasks/T-438.md:86-91,109-111`. **Evidencia:** [ANÁLISIS].
- **Diagnóstico:** «mismos efectos que courier_cancel_match» está bien orientado, pero la receta y pruebas nombran solo parte de la transición. En `supabase/migrations/20261017090000_t369_publication_credits.sql:1222-1263` se ve también `offers.decided_at`, `delivery_requests.cancel_reason=null`, `delivered_at=null`, `cancelled_at` coherente, expiración de pendientes y `unconsume_publication`. Sin exigirlos con fixtures no triviales, un implementador puede dejar estado «published» con datos residuales o libro de cargos divergente.
- **Arreglo:** completar la enumeración exacta en CC y DoD: oferta aceptada cancelada con `decided_at`; todas pendientes de esa solicitud expiradas con `decided_at`; `accepted_offer_id=null`, `matched_at=null`, `picked_up_at=null`, `delivered_at=null`, `cancel_reason=null`, `cancelled_at` coherente con published, `published_at`/`expires_at` nuevos; `unconsume_publication` preserva el mismo cargo corriente de `consumed` a `reserved`, sin doble asiento; auditoría por solicitud y ausencia de datos sensibles. Comprobar `withdrawnOffersCount`/`republishedRequestsCount` por filas efectivamente mutadas.
- **Control:** pgTAP siembra valores iniciales distintos del resultado y afirma cada columna y asiento; mutar **uno por vez** `decided_at`, `cancel_reason`, `unconsume_publication`, audit, etc., conservando la suite original intacta. Control verde del SHA correcto y mutante rojo real, no RED/GREEN fabricados.

## 3. Verificación de «Actual» y locks

Fuentes de verdad inspeccionadas en `develop` @ `4c85b8da`:

| Afirmación `Actual` | Resultado |
|---|---|
| `admin_suspend_courier` bloquea courier, suspende, retira pending, deja accepted | **Sostenida** por `20260924013700_rpc_admin_v1.sql:125-158` |
| `admin_resolve_incident` bloquea incidente → accepted offer → courier y retira pending | **Sostenida** por `20260927120000_cc012_incidents_contract.sql:198-243`, pero la decisión se llama `preventive_suspension` (**H01**) |
| `request_cycle` rechaza suspended antes de transicionar sus viajes | **Sostenida** por `20261017090000_t369_publication_credits.sql:866-886` |
| `mark_drop_delivered` / `mark_drop_failed` rechazan suspended | **Sostenida** por `20261009200000_t340_multi_drop.sql:985-994,1119-1133` |
| `accept_offer`: request → offer → courier | **Sostenida** por `20261108020000_cc047_admin_hardening.sql:136-142` |
| `submit_offer` / `take_request`: lectura courier sin lock; request lock; segunda courier FOR SHARE | **Sostenida** por `20261009200000_t340_multi_drop.sql:1263,1281,1294,1359,1370,1426` |
| `request_cycle` courier: request → accepted offer → courier | **Sostenida** por `20261017090000_t369_publication_credits.sql:866-879` |
| `mark_drop_*` leen courier sin lock; luego request → drop | **Sostenida** por `t340_multi_drop.sql:985,1015-1033,1123,1154-1176` |
| `6.3` antes solo pending y aceptación | **Sostenida** por `docs/master-plan.md:133-136` |
| 40P01 «llega como DATABASE_ERROR» | **No sostenida** por wrappers; llega como `INTERNAL_ERROR` (**H08**) |

**Ocho funciones del orden:** `accept_offer`, `submit_offer`, `take_request`, `app_private.request_cycle` (rama courier), `mark_drop_delivered`, `mark_drop_failed`, `admin_suspend_courier`, `admin_resolve_incident`. Para `request_cycle` hay ramas no-courier que no toman lock del courier; esto no invalida el orden propuesto para la rama courier, pero la migración debe conservar el comportamiento de las demás ramas. Para `mark_drop_*` los SELECT sin lock no deben confundirse con locks. Para `admin_resolve_incident` se conserva `incidents FOR UPDATE` antes de `couriers`: se necesita revisar también la composición con otras RPC que usan incidentes.

**Límite:** la posibilidad concreta de deadlock depende de simultaneidad; los cinco escenarios concurrentes de T-438 son especificaciones futuras, no pruebas realizadas por esta revisión. No se ha certificado «no 40P01» por ejecución.

## 4. Reconciliación y decisiones

- `docs/tasks/T-438.md` fue **creada** en esta rama, no está en develop; el plan y contrato se pueden revisar juntos. Las rutas de implementación son prospectivas, no código cambiado.
- Cobertura parcial: existe helper, pgTAP nuevo, suites generales, integración 5 carreras, dominio, fake, servidor, UI y E2E. No es cierta la declaración absoluta de `T-438.md:29-30` «cada archivo y suite / cada prueba cubierta» por H02/H04/H05/H09.
- **Ratificaciones:** D1-A y D2-A dadas personalmente por Lautaro073 el 2026-11-13; D3-C dada personalmente el 2026-11-15, con permiso expreso de revisar la decisión 1-A de CC-032. No se pide que vuelva a decidir nada. D3-A automática no es decisión válida para el merge.
- `contract-change` exige decisiones visibles cerradas, helper sin grants a clientes, concurrencia e idempotencia, matriz por actor, compatibilidad de rollout y reconciliación con ficha. El CC redacta casi todos los apartados; los puntos concretos sin cerrar son H02–H07/H09.

## 5. NO TOCAR

- No modificar el SQL, las RPC, tests existentes ni `docs/revision-pr/**` como autor de esta PR documental. Las correcciones ahora son solo a `CC-053`, la adenda autorizada `CC-032`, ficha, plan, master y bitácora.
- No reabrir D1-A, D2-A ni D3-C; ni reabrir CC-032 2-A/3-A/4-A. No agregar push, backfill ni liberar datos de contactos.
- No hacer pasar CI cancelado como green y no exigir una corrida nueva por un commit solo de documentación. `pnpm test:db`, concurrencia real y E2E se deberán ejecutar en PR de implementación, no antes.
- No aprobar ni mergear desde la revisión.

## 6. Estado y próxima ronda

**Bloqueantes: 8, mejora: 1.** Todos abiertos sobre `93b34c05`. La decisión personal D3-C y la autorización a CC-032 están cerradas **como decisión**, no implementadas en los documentos de ese SHA. Se publicará un prompt correctivo acotado con rutas, cambios y verificación. El autor debe hacer `git pull` antes de seguir; la revisión independiente comprobará el nuevo SHA y creará `ronda-2.md` si hay nueva versión.

**Checks de esta ronda:** typecheck n.a. · lint n.a. · unit n.a. · pgTAP n.a. · concurrencia n.a. · E2E n.a. · CI cancelado. Análisis estático de GitHub; sin falsa certificación RED→GREEN.
