# Revisión independiente — PR #318 / T-340 — Ronda 4

**Fecha:** 2026-10-12. **SHA de implementación auditado:** `c7cab17491d49791dbb49d4b2e5696ff64a9495d`. **Base:** `develop` `267e9810f99343f2511473d76dddd4e5da740847`, sin commits pendientes detrás. **PR Draft**.  
**Resultado: CON BLOQUEANTES (7 nuevos: PR318-H03 a PR318-H09). NO APROBAR NI MERGEAR.** Gate 0 anterior sigue válido (H01/H02 cerrados); esta ronda audita el **Paso 2** recién implementado, no lo confunde con Gate 0.

## Decisión técnica resuelta por Lautaro073 (opción A, 2026-10-12)

Se autoriza **extender `public.get_trip_details(p_request_id uuid)` con `drops[]`** ordenado por `position`, con los detalles y contactos privados de **todas** las entregas **solo después de autorizar al comercio dueño o courier aceptado**. Los **campos escalares legacy de la RESPUESTA** (p. ej. `deliveryNotes`, `cashChangeAmount`, `recipientName`, `dropoffAddress`) continúan por compatibilidad y se **derivan del primer elemento de `drops[]`**, sin eliminar campos actuales. **Distinción contractual obligatoria:** conservar la forma de respuesta vieja NO autoriza seguir leyendo `delivery_requests.notes` ni `delivery_requests.cash_change_amount`. Esas **columnas DB legacy deben dejar de ser dependencia de lectores ANTES de la limpieza del Paso 3**. La decisión quedó registrada también en `docs/tasks/T-340.md` de la rama. No habilita implementación del escritor multi-drop ni limpieza en este PR.

## Alcance realmente revisado

Diff desde último commit de revisión R3 `255c72dc`: implementación y tests del autor afectan 38 archivos (nueva migración `20261012010000_t340_readers.sql`, nuevo test `src/domain/t340-multi-drop.test.ts`, contratos, fake, feed, live, admin, viaje, scrubber). Se revisó el cuerpo de PR, bitácora de Asako (sesión 2026-10-11 22:15), ficha desde `develop`, CC-022 §3/§8/§10, SQL + TypeScript y jobs del **SHA exacto**. No se tocaron SQL remotos; se comprobó que la migración fue aplicada por el `db-tests` efímero de Actions antes de fallar su pgTAP.

### PR318-H03 — ALTO — RPC por entrega invocada con argumento inválido

**`src/server/rpc/requests.ts:41–48`**, `src/features/trips/schemas.ts:28–37`, `src/features/trips/actions.ts:181–220`; contraste `supabase/migrations/20261009200000_t340_multi_drop.sql:949,1085`.

`markDropDeliveredSchema` y `markDropFailedSchema` tienen `dropId` **y** `requestId`; `callRequestRpc` construye **ambos** `p_drop_id` + `p_request_id` indiscriminadamente. SQL define `mark_drop_delivered(p_drop_id uuid)` y `mark_drop_failed(p_drop_id uuid, p_reason text)`: ninguna acepta `p_request_id`. Las server actions ejecutan la RPC con firma incorrecta; los tests del fake no detectan desajustes PostgREST.

**Arreglo exigido:** para `mark_drop_*`, enviar **solo** `p_drop_id` y, si corresponde, `p_reason`; `requestId` del input puede conservarse como dato de revalidación pero **no enviarse** a SQL. Añadir test spy estricto de argumentos para ambas RPC (RECHAZAR cualquier campo extra); RED antes de corregir, GREEN después.

### PR318-H04 — ALTO — Lector SQL post-match solo da drop 1 y sigue dependiendo de DB legacy

**`supabase/migrations/20261012010000_t340_readers.sql:124–157,187–214,255–277`; `src/features/trips/queries.ts:26–110`; `src/features/trips/types.ts`.**

El SELECT restringe `d.position=1`, arma únicamente campos escalares; el JSON NO contiene `drops[]`. Las dos RPCs nuevas todavía hacen `coalesce(..., v_request.notes)` y `coalesce(..., v_request.cash_change_amount)`. El DTO y las consultas de coordenadas del viaje también leen solo el primer drop. **CC-022 §10** exige que ningún lector dependa de esas columnas cuando el Paso 3 las ponga en NULL. Opción A aprobada: devolver `drops[]` completo con orden determinista `position`, campos privados de contactos SOLO post-match autorizado, conservar campos escalares legacy **derivados** de `drops[0]`, nunca de `delivery_requests.notes/cash_change_amount`.

**Pruebas:** pgTAP con **3 drops distintos** (orden mezclado al insert), notas y cambios divergentes, legacy `NULL`, 2 tipos de actor permitidos, terceros rechazados; comprobar shape completo `drops[]`, proyección escalar de primer drop y cero dependencia legacy. `get_merchant_request_private_fields` debe dejar de leer columnas legacy DB y mantener contrato del comercio dueño.

### PR318-H05 — ALTO — Feed, ofertas y live no muestran resumen por cada entrega

**`src/features/offers/queries.ts:87–100,144–174`; `src/server/live/t204.ts:79–93,147–172`; `src/lib/live-contracts.ts`; `src/features/offers/components/request-card.tsx`.**

Solo se agregó `dropsCount`; se sigue proyectando `dropoff_zone` y `package_type` de `delivery_requests` (padre), sin leer `delivery_request_drops`. Para N entregas no se muestran las zonas/tipos y distancias aproximadas **por entrega** que CC-022 §3 exige antes de ofertar. **Aspecto correcto a preservar:** estas proyecciones nuevas NO seleccionan ni serializan teléfonos, notas, direcciones exactas, pines ni importe exacto de cambio, y deben seguir así.

**Pruebas:** feed y live 1/3 drops con zona, tipo, pago, `needs_change`, `position`, tramos/total aproximados, total cotizado; ausencias de campos privados comprobadas sobre payload completo para repartidores sin match (no solo UI). El dato sensible no debe entrar en cache ni SSE.

### PR318-H06 — ALTO — Vistas/historial/WhatsApp siguen preparados para una sola entrega

**`src/features/trips/components/trip-courier-view.tsx:129–165`; `src/features/trips/components/trip-merchant-view.tsx:58–66,176–209`; `src/features/requests/queries.ts:181–238,648–725`; `src/lib/whatsapp.ts`.**

El viaje del courier dibuja un solo destino, la vista del comercio usa `trip.recipientPhone` para **un único** «Avisar a mi cliente», y el historial/solicitud todavía usa zona y paquete del request padre. El panel admin configuró el tope, pero sus **lectores operativos** no muestran las N entregas. Además, la vista del courier trata `trip.amountArs` (por entrega) como importe de todo el viaje; faltan `totalAmountArs` y `collectibleAmountArs` derivados por los estados delivered/failed.

**Pruebas:** viaje y mapa con 3 drops ordenados; detalles privados accesibles solo a actor post-match; comercio envía WhatsApp **a cada destinatario concreto** con su teléfono/medio de pago/cambio, jamás al destinatario de otro drop; historial/admin muestran conteo/resumen sin N+1; precio total y cobrable según CC-022 §8; compatibilidad 1 drop.

### PR318-H07 — ALTO — `db-tests` rojo: UUID duplicado en nuevo fixture pgTAP

**`supabase/tests/t340_multi_drop.sql:295,1279–1323`**. Se reutilizó el request ID `30000000-0000-4000-8000-000000003430` en dos fixtures del mismo archivo transaccional. GitHub Actions `db-tests` job `114634153789` del SHA auditado reporta literalmente `duplicate key value violates unique constraint "delivery_requests_pkey"` en línea 1323; `planned 83 tests but ran 77`, `Result: FAIL`. La migración **sí** se aplicó en el DB efímero del job; no confundir con fracaso de migración ni con despliegue a Supabase Develop remoto.

**Arreglo:** IDs aislados y únicos para todos los fixtures (request/offer/drop), revisando todas las apariciones; 83/83 pgTAP de T-340 y total CI PASS, sin cambiar `plan(83)`, omitir tests ni desactivar errores.

### PR318-H08 — ALTO — `unit` rojo: fake ampliado sin cobertura mínima

**`src/domain/testing/rpc-fake.ts`, `src/domain/t340-multi-drop.test.ts`.** El job `unit` `114634153773` del SHA auditado aborta por límites de cobertura: `rpc-fake.ts` **sentencias 88,78 %** y **ramas 84,88 %**, frente a **90 %** exigido para `src/domain/**/*.ts`. El número de tests declarados como verdes en bitácora **no demuestra cobertura**, porque `pnpm test` no es el control de cobertura que falla en CI.

**Arreglo:** añadir pruebas de comportamiento independientes del fake para branches reales (roles inválidos, estados, montos, estados fallidos/todos fallidos, idempotencia, límite configurable, errores, concurrencia simulada sin fingir DB). No bajar umbrales, cambiar `collectCoverage`, agregar `istanbul ignore`, excluir archivos o tests.

### PR318-H09 — ALTO — Test suite nueva no prueba el flujo N real ni aporta RED→GREEN del Paso 2

**`supabase/tests/t340_multi_drop.sql:1275–1362`; `src/domain/t340-multi-drop.test.ts`; `e2e/specs/`**. Los 6 pgTAP nuevos verifican solo **1 drop**; la suite de fake prueba creación y estados pero no ejercita la SQL/URL/servicio real ni el array N post-match. No existe aún un nuevo E2E específico del **paso 2** que combine 3 drops, resumen público, actor sin permiso, match y vista/WhatsApp privados; el spec `t340-legacy-checkpoint.spec.ts` es **Gate 0 ya cerrado**, no sustituye esta prueba. No se adjuntó RED propio de los lectores de esta ronda. El test de dominio además utiliza varios `as any` evitables (11 apariciones por inspección), debilitando el control de tipos.

**Arreglo:** agregar controles pgTAP con 3 drops y adversarios autorizados/no autorizados, unit de mapping/DTO/UI y E2E Preview con fixtures temporales de 3 drops **sin habilitar escritor UI** (Paso 4). Para cada nueva prueba, mostrar RED real contra el comportamiento previo y GREEN posterior; no mutar SQL remoto compartido. Eliminar `any` mediante tipos fijos y factories correctas. No usar mocks que devuelvan exactamente las mismas constantes que la aserción; sin `.skip`, `.only`, `expect(true).toBe(true)`.

## CI y límites reales de esta ronda

**HEAD exacto `c7cab174`:** typecheck ✅, lint ✅, build ✅, audit ✅, bundle-budget ✅; `db-tests` ❌ (error UNIQUE documentado), `unit` ❌ (cobertura), `e2e-preview` estado **error** (no hubo GREEN acreditado para este HEAD), `approval-policy` ❌ (sin informe de R4 al momento de inspección). Vercel ✅. Job logs de base y unit se leyeron; **no** se ejecutó Docker/Supabase ni pruebas locales desde clon. Se verificaron estáticamente 12 condiciones de contratos, padres/niños y vistas sobre los archivos exactos del SHA con un control JS en memoria; ver `evidencia/comandos.md`. **El RED real observado** son los dos jobs CI fallidos; las otras faltas están acreditadas **por inspección**, no se finge mutación E2E runtime. Revalidar CI + e2e-preview del nuevo SHA cuando Asako termine.

## Informe revisar-pr

Informe revisar-pr — T-340 Paso 2/4 — PR #318 — 2026-10-12 — revisión independiente — ronda 4.

**Resultado: CON BLOQUEANTES (7 — PR318-H03..H09); Gate 0 previamente verificado.**  
**BLOQUEANTES:** H03 RPC args inválidos; H04 trip reader solo drop1 y fallback legacy; H05 feed/live sin detalle público por drop; H06 trip/historial/admin/WhatsApp de un solo destinatario; H07 pgTAP duplicate ID CI rojo; H08 cobertura fake CI rojo; H09 no prueba N real/RED de nuevos lectores.

**Checks:** typecheck/lint/build/audit/bundle-budget PASS; db-tests FAIL (UNIQUE PK + plan 83 vs 77); unit FAIL (coverage 88.78/84.88 vs 90); e2e-preview ERROR, approval-policy FAIL. **Checks propios locales:** n.e.; inspección independiente y logs internos de GitHub Actions exactos.  
**Decisiones:** ninguna pendiente. **Opción A autorizada** y registrada en ficha; no declarar Gate 0 pendiente.  
**Acciones:** Asako corrige e implementa lectores completos **en esta misma PR Draft**. Pasos 3/4 reservados para **Kira** en PRs posteriores tras gates; **no aprobar ni mergear PR #318**.
