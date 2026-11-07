# PR #624 — revisión independiente, ronda 1

**T-419 · CC-042** · 2026-11-06 · SHA inspeccionado: 2c6ae940a0215886b8567e64609aad866570027c.
**Resultado: CON BLOQUEANTES (6), MEJORAS (1).** No aprobar ni mergear. D01=A resuelta por Lautaro073 antes de publicar.

## Alcance, entorno y controles

- Se leyó la ficha T-419 **desde develop** y se contrastó su diff (la PR agrega excepciones para scripts de integración, wrapper RPC, matriz RLS, UI, plan y master-plan). Son cambios explicados por la bitácora y el CI; no se exige volver a modificar la ficha ni se autoriza ampliarla en el arreglo.
- Se revisaron las reglas COMO-ENTREGAR, README del catálogo P01–P21, skill revisar-pr, PR, bitácora, contratos CC-042 y CC-043, migración principal, pgTAP, acciones, queries, manager, quick switch, admin y E2E.
- develop coincide con la base de PR y GitHub informa mergeable=true. No se ejecutó git merge-tree en clon local (no disponible en esta sesión).
- Se contrastaron comentarios: sin comentarios técnicos previos; pr-624/ inexistente antes de esta ronda.
- CI run 42247329813 ejecutado en el SHA inspeccionado: **unit 195 archivos/3665 tests PASS**; **db-tests 43 archivos/3545 pgTAP PASS**, incluida CC-042 y comparación de tipos; lint/typecheck/build/audit/bundle-budget PASS. En db-tests aparecen errores esperados de controles RED generales, seguidos de GREEN; no se los cuenta como defectos finales.
- No se corrieron typecheck, lint, unit, pgTAP ni E2E por cuenta del revisor; no había clon local con dependencias. Prohibición de Supabase/Docker local respetada. RED U1–U8 y PR aisladas #625–#628 son **evidencia del autor**, no mutaciones reproducidas independientemente. Las mutaciones para los hallazgos nuevos se especifican abajo; los casos de base quedan por inspección + CI verde.
- E2E nuevo y E2E adaptado: **no ejecutados**, estado esperado BLOCKED / REQUIRES DEVELOP MIGRATION; el GREEN de los otros jobs no sustituye E2E.

## Bloqueantes

### PR624-H01 · ALTO — estado documental inicial incoherente
**Fuente:** supabase/migrations/20261106120000_cc042_courier_vehicles.sql, submit_courier_onboarding_documents (1363–1383) y finalize_courier_application (1638–1655).
La RPC de onboarding registra licencia y seguro como submitted, pero al crear el vehículo finalize toma v_courier.license_status / insurance_status. Esas columnas todavía pueden ser none. Resultado: documento presentado, vehículo/insignia sin documento. El pgTAP 438–445 valida association por vehicle_id, pero **no estado del vehículo ni espejo**.
**Arreglo:** derivar estados del documento vigente al finalizar, guardar en vehículo y reflejar; exigir pgTAP moto con ambos submitted, vehículo/reflect/doc_level. RED: volver a inicializar desde couriers.

### PR624-H02 · ALTO — backfill deja bicicleta con credencial de otro tipo
**Fuente:** misma migración (193–227), pgTAP (152–156).
Se crea una bici con license_status=none, pero couriers conserva verified y por lo tanto doc_level e insignia pueden representar otra realidad. El pgTAP espera ambas cosas contradictorias.
**Arreglo:** normalizar reflejo bike/walk a none en backfill sin borrar históricos. Probar doc_level=0 y documentos legacy preservados. RED: saltar normalización.

### PR624-H03 · ALTO — D01=A, snapshot original para idempotencia
**Fuente:** misma migración, finalize_courier_application (1589–1600).
El reintento exige que tipo y patente coincidan con couriers, ahora reflejo mutable del activo. Tras moto→bici, un reintento exacto de la moto se rechaza. Lo mismo tras cambiar patente.
**Decisión:** Lautaro073 confirmó **A**, guardar vehículo y patente del primer envío como snapshot inmutable; backfill y protección en base/RLS. **No queda opción pendiente.**
**Arreglo:** comparar reintentos con snapshot, no con activo. pgTAP: moto→bici activa→reintento original OK, fecha igual, diferencia rechazada, edición de patente posterior no altera comparación, columnas protegidas. RED: comparar con reflejo o permitir escribir snapshot.

### PR624-H04 · ALTO — idempotencyKey ignora vehicle_id
**Fuente:** misma migración, add_courier_optional_document (854–875), replace_courier_document (1073–1095).
Ambas verifican key + storage_path y devuelven idempotent sin corroborar si el documento existente pertenece al vehicleId ahora solicitado. Reusar mismo par key/path para otro vehículo da éxito aparente sobre el documento anterior.
**Arreglo:** incluir vehicle_id de fila en comparación IS NOT DISTINCT FROM destino. Nuevo pgTAP para ambas funciones: misma key/path+vehículo es reintento; mismo key/path+otro vehículo es VALIDATION_ERROR y no cambia nada. RED: quitar comparación.

### PR624-H05 · ALTO — licencia antigua sin vehículo se acredita al activo
**Fuente:** src/features/courier-onboarding/queries.ts (30–35, 75–77), src/app/(courier)/courier/profile/page.tsx (81–84).
El filtro para cualquier kind acepta vehicle_id=null. Un documento license/insurance legacy sin vínculo se muestra para bici u otro vehículo activo, pese a que el reflejo de ese vehículo diga none. No está cubierto por el test de dos vehicle_id presentes.
**Arreglo:** excepción legacy solamente antes de existir activo/onboarding; con activo, para license/insurance exigir vehicle_id === active_vehicle_id; DNI/selfie/avatar independientes. Matriz con bici+licencia legacy, moto, auto, sin activo. RED: restaurar filtro actual.

### PR624-H06 · MEDIO — E2E puede dejar la fixture corrupta en fallo intermedio
**Fuente:** e2e/specs/courier-vehicles.spec.ts (73–104), e2e/specs/courier-onboarding.spec.ts (cleanup de vehículos).
El finally borra directamente la bici sin desactivar/retirar oferta pendiente. Si falla tras activarla, el guard cc042_guard_vehicle_archive (119–139 de la migración) impide quitar el vehículo activo. Si falla antes de withdraw_offer, además queda una oferta. El happy path no protege el cleanup ante errores.
**Arreglo:** finally retira oferta creada, restaura moto por RPC y luego elimina vehículo, con manejo de fallas que no oculte el error principal; cubrir interrupción entre activación y retirada. E2E sigue pendiente de migración develop.

## Mejora a implementar

### PR624-H07 · BAJO — identidad de agrupamiento admin inestable
**Fuente:** src/features/admin/queries.ts (225–238).
Ordenar documentos por tipo+patente no equivale a agrupar por identidad: vehículos archivados y recreados con misma patente se mezclan visualmente. Incorporar vehicle_id como llave estable, manteniendo etiquetas legibles, con prueba del caso histórico.

## Evidencia favorable y límites

- Separar tabla courier_vehicles y congelar escritura directa en couriers es correcto conceptualmente; el aislamiento de lectura por dueño/admin, REVOKE de DML, candados para switch y backfill idempotente están representados en el SQL y pgTAP.
- Se mantuvo el payload vehicleId sin sobrecargar las firmas (evita colisiones con las migraciones reaplicadas por CC-025/CC-033); los scripts de integración restauran funciones vigentes y el CI final pasó.
- Las PR #625–#628 figuran cerradas sin merge, identificadas por el autor como mutaciones RED de base. No se presentaron como pruebas independientes.
- Los casos nuevos detectados no tienen prueba RED/GREEN ejecutada por esta revisión. Ningún verificado_en_sha se completa: el SHA indica versión inspeccionada, **no** reparación probada.

## Prompt para la siguiente sesión del agente

Ver el mismo bloque de corrección exacto en el comentario de la PR. Se reproduce íntegro a continuación:

### Para tu agy — copiá desde acá

Tarea: T-419 · PR #624 · rama feat/T-419-vehiculos.
0. Hacé git pull de la rama (incluye el commit de revisión). Sin rebase, force-push ni amend. Revisá docs/revision-pr/pr-624/revisiones/ronda-1.md y docs/revision-pr/pr-624/evidencia/comandos.md. No mergees.

Decisión de Lautaro073: D01 = A. El vehículo y la patente de la postulación original son un snapshot inmutable, distinto del reflejo mutable de couriers. No vuelvas a discutir ni sustituir esta decisión.

Podés tocar SOLO:
- supabase/migrations/20261106120000_cc042_courier_vehicles.sql
- supabase/tests/cc042_courier_vehicles.sql
- src/features/courier-onboarding/queries.ts
- src/features/courier-onboarding/queries.test.ts
- src/app/(courier)/courier/profile/page.tsx
- src/features/admin/queries.ts
- src/features/admin/components/applicant-detail-view.test.tsx
- e2e/specs/courier-vehicles.spec.ts
- e2e/specs/courier-onboarding.spec.ts
- docs/tasks/log/T-419.md
Las demás rutas quedan cerradas. Si una prueba exige ampliar esta lista, registrá motivo y detené SOLO esa parte; no amplíes la ficha ni los contratos por tu cuenta.

Prohibido: editar docs/revision-pr/**, docs/tasks/T-419.md, docs/contracts/CC-042.md, docs/implementation-plan.md; nuevas dependencias, archivos nuevos, mocks que no recorran producción, tests falsos, alterar expectativas para verde, condiciones especiales para tests, debilitar las pruebas anteriores, marcar hallazgos como verificados. No ejecutes Supabase/Docker local ni entornos remotos. Los scripts temporales van a /tmp.

1. PR624-H01 — En finalize_courier_application, NO inicialices el vehículo del alta con v_courier.license_status / insurance_status: calculá cada estado desde los courier_documents actuales de kind license e insurance, que submit_courier_onboarding_documents acaba de insertar. Si falta un documento, 'none'; si existe, su status vigente. Esto vale tanto al INSERT como ante una fila preexistente. Sincronizá el reflejo de couriers una vez creado y activado el vehículo; doc_level debe seguir el activo. En cc042_courier_vehicles.sql, sembrá alta moto con licencia y seguro submitted, ejecutá finalize con service_role y afirmá vehículo, couriers y doc_level coherentes. Hacé mutación RED en memoria de SQL volviendo a asignar estados desde couriers; corré el mismo pgTAP en CI autorizado y adjuntá aserciones RED/GREEN verificables.

2. PR624-H02 — En app_private.cc042_backfill_courier_vehicles, para vehículo activo bike/walk asegurá que license_status/insurance_status en couriers reflejan none, sin borrar documentos legacy de auditoría. No reintroduzcas una licencia válida en bici. Ajustá la prueba existente que actualmente espera verified en couriers para legacy_bike: exigí none y doc_level=0; verificá que los documentos antiguos sobreviven. Mutación RED: omitir la limpieza del reflejo; la aserción nueva debe fallar.

3. PR624-H03 (D01=A) — En la misma migración CC-042, agregá a couriers columnas de snapshot, por ejemplo original_application_vehicle_type (public.vehicle_type) y original_application_vehicle_plate (text), separadas de vehicle_type/vehicle_plate operativos. Hacé backfill para application_submitted=true copiando el vehículo y patente originales existentes ANTES de cualquier modificación de activo, y mantené NULL cuando aún no se envió. En finalize_courier_application, el primer envío escribe snapshot y vehículo activo bajo el mismo lock/transacción; en la rama idempotent compara p_dni_hmac y p_vehicle_type/p_vehicle_plate normalizados contra DNI y snapshot, nunca contra el reflejo. Protegé la inmutabilidad con un trigger de base que bloquee cambios externos o posteriores (incluido service_role tras el primer envío), y sumá las nuevas columnas a couriers_update_self / controles aplicables. Alineá el guard del primer envío con el mecanismo autorizado de CC-043, sin abrir bypass. En cc042_courier_vehicles.sql probá:
   (a) finalize de moto + patente, guardando submitted_at;
   (b) agregá bici y activala por RPC autenticada;
   (c) reintentá finalize con la moto y patente ORIGINALES → idempotent=true, submitted_at y snapshot sin cambios, bici sigue activa;
   (d) reintentá con otra patente, tipo o DNI → INVALID_STATE_TRANSITION;
   (e) editá después la patente de la moto y repetí (c): sigue siendo idempotente sobre la original;
   (f) intentos de UPDATE directo del snapshot → rechazo y datos intactos;
   (g) backfill histórico conserva snapshot con vehicle_type/plate originales incluso si después cambia activo.
   Mutación RED: compará intencionalmente contra couriers.vehicle_type/vehicle_plate o permití editar snapshot; las pruebas pertinentes deben detectar ambas fallas. No alteres submitted_at.

4. PR624-H04 — En add_courier_optional_document y replace_courier_document, incluí vehicle_id en la lectura por idempotencyKey y exigí IS NOT DISTINCT FROM v_vehicle_id ADEMÁS de storage_path igual antes de retornar idempotent=true. Mismo key+path para otro vehicleId: VALIDATION_ERROR, sin alterar documentos ni estados. Mismo key+path+vehículo: idempotencia verdadera. Probalo en cc042_courier_vehicles.sql para las DOS RPC con moto y auto propios, verificando filas, identidad y estado. Mutación RED: quitar solo la comparación de vehicle_id; debe volver a aceptarse incorrectamente el segundo vehículo y la prueba debe fallar.

5. PR624-H05 — Cambiá isActiveVehicleDocument en queries.ts: DNI/selfie/avatar (sin vehículo) siguen visibles; licencia y seguro solo si vehicle_id coincide con el activo, salvo compatibilidad de onboarding ANTES de que exista active_vehicle_id (documentos todavía sin asociar). Alineá el filtro equivalente en courier/profile/page.tsx (reutilizá la misma semántica sin importar un módulo server-only a cliente). En queries.test.ts agregá una matriz: moto activa/licencia moto; auto activo/licencia moto; bike activa/licencia legacy vehicle_id=null; sin activo/documentos de onboarding sin vínculo; DNI siempre visible. Mutación RED: restaurar !row.vehicle_id || ... debe hacer fallar el caso legacy+bici.

6. PR624-H06 — En courier-vehicles.spec.ts y los dos E2E adaptados de courier-onboarding.spec.ts, hacé cleanup que funcione en fallas intermedias: guardar moto activa inicial y IDs creados, retirar oferta pendiente en finally si llegó a crearse, reactivar moto mediante la RPC auténtica cuando no haya oferta/viaje, y SOLO después eliminar el vehículo agregado, comprobando errores de cleanup. Evitá borrado directo de vehículo aún activo. La prueba debe comprobar las precondiciones del seed y no dejar fixture sucia si falla después de activar la bici, antes de withdraw_offer o antes de volver a moto. Si la falla ocurre durante viaje activo, registrar bloqueo sin enmascarar el error principal. Mutación RED: simular fallo posterior a la activación dentro de un escenario aislado y demostrar que el cleanup anterior fallaba y el nuevo limpia; no introducir un falso error en producción.

7. PR624-H07 (mejora) — En admin/queries.ts ordená/agrupá usando courier_documents.vehicle_id como identidad estable, no vehicle_type:plate, manteniendo etiqueta legible; cubrí en applicant-detail-view.test.tsx dos vehículos distintos del mismo tipo/patente (uno histórico archivado) sin fusionarlos. No amplíes el contrato público solo por estética.

Comandos finales: pnpm typecheck; pnpm lint; pnpm test; node docs/revision-pr/analizar.mjs verificacion; chequeo de diff/archivos permitidos contra origin/develop. No exijas otro CI verde exclusivamente por una modificación documental de bitácora. La base se verifica por el job db-tests de CI de la PR (Files, Tests y Result), no levantando Docker/Supabase local. El E2E de esta PR se ejecuta después de migrate-develop; mantené BLOCKED / REQUIRES DEVELOP MIGRATION hasta entonces. No dispares workflows manualmente.

Por cada caso documentá en docs/tasks/log/T-419.md: hecho, prueba exacta, mutación RED independiente restaurada, GREEN y falta. Nunca escribas "verificado" (eso es del revisor); no inventes logs ni adulteres tests para pasarlos. Terminá con commit Conventional Commits [T-419], push normal a la rama y pegá git ls-remote origin feat/T-419-vehiculos. Antes de continuar: git pull, sin rebase.

## Estado de cierre

Ronda documentada en la rama; comentario PR requerido. Seguimiento posterior por agente y nueva revisión independiente. No merge.
