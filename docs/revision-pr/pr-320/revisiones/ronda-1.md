# PR #320 — Ronda 1 — 2026-10-12

**SHA analizado:** `3f23e01d22e3d32ffa5be5e42d07f5ca13092d85`; **base:** `0ab96d94`; **Draft, sin merge**; 5 archivos cambiados de fixtures y E2E.

**Conflicto de independencia declarado:** este diagnóstico lo hace el mismo asistente que programó el fix #320. No es la firma de revisión independiente necesaria para merge ni para cambiar `approval-policy`. Los hallazgos de logs y lectura son verificables; un revisor distinto debe corroborarlos.

## Dictamen: CON BLOQUEANTES — no mergear

**Correcto:** quitar la falsa obligación `createdZoneIds[0]` en `multi-drop.spec.ts`; mantener las aserciones reales de 3 entregas, PII crudo y courier ajeno; materializar 1 drop y contacto privado en `seedStagingData` *con contactos*; tests unitarios con FK; preparar T-342/T-345 con datos de `drop_contacts`. Sin edición de lectores, RLS, migraciones, secretos ni workflows.

### H01 — BLOQUEANTE ALTO: segundo fixture aún crea estados no-draft sin drops

En `src/server/e2e/staging-seed.ts`, `seedDeliveryRequestInState` inserta `status:options.status` para `published`, `matched`, `in_transit` y `delivered` **sin escribir en** `delivery_request_drops` ni `delivery_request_drop_contacts`. Los tests unitarios de este helper tampoco validan los hijos. Debe crear contactos/drop 1 y datos completos ANTES de hacer visible el estado distinto de draft, preservando oferta aceptada, marcas temporales y casos draft negativos.

### H02 — BLOQUEANTE ALTO: rama sin contactos de `seedStagingData` y ventana visible incoherente

La inserción del parent usa `status:'published'`; el drop y su contacto solo se crean dentro de `if(options?.withContacts || options?.recipientPhone)`. Con `requestsCount>0`, `withContacts:false`, produce 0 drops. Incluso con contactos, primero hace visible el padre `published`. Debe haber un invariante de fixture publicado válido **independiente de opcionales**, y finalización de estado tras hijos, fallando cerrado ante errores SQL. No reemplazar por mocks.

### H03 — BLOQUEANTE MEDIO: T-343 actualiza columnas legacy

`e2e/specs/courier-feed-vocabulary.spec.ts` actualiza `delivery_requests.package_type='grande'` y `recipient_payment_method='to_agree'`; los lectores en `src/features/offers/queries.ts` y `src/server/live/t204.ts` leen de **drop 1**. Al repararse el feed, el test seguirá preparando `chico/cash` en el drop (deducción por código, no fallo de esa aserción todavía). Preparar las propiedades canónicas en `delivery_request_drops`, manteniendo el test del payload en vivo y de UI.

### H04 — BLOQUEANTE MEDIO: selector T-303 ambiguo

Playwright en `e2e/specs/main-flow.spec.ts:535` marca `strict mode violation`: `e2e/pages/trip.page.ts` usa `getByText(/^entregado$/i)`, que coincide con dos etiquetas de estado entregado. Corregir el scope por rol/etiqueta/contenedor real; no usar `.first()`, `toHaveCount(2)` ni suprimir la afirmación para simular aprobación.

### H05 — BLOQUEANTE OPERATIVO: fila inválida en Develop bloquea todos los feeds

Logs del Preview Vercel `dpl_2YWRezV6nh2Ti1WBQfYqf3fUiqQp` muestran repetidamente en `GET /courier/feed`: `Inconsistencia ... drops_count=1 pero no se encontraron entregas`. Por el guard de `src/features/offers/queries.ts` el SSR falla y no se ven las cards de requests válidas. En el [job 115052584011](https://github.com/cadeApp/cadeApp/actions/runs/38322166091/job/115052584011), `multi-drop.spec.ts:182` y varios otros tests fallan con `locator('[data-testid="request-card"]...') element(s) not found`. **No debilitar el fail-closed del lector**. Diagnosticar procedencia de la fila por medios read-only y ejecutar una recuperación **solo si** se prueba que es dato transitorio E2E y existe autorización explícita; no borrar datos remotos sin control.

### H06 — MEJORA: Realtime T-345 intermitente

El E2E `courier-private-columns.spec.ts` tuvo un intento FAIL por 0 eventos, segundo intento PASS. No rebajar oráculos PostgREST 42501 ni prueba de payload Realtime sin PII; capturar condición temporal y corregir solo con diagnóstico reproducible.

### H07 — BLOQUEANTE de gates/proceso

- [CI run 38321991209](https://github.com/cadeApp/cadeApp/actions/runs/38321991209): unit **129 suites/2116 tests PASS**, db-tests **21/1995 PASS**, drift `db:types` verificado; typecheck/lint/build/audit/bundle PASS; Vercel READY.
- [E2E run 38322166091](https://github.com/cadeApp/cadeApp/actions/runs/38322166091): **61 passed; 10 failed; un spec T-345 flaky; job `cancelled` por timeout 30m**. `multi-drop.spec.ts` FAIL 3 intentos; `t340-legacy-checkpoint.spec.ts` PASS. Un dispatch con job `skipped` no cuenta como GREEN.
- `approval-policy` falla por falta de informe independiente genuino. No firmar propia implementación como revisión independiente.

## No revisado/limitaciones

No hay clon ni ejecución local en esta sesión. Se contrastaron SHA remoto, diff, CC-022 y ficha T-340 desde Develop, CI y logs reales de GitHub + Vercel. La identidad/origen de la fila huérfana no se confirmó por SQL, así que no se afirma cuál test la creó. Mutaciones RED→GREEN quedan requeridas al autor en la ronda correctiva. No mergear ni iniciar Paso 3.
