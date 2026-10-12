# Revisión independiente — PR #318 / T-340 — Ronda 7

**Fecha:** 2026-10-12. **SHA del autor auditado:** `a71b338b2ef6b60b4594928582b9edcb175f9d63`, rama `feat/T-340-lectores` → `develop` `267e9810`; PR **Draft**, **mergeable=true**, sin commits detrás de develop. **Diferencia respecto al último commit R6 `9b7fe0f0`: 2 commits nuevos, 15 archivos** (código, tests, bitácora), **ninguno en `docs/revision-pr/pr-318/**`**. Revisados ficha desde `develop`, CC-022, comentarios R1–R6 y bitácora sesión 17:45.

## Dictamen: CON BLOQUEANTES — Paso 2 aún no listo para merge

**Hallazgos previos cerrados/verificados:** H01/H02/H03/H04/H07/H08 desde rondas anteriores; **H05 y H10 ahora verificados** por fuente + ejecución real de `unit` del SHA del autor (para H10 se importó/montó `TripCourierContainer` y se espiaron Server Actions). **H06 sigue PARCIAL**: los tres lectores del comercio ahora consultan children reales en batch, pero **aceptan cardinalidad inconsistente** y fabrican defaults desde columnas nullable. **H09 sigue PARCIAL:** E2E ahora exige HTTP200, request presente/3 drops y error P0001 del courier ajeno, pero **no hay ejecución Playwright real** porque backend Develop aún no tiene migración, y existe un nuevo agujero en el oráculo de privacidad (H12).

**Nuevos bloqueantes independientes:** **H11** test «3 drops» simula 1 y espera 1 (falso GREEN sobre clase omitida); **H12** el E2E inspecciona datos *después* de Zod `parse`, que omite propiedades adicionales por defecto, pudiendo ocultar PII presente en el JSON HTTP original.

**Ninguna decisión técnica/producto nueva pendiente.** Opción A R4 (drops[] y salida scalar del primer child sin fallback de columnas DB) y R5 (fixtures legacy solo datos) siguen siendo vinculantes. Asako cierra Paso 2, Kira realiza 3/4 y 4/4 secuencialmente después del checkpoint.

### H05 — ARREGLADO-VERIFICADO R7

`src/features/offers/queries.ts:213–229` y `src/server/live/t204.ts:209–225` exigen `reqDrops.length===declaredDropsCount` para **N=1 y N>1** en solicitudes publicadas. Ambos proyectan `packageType`, `recipientPaymentMethod`, `needsChange` y zona desde el primer **child real**, sin synthetic fallback del padre. `src/features/offers/queries.test.ts` y `src/server/live/t204.test.ts` incluyen nuevos oráculos negativos `drops_count=1/0 children` y positivos `1 child`. `unit` job `115002373677` del SHA auditado **2103 tests PASS**. No agregar fallback nuevo.

### H06 — ALTO PARCIAL: no se verifica consistencia ni cardinalidad en historial/detalle merchant

**Fuente:** `src/features/requests/queries.ts:226–289,373–423,697–747,823–891`. El author ahora trae `delivery_request_drops` por lotes para historial y activos, y por request autorizado en detalle, ordena por `position`, proyecta colección y UI multi-destino en `merchant-history-view.tsx`, `merchant-requests-list.tsx`, `request-offers-list.tsx`. **Es un progreso real y elimina la omisión anterior de source→DTO→UI.**

**Residual comprobado por fuente:** `mapRawMerchantRequests` calcula `dropsCount=req.drops_count ?? (reqDrops.length || 1)`, pero `drops=reqDrops.length>0?reqDrops:undefined` **sin comparar longitud real con `drops_count`**. Si un request `published,drops_count=3` devuelve solo 1 child (p. ej. inconsistencia por truncamiento/datos), muestra **badge «3 entregas» con un solo destino**; si no devuelve ninguno, reutiliza `req.package_type ?? 'chico'` y `recipient_payment_method ?? 'cash'` inventados. Lo mismo en `getMerchantRequestWithOffers` usando `mappedDrops`; para `draft` incompleto se puede preservar su semántica específica, pero **nunca representar `published/matched/in_transit/delivered` como 1 si N declarado no coincide**. El feed/live ya fallan cerrado en estos casos; el lector merchant debe ser igual o más riguroso. Tests positivos existentes no lo descubren (ver H11).

**Arreglo requerido:** en los mappers de **historial, activos y detalle**, antes de devolver DTO de request publicado o posterior, verificar `Number(req.drops_count)===children.length`, posiciones consecutivas y `children.length>=1` (en SQL published siempre debe materializarse al menos una); ante mismatch **error explícito**, no defaults ni `drops:undefined`. En `draft` si se consulta, decidir en código usando el estado (sin consulta ciega al padre) qué campos vacíos se permiten, preservando el comportamiento anterior. Opcionalmente centralizar `assertPublishedDropIntegrity` / `mapMerchantDrops` en el archivo `queries.ts` para que las tres rutas no diverjan. Mantener batch y accesibilidad de vistas. Probar casos `(declared=3,children=3)`, `(3,1)`, `(3,0)`, `(1,0)`, `(1,1)`, `draft sin child`, `malas posiciones`; cada método debe fallar cerrado al menos para estados publicados.

### H10 — ARREGLADO-VERIFICADO R7

El nuevo `src/features/trips/components.test.tsx:561–656` importa y **renderiza realmente `TripCourierContainer`**, con `vi.mock('./actions')` y spies: click en drop2 llama **exactamente** `markDropDeliveredAction({requestId,dropId})`, `markTripDeliveredAction` cero; error `UNAUTHORIZED_ACTOR` no hace `router.refresh`, confirma `markDropFailedAction` con motivo válido y bloquea espacios, 1 drop legacy usa la acción global. El código `trip-courier-container.tsx:54–76` coincide. `unit` CI job `115002373677` PASS. Son tests de capa de UI+orquestación con acciones mock, **no prueba E2E SQL de entrega en Develop**, que corresponde al checkpoint H09.

### H09 — PARCIAL, E2E aún sin ejecución de Paso 2

`e2e/specs/multi-drop.spec.ts:191–225` exige status 200 de `/api/live/available-requests`, parse válido, request presente, 3 drops y ausencia de valores privados; `:263–274` exige courier ajeno y error P0001 con `UNAUTHORIZED_ACTOR`. `deleteDropsErr` se comprueba; 3 zonas se crean cuando faltan. **Se cerraron las condiciones `if (liveRes.ok())` y `foreignTrip===null` sin revisar error**, previamente bloqueantes. Falta corregir **H12** (inspeccionar JSON crudo ANTES de parsearlo).

GitHub status del SHA auditado: `e2e-preview=error BLOCKED / REQUIRES DEVELOP MIGRATION` ([run 38306894225](https://github.com/cadeApp/cadeApp/actions/runs/38306894225)). **No es una ejecución roja del flujo**, porque la migración lectora aún no está en Supabase Develop hasta merge a `develop`; no ejecutar migración manual ni workflows nuevos. El checkpoint real N debe correrse pos-migración y **Kira no inicia Paso 3** antes de documentarlo en GREEN. El `pnpm test` unit no ejecuta Playwright. El seed de nuevas zonas y contactos debe comprobarse en Preview cuando el backend sea compatible, sin datos fuera de su `testRunId`.

### H11 — ALTO NUEVO, P04 test que se autoacepta con cardinalidad equivocada

**`src/features/requests/queries.test.ts:1421–1488`.** Test textualmente titulado `H06: getMerchantRequests y getMerchantHistoryRequests con parent null y 3 drops dispares` construye `parentRow.drops_count=3`, **`threeDrops=[{id:'drop-1', ...}]` con UN solo elemento**, llama **solo** `await getMerchantRequests('merchant-1', ...)` y verifica `expect(req.dropsCount).toBe(3)` **junto a** `expect(req.drops).toHaveLength(1)`. **El test pasa si el lector devuelve un resultado funcionalmente contradictorio**, y nunca llama la función de historial que dice cubrir. Una comprobación JS independiente ejecutada sobre el texto exacto del SHA reconstruyó estos valores: `declared=3,fixture=1,expected=1,called=['getMerchantRequests']`. **No es evidencia de que alguien adulteró intencionalmente tests:** sí es un control objetivamente inválido y la causa de H06 sin detectar. No reducir `drops_count` a 1 ni borrar el assert para poner verde.

**Arreglo:** separar tests: `getMerchantRequests` con TRES children reales diferentes y `req.drops.length===3` + orden y 3 zonas; `getMerchantHistoryRequests` **llamada real por separado** con parent `status='delivered'` (el historial filtra terminales; usar estado correcto) y mismo N→3; `getMerchantRequestWithOffers` test positivo ya tiene 3 children, conservarlo. Luego nuevos tests negativos `3/1`, `3/0`, `1/0` para cada lector merchant publicado, deben mostrar **RED** con código actual y GREEN tras validación. Tener `as unknown as` en mocks existentes no excusa oráculos auto-referenciales. La prueba nunca debe autoaprobárselas solo porque el mock devuelve lo que el assert espera.

### H12 — ALTO NUEVO, P08: el E2E borra claves PII antes de inspeccionarlas

**`e2e/specs/multi-drop.spec.ts:194–225` y `src/lib/live-contracts.ts:7–22,58–60`.** Actualmente:
```ts
const rawLiveFeed = await liveRes.json();
const parsedFeed = liveFeedResponseSchema.parse(rawLiveFeed);
const ownRequestFeed = parsedFeed.data.find(x => x.id === requestId);
const serializedRequest = JSON.stringify(ownRequestFeed);
expect(serializedRequest).not.toContain('3865111111');
```
Pero `liveAvailableRequestItemSchema = z.object({...})` y `liveFeedResponseSchema = z.object({...})`: **Zod `z.object` elimina claves adicionales por defecto al parsear**. Si el servidor serializa `recipientPhone:'3865111111'` en el JSON original, el `parsedFeed` puede haber eliminado esa clave y todas las aserciones `not.toContain` quedan **GREEN pese a fuga real de privacidad en red**. `.parse` valida el contrato proyectado, **no sirve como prueba de que el transporte no incluyó campos extra**.

**Arreglo exacto:** (1) conservar `liveFeedResponseSchema.parse(rawLiveFeed)` para validar los campos necesarios, **pero antes inspeccionar y hacer assertions sobre `rawLiveFeed` sin transformar**, localizando el raw item por `requestId`. (2) Probar recursivamente **ausencia de CLAVES** `recipient_name,recipientName,recipient_phone,recipientPhone,dropoff_address,dropoffAddress,dropoff_lat,dropoffLat,dropoff_lng,dropoffLng,notes,deliveryNotes,cash_change_amount,cashChangeAmount`, y ausencia de los valores marcadores en **el JSON crudo**. (3) Añadir un test unitario del **oráculo de privacidad** que inyecte `recipientPhone` y `notes` en un raw response que sea válido respecto de los campos públicos; debe FALLAR el detector (**RED**) aunque `.parse` los omita. Luego GREEN con respuesta cruda segura; no modificar contrato para que silencie la evidencia ni confiar solo en DOM.

## Checks del SHA exacto auditado

| Job/estado | Resultado |
|---|---|
| `CI` [run 38306695743](https://github.com/cadeApp/cadeApp/actions/runs/38306695743) | **SUCCESS** |
| `db-tests` [job 115002373648](https://github.com/cadeApp/cadeApp/actions/jobs/115002373648) | **PASS**, 21 suites, **1995 tests**, incluidas CC008/CC023 y T-340, ensayo H15 RED→GREEN de infra |
| `unit` [job 115002373677](https://github.com/cadeApp/cadeApp/actions/jobs/115002373677) | **PASS**, 128 test files, **2103 tests**, cobertura `rpc-fake.ts` statements 95,32 % / branches 91,35 % |
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | **PASS** |
| Vercel | **SUCCESS** |
| `approval-policy` | FAIL (no equivale a aprobación independiente) |
| `e2e-preview` | **ERROR/BLOCKED**, requiere backend Develop migrado; **sin GREEN N** |

**Limitación honesta:** No se ejecutaron Docker/Supabase local, Playwright real, ni despliegue remoto por la revisión. **Se inspeccionó código y tests del SHA exacto; logs reales CI sí fueron leídos.** Las pruebas unit existentes cubren happy path con mocks, pero no prueban cardinalidad incorrecta, y el nuevo oráculo E2E puede ocultar unknown keys Zod. La **única prueba propia ejecutada** fue un análisis JS en memoria sobre los blobs de fuente que confirmó `3/1 expected1`, ausencia de llamada a history, parse previo a inspect, y status del CI. **No se finge un mutation RED runtime** del producto. Harness reproducible y propuesta de mutaciones reales en `evidencia/comandos.md`.

## Informe revisar-pr

Informe revisar-pr — T-340 / PR #318 — 2026-10-12 — revisión independiente R7.

**Resultado: CON BLOQUEANTES.** H01/H02/H03/H04/H05/H07/H08/H10 = arreglado-verificado. H06 = **PARCIAL bloqueante** (integridad de N en lectores merchant). H09 = **PARCIAL/PENDIENTE** (E2E no ejecutable premerge y oráculo crudo corregible ahora). **H11 nuevo** test «3 drops» que prueba 1 y acepta 1. **H12 nuevo** Zod elimina PII desconocida antes de aserción de privacidad HTTP.

**Decisiones abiertas:** ninguna. Autorizaciones R4 A y R5 A intactas; no habilitar writer multi-drop ni limpiar legacy.
**Checks locales revisor:** unit/typecheck/lint/test:db n.e. (sin clon); CI remoto exacto verde `db-tests` 1995 y `unit` 2103. **E2E real pendiente por entorno**, no tratarlo como éxito ni introducir cambios remotos por cuenta propia.
**Acción:** Asako corrige cardinalidad/historial y tests H11, oráculo de JSON crudo H12, aporta RED→GREEN; nueva ronda 8. PR Draft, no aprobar, no mergear, no comenzar Paso 3 con Kira.
