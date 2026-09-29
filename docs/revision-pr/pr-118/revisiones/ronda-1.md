# Ronda 1 — PR #118 (`T-206`) — revisión independiente

- **PR:** #118 · `feat/T-206-cableado-push` → `develop`
- **SHA de producto revisado:** `f1d2d096cdcddc68633270c5b8b5805b4daff035`
- **develop:** `57badabc28fd3bd8e913674bd80b30feb8828414`
- **Fecha:** 2026-09-28
- **Resultado:** **CON BLOQUEANTES**
- **Decisión D01:** Lautaro073 eligió **1-A**.

## 1. Inicio de ronda y alcance

La rama está 4 commits adelante y 0 atrás de `develop`; GitHub la reporta mergeable. El diff contiene 12 archivos y todos están dentro de la lista permitida de T-206. La modificación de `docs/tasks/T-206.md` solo marca el DoD como completado; no amplía archivos ni dependencias.

No existía `docs/revision-pr/pr-118/` en la rama antes de esta revisión.

## 2. Qué está bien por inspección

- `publish_request`, `submit_offer`, `accept_offer` y `cancel_request` ubican el cableado después de una respuesta RPC exitosa.
- `runSweep` solo intenta notificar solicitudes presentes en `updatedRequests`, no en el select previo.
- Los payloads T-206 usan solo `requestId`/`offerId`; no aparece PII nueva.
- Logout y las tres rutas administrativas de suspensión/deshabilitación purgan después del éxito de negocio y contienen fallos como best-effort.

## 3. Bloqueantes

### PR118-H01 — replay idempotente de accept_offer genera un segundo push

El contrato canónico de `accept_offer` devuelve éxito con `idempotent:true` cuando la misma oferta ya estaba aceptada. En `acceptOfferRpc`, el bloque T-206 se ejecuta después de parsear cualquier salida exitosa, sin comprobar `idempotent`. Por lo tanto un retry/replay de la misma operación vuelve a resolver merchant+courier y emite otro `offer_accepted`, aunque no hubo transición nueva.

**Corrección:** cortar antes de cualquier side effect cuando `parsedOutput.data.idempotent === true`, y agregar test que exija cero `createAdminClient`/cero `safeNotifyPostTransition` en ese caso.

### PR118-H02 — cancel_request notifica actores que no fueron afectados

La implementación hace un select de **todas** las ofertas por `request_id` y agrega además siempre al merchant. Eso incluye couriers con ofertas viejas `rejected`, `withdrawn` o `expired`, y además notifica al merchant que acaba de cancelar su propia solicitud.

El `master-plan` especifica que `matched → cancelled` notifica al repartidor asignado. D01/1-A completa la semántica de esta ronda:

- merchant cancela `published`: solo couriers cuyas pending pasan a expired;
- merchant cancela `matched`: solo courier aceptado;
- admin cancela `in_transit`: merchant + courier asignado;
- nunca couriers históricos.

**Corrección:** derivar couriers de ofertas decididas en esa transición (usando `cancelledAt`/estado final) e identificar el actor de `cancel_request` desde auditoría para decidir si corresponde incluir al merchant.

### PR118-H03 — request_expired pierde la lista exacta de offers actualizadas

El sweep hace correctamente un update de `offers` con `status='pending'`, pero no pide las filas actualizadas. Después ejecuta un select nuevo por `request_id` sin estado y avisa a cualquier courier que alguna vez ofertó.

Esto repite la clase de AG-74: el efecto colateral debe salir de las filas que devolvió el update que decidió el cambio.

**Corrección:** agregar `.select('request_id, courier_id')` al update de pending, agrupar esas filas y construir cada push con merchant + couriers realmente expirados.

### PR118-H04 — los tests no protegen la selección real de destinatarios

La clase completa:

- `publish_request`: los mocks ignoran argumentos de `.eq()`; cambiar `approved` por `rejected` o `available:true` por `false` puede seguir verde.
- `submit_offer`: no se afirma el `requestId` usado para obtener al merchant.
- `accept_offer`: no se afirman los IDs usados para buscar request y offer.
- cancel/expire usan `arrayContaining`, de modo que destinatarios extra pasan.
- las fixtures no contienen suficientes filas históricas para demostrar exclusión.

**Corrección:** afirmar predicados exactos y conjuntos exactos; para conjuntos sin orden usar tamaño + `Set`, no `arrayContaining`.

### PR118-H05 — falta la mutación RED que la propia ficha exige

La bitácora registra una fase RED antes de implementar: nueve tests fallan porque todavía no existe el cableado. Eso demuestra ausencia de funcionalidad, pero no demuestra que el control sea sensible a las mutaciones pedidas por el DoD.

En particular falta evidencia de:
- mover el push de `publish_request` antes de terminar la RPC;
- romper filtros de elegibilidad;
- introducir destinatarios históricos/extra;
- después del arreglo, quitar la guarda de idempotencia.

La siguiente sesión debe ejecutar esas mutaciones sobre el GREEN sin cambiar los tests para acomodarlas y registrar las líneas RED/GREEN reales.

## 4. Mejora de evidencia

### PR118-M01 — test:db no es “n.a.”

La PR toca varios archivos en `src/server/**`, por lo que AGENTS exige `test:db`. No hace falta correr Docker local: la política de revisión permite usar el job CI.

Se inspeccionó `db-tests` del workflow asociado al head/merge ref:

```text
All tests successful.
Files=12, Tests=1601
Result: PASS
```

La bitácora y el cuerpo de la PR deben distinguir “no ejecutado localmente” de “CI db-tests verde”; no dejar `n.a.`.

## 5. Limitación de esta ronda

Esta sesión tuvo acceso al repositorio mediante el conector de GitHub pero no a un checkout ejecutable con dependencias; no se declaran mutaciones locales como ejecutadas. Los hallazgos H01-H04 son deterministas por flujo y por la forma de los mocks/aserciones. La Ronda 2 debe reejecutar de forma independiente las mutaciones que el autor registre.

## Informe revisar-pr

```text
Informe revisar-pr — T-206 — 2026-09-28 — generado por revisión independiente
Resultado: CON BLOQUEANTES
SHA revisado: f1d2d096cdcddc68633270c5b8b5805b4daff035
develop: 57badabc28fd3bd8e913674bd80b30feb8828414
Checks del revisor: typecheck no ejecutado · lint no ejecutado · test no ejecutado · db-tests CI ✅ (Files=12, Tests=1601, Result: PASS)
BLOQUEANTES:
- PR118-H01: accept_offer emite push también en replay idempotent:true.
- PR118-H02: cancel_request envía a merchant/couriers históricos en vez de solo afectados.
- PR118-H03: request_expired reconsulta todas las offers y puede avisar a couriers no expirados por ese sweep.
- PR118-H04: tests no protegen predicados exactos ni destinatarios extra.
- PR118-H05: falta evidencia de mutaciones RED semánticas exigidas por la ficha.
MEJORAS:
- PR118-M01: corregir evidencia test:db n.a.; CI sí ejecutó y pasó db-tests.
Decisión resuelta:
- D01 = 1-A.
```

## Prompt de corrección para KiraK72

```text
Tarea: T-206, PR #118, rama feat/T-206-cableado-push.

0. `git pull` primero: trae el commit de revisión que esté en la rama. Sin rebase, force-push ni amend.

Podés tocar SOLO:
- `src/server/rpc/requests.ts`
- `src/server/rpc/requests.test.ts`
- `src/server/rpc/offers.ts`
- `src/server/rpc/offers.test.ts`
- `src/server/cron/sweep.ts`
- `src/server/cron/sweep.test.ts`
- `docs/tasks/log/T-206.md`

No hace falta tocar `src/features/auth/**` ni `src/server/rpc/admin.*` salvo que una prueba existente falle por regresión real; si pasa, frená y explicá antes de ampliar.

Prohibido:
- `docs/revision-pr/**` (es de la revisión)
- editar `docs/tasks/T-206.md`
- dependencias o migraciones nuevas
- crear archivos auxiliares dentro del repo; si necesitás scripts, `/tmp`
- marcar hallazgos como “verificados”
- rebase, force-push o amend
- crear tests falsos, tautológicos o adulterar mocks/expectativas para que pasen en verde. Los tests tienen que fallar por la propiedad rota y pasar por la corrección real.

Aplicá la decisión humana **D01/1-A**: cancelación/expiración notifican únicamente a actores afectados por ESA transición; no a couriers históricos.

### 1. PR118-H01 — accept_offer idempotente no genera otro push

En `src/server/rpc/offers.ts`, después de validar `parsedOutput`, si `parsedOutput.data.idempotent === true`, devolvé `ok(parsedOutput.data)` antes de crear `createAdminClient()` o resolver destinatarios. El envío actual queda solo para `idempotent:false`.

En `src/server/rpc/offers.test.ts` agregá un caso T-206 donde la RPC devuelve un output válido con `idempotent:true`. Espiá `safeNotifyPostTransition` y `createAdminClient`; esperá resultado exitoso y **cero** resolución/envío push.

**RED obligatorio:** quitá temporalmente la guarda de idempotencia sin tocar el test. El test nuevo debe fallar porque se intenta resolver/enviar el push. Revertí solo esa mutación y dejá GREEN.

### 2. PR118-H02 — cancel_request con destinatarios exactos

No vuelvas a seleccionar todas las ofertas por `request_id`.

Usá `cancelledAt` devuelto por la RPC para identificar solo ofertas alteradas en esa cancelación: filas de la request con `decided_at = cancelledAt` y estado final `expired` o `cancelled`. De ahí salen los couriers afectados.

Obtené `merchant_id` del request. Identificá el actor de `cancel_request` desde `audit_log`: `target_type='delivery_request'`, `target_id=reqId`, `action='cancel_request'`, última fila de esa transición.

Reglas exactas:
- merchant cancela `published`: push solo a couriers cuyas `pending` pasaron a `expired`; no al merchant.
- merchant cancela `matched`: push solo al courier de la oferta aceptada que pasó a `cancelled`; no al merchant ni a couriers históricos.
- admin cancela `in_transit`: push al merchant + courier asignado; no a terceros.

Dedupe con `Set`; si no hay destinatarios, no llames al emisor.

En `src/server/rpc/requests.test.ts` hacé una matriz de esos 3 escenarios. Incluí explícitamente ofertas históricas `rejected`, `withdrawn` y/o `expired` y comprobá que no aparecen. No uses `arrayContaining`: capturá el primer argumento de `safeNotifyPostTransition`, comprobá tamaño exacto y compará el `Set` exacto.

**RED obligatorio:** quitá temporalmente el filtro de `decided_at` o incluí una oferta histórica. El test debe fallar por destinatario extra.

### 3. PR118-H03 — runSweep usa las filas realmente actualizadas

En `src/server/cron/sweep.ts`, al update:
`offers.update({ status:'expired', decided_at: nowIso }).in('request_id', actuallyExpiredIds).eq('status','pending')`
agregale `.select('request_id, courier_id')`.

Usá esas filas devueltas para agrupar couriers por `request_id`; no hagas luego `select('courier_id').eq('request_id', req.id)`.

Por cada `updatedRequest`, destinatarios exactos = merchant de esa request + couriers de filas que ese update acaba de cambiar. Dedupe con `Set`. Conservá el error del update como bloqueante del sweep exactamente como hoy.

En `src/server/cron/sweep.test.ts`, agregá una oferta histórica no-pending del mismo request y exigí que no sea destinataria. Para dos requests expiradas, verificá además que no se crucen couriers entre requests.

**RED obligatorio:** reemplazá temporalmente el uso de las filas del `.select()` por un select general de todas las offers del request. El test debe fallar por destinatario extra.

### 4. PR118-H04 — endurecer la clase completa de selección de destinatarios

- `publish_request`: afirmá exactamente `.eq('status','approved')` y `.eq('available', true)`. El mock no puede ignorar silenciosamente esos argumentos. Outbound exacto, sin extras.
- `submit_offer`: afirmá `.eq('id', REQ_1_ID)` en la lectura de `delivery_requests`.
- `accept_offer`: afirmá `.eq('id', requestId)` para `delivery_requests` y `.eq('id', acceptedOfferId)` para `offers`; outbound exacto merchant+courier en `idempotent:false`.
- `cancel_request` y `request_expired`: aplicar los conjuntos exactos de los pasos 2 y 3.
- Para conjuntos sin orden contractual, compará `Set` + tamaño; no `arrayContaining`.

**RED obligatorio:** uno por predicado: cambiá temporalmente `approved` por `rejected`, `available:true` por `false`, y uno de los IDs de lookup por otro UUID. Cada mutación debe hacer fallar el test correspondiente.

### 5. PR118-H05 — evidencia RED semántica real

No alcanza con “antes de implementar faltaba el cableado”.

Ejecutá las mutaciones de los pasos 1–4 sobre el GREEN sin modificar los tests para acomodarlas. Además, para el orden post-commit de `publish_request`, mové temporalmente la llamada/resolución push antes de que termine la RPC o alterá la implementación de manera equivalente que haga que el test observe `rpcExecuted === false`. Ese test debe quedar RED.

Pegá en una **nueva entrada append-only** de `docs/tasks/log/T-206.md` por cada clase: mutación concreta + línea de resumen `Tests ...` RED; luego el GREEN final. No inventes salidas.

### 6. PR118-M01 — corregir la evidencia de test:db

No levantes Docker/Supabase local solo para esto.

En una nueva entrada de bitácora aclarar: local no ejecutado; CI `db-tests` de la revisión anterior sí ejecutó Supabase/pgTAP y dio `Files=12, Tests=1601, Result: PASS`.

Al actualizar el cuerpo de la PR, reemplazá `test:db n.a.` por esa distinción; no afirmes que lo corriste localmente. Después del push, usá la nueva corrida normal de CI para la evidencia final de db-tests.

### Comandos finales

- `pnpm typecheck`
- `pnpm lint`
- `pnpm vitest run src/server/rpc/requests.test.ts src/server/rpc/offers.test.ts src/server/cron/sweep.test.ts`
- `pnpm test`
- no levantes Supabase/Docker local; `db-tests` se verifica en CI.

Al terminar:
- agregá una entrada nueva a `docs/tasks/log/T-206.md` con hecho / mutaciones RED reales / GREEN / falta;
- no escribas “verificado”;
- commit Conventional Commits terminado en `[T-206]`;
- push;
- pegá la salida de `git ls-remote origin feat/T-206-cableado-push`;
- no toques `docs/revision-pr/**`.

```
