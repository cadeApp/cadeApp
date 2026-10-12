# PR #318 / T-340 — Revisión independiente — Ronda 1

**Fecha:** 2026-10-11 · **SHA de implementación revisado:** `4e70e93486463f261722108bedc3e8d622708617` · base `develop` desde merge de PR #317 `267e9810f99343f2511473d76dddd4e5da740847`.  
**Resultado: CON BLOQUEANTES DE ENTRADA (1 — PR318-H01, Gate 0 sin ejecutar).** PR correctamente en Draft. **No hay implementación de lectores todavía y no se encontró defecto nuevo en código de lectores.**

## Qué se revisó

- **Diff exacto `develop...feat/T-340-lectores`** anterior a la revisión: 2 commits de diferencia y **un único archivo de bitácora** `docs/tasks/log/T-340.md` (43 líneas nuevas). No se modificaron lectores, SQL productivo, secretos, workflows, apps ni tests; el autor respetó el alto de Gate 0.
- **Bitácora:** sesión `2026-10-11 18:30 — asako669`: informa migración y CI Develop verdes, script efímero `scratch/checkpoint-step1.mjs` preparado **fuera del diff**, y ausencia de credenciales locales. Explícitamente **no declara Gate 0 GREEN**.
- **Contrato:** `docs/contracts/CC-022.md` §10 y `docs/tasks/T-340.md` plan multi-PR exigen, antes de iniciar paso 2, **migración desplegada en Develop y checkpoint funcional del cliente legacy** (publicar 1 drop, reintento sin duplicados, `deliveryNotes`/`cashChangeAmount` preservados).
- **Evidencia CI previa verificada:** merge `267e9810`; run `migrate` `38171033590` ✅ con aplicación real de `20261009200000_t340_multi_drop.sql`; run CI `38171033600` ✅; `e2e-preview` `38171291606` ✅. **Estas pruebas no incluyen por sí solas los cuatro oráculos del checkpoint**.
- **Infraestructura:** `.github/workflows/e2e-preview.yml` usa `environment: develop`, `concurrency: cadeapp-develop-e2e`, `--workers=1` y credenciales de secretos de GitHub para E2E; `e2e/fixtures/roles.ts` y `e2e/fixtures/staging-seed.ts` ya crean y limpian usuarios/solicitudes E2E con `testRunId`; `src/server/e2e/staging-seed.ts` incluye guard fail-closed. Por lo tanto, no hace falta compartir credenciales ni abrir otro workflow.
- **Checks propios:** no se ejecutó Docker, Supabase local ni tests locales desde un clon; verificación independiente mediante lectura de archivos y consultas a resultados de GitHub CI. El `db-tests` del HEAD inicial de la PR estaba en progreso durante la primera consulta; esta ronda **no certifica pruebas nuevas**, porque todavía no hay código del paso 2.

## PR318-H01 — ALTO — Gate 0 no demuestra el cliente legacy desplegado

**Ubicación:** `docs/tasks/log/T-340.md` (sesión 18:30), `docs/tasks/T-340.md` «Plan de rollout multi-PR», CC-022 §10.  
**Patrón:** `P08-control-no-cubre-lo-que-dice`; categoría: test-coverage; origen: ambos (la exigencia contractual es clara, pero el procedimiento seguro de ejecución remota no estaba documentado de forma operativa).

El autor hizo bien en **detener** la implementación: la migración y los E2E globales verdes no acreditan que la **UI legacy real** publique en el esquema nuevo, que `publish_request` reintentada no duplique el drop, que tras match `get_trip_details` conserve notas y monto de cambio, ni que las columnas legacy no hayan sido limpiadas.

**Solución elegida por Lautaro073: opción A**, expresamente autorizada en esta conversación el **2026-10-11**: agregar **un nuevo test Playwright** `e2e/specs/t340-legacy-checkpoint.spec.ts` que corra automáticamente contra Supabase Develop a través del **workflow EXISTENTE `e2e-preview`**. Se registró la excepción exacta en `docs/tasks/T-340.md` de **esta rama**; no es permiso para adelantar trabajo del paso 2 ni para cambiar otros archivos o secrets.

**Oráculos obligatorios del nuevo spec (todos sobre el MISMO request de una corrida y credenciales/fixtures efímeras):**
1. **Legacy real:** login como merchant, completar el formulario actual `/requests/new` (no el futuro multi-drop), elegir `cash` + `needsChange` + valor p. ej. `5000`, notas centinela únicas con `stagingContext.testRunId`, consentimiento y publicar con botón de UI. Obtener ID con `findRequestIdByNotesMarker`. Por inspección de DB real, `delivery_requests.status='published'`, `drops_count=1`, exactamente 1 `delivery_request_drops` ligado, y contacto `drop_contacts` con notas y `cash_change_amount=5000`. **No sustituir la publicación por un `INSERT` administrativo directo a `published`**.
2. **Idempotencia:** `createAuthenticatedClient(merchant)` invoca `publish_request({p_request_id: requestId})` nuevamente. Según contrato real, verificar resultado idempotente o rechazo de transición esperado **preciso**, pero siempre **mismo drop ID** y **count=1** antes y después, sin crear una segunda fila.
3. **Post-match:** crear una oferta pendiente por el courier E2E y aceptarla **vía RPC pública como merchant real**, con estado `matched`; consultar **`get_trip_details` como courier aceptado o comercio autorizado** y comprobar igualdad exacta `deliveryNotes === sentinel` y `cashChangeAmount === 5000`. No hacer una consulta admin y llamarla RPC cliente; distinguir oráculo inspectivo/admin del camino público. Tomar firmas RPC reales de `src/domain/rpc-contracts.ts` y de `request-states.spec.ts`.
4. **No limpieza:** consultar la misma request como oráculo admin **en tests únicamente** y comprobar que `delivery_requests.notes === sentinel` y `cash_change_amount === 5000`, y que los `drop_contacts` contienen sus copias. Mantener datos sensibles fuera de logs, URLs, assertions que serialicen registros enteros y capturas.

**Antifraude RED→GREEN:** antes de implementar el spec, probar un test de fallo intencional sobre los oráculos de checkpoint (p.ej. aserción errónea de conteo de drops o valor esperado de cambio) y verificar que falla el test real contra Develop; revertir solo la mutación temporal del test, ejecutar E2E contra aplicación real en Develop y guardar el fallo RED y el GREEN final. Mejor alternativa si hay una mutación SQL de producto segura: probarla exclusivamente en base **efímera** (no sobre Supabase Develop compartido). Nunca modificar/romper el esquema compartido solo para fabricar RED.

**Scope de la corrección (cerrado):** nuevo `e2e/specs/t340-legacy-checkpoint.spec.ts`, `docs/tasks/log/T-340.md` y los mínimos ajustes de fixture **solo si una barrera técnica real impide usar las existentes, previa decisión adicional**, sin tocar código productivo del paso 2/3/4, migración ya aplicada, credenciales o workflows. El job `e2e-preview` ya descubre los specs por `--project=chromium`; no agregar otro workflow, no disparar Actions manualmente.

**Definición de cierre:** se puede registrar Gate 0 GREEN solo con **run e2e-preview del SHA que CONTIENE el nuevo test**, log con su nombre en verde y sus cuatro aserciones sobre cliente legacy real, datos de test limpiados y bitácora enlazada. Después de eso puede comenzar la implementación de lectores dentro de **esta misma PR**, no antes.

## Informe revisar-pr

Informe revisar-pr — T-340 Paso 2/4 — PR #318 — 2026-10-11 — revisión independiente, ronda 1

**Resultado: CON BLOQUEANTES (1, Gate 0 aún sin evidencia).**  
Checks locales: typecheck n.e. · lint n.e. · test n.e. · E2E checkpoint n.e. (no se creó el test).  
**BLOQUEANTE:** PR318-H01 — `docs/tasks/log/T-340.md` / CC-022 §10: no hay corrida real del cliente legacy en Supabase Develop verificando 1 drop, reintento, datos post-match y columnas legacy intactas. Autor respetó bloqueo y no adelantó código.  
**DECISIÓN resuelta:** Lautaro073 eligió **A**: nuevo spec de checkpoint en `e2e-preview` existente, documentado en ficha. No quedan decisiones abiertas.  
**No revisado:** implementación de los lectores, CI/E2E propios del paso 2, checkpoint de salida y pasos siguientes.  
**No aprobar, no mergear. PR en Draft.**
