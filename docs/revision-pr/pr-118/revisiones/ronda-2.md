# Ronda 2 — PR #118 (`T-206`) — revisión independiente

- **SHA revisado:** `aba405dd4544af13d85cdd0b3e26a1f8bca8e07d`
- **Parent de correcciones:** `8cfd6402f2525a1815c09d886bf505541a478cdf`
- **develop:** `57badabc28fd3bd8e913674bd80b30feb8828414`
- **Fecha:** 2026-09-28
- **Resultado:** **CON BLOQUEANTES**
- **Decisiones nuevas:** ninguna.

## 1. Sincronización y alcance

La rama está 6 commits adelante y 0 atrás de develop. Entre el commit de revisión de Ronda 1 y el nuevo head hay un único commit de KiraK72, `aba405dd...`.

Ese commit toca exactamente los 7 archivos autorizados por el prompt de corrección:
- `docs/tasks/log/T-206.md`
- `src/server/rpc/requests.ts`
- `src/server/rpc/requests.test.ts`
- `src/server/rpc/offers.ts`
- `src/server/rpc/offers.test.ts`
- `src/server/cron/sweep.ts`
- `src/server/cron/sweep.test.ts`

No tocó `docs/revision-pr/pr-118/**`.

## 2. Revalidación de Ronda 1

### H01 — corregido por implementación

`acceptOfferRpc` corta con `ok(parsedOutput.data)` cuando `idempotent:true` antes de crear el admin client o resolver destinatarios. El test nuevo exige cero admin lookup y cero push.

El CI ejecuta el test dentro de la suite verde. Se mantiene como corregido pero la evidencia de mutación independiente queda ligada a H05.

### H02 — corregido por implementación

`cancel_request` usa `cancelledAt`, filtra ofertas por la request, el timestamp de decisión y `status in ('expired','cancelled')`. El SQL canónico confirma que el RPC usa el mismo `v_now` para `offers.decided_at` y para el `cancelledAt` devuelto.

También consulta auditoría para diferenciar actor merchant/admin. La matriz de tests ahora compara conjuntos y tamaños exactos.

Queda un residual de control en H04: los mocks de auditoría ignoran sus argumentos.

### H03 — corregido en la idea, con regresión de control

La reconsulta amplia de offers fue eliminada y los couriers se agrupan por `request_id` a partir de las filas actualizadas.

Sin embargo el arreglo agregó un fallback condicional que permite seguir aunque el builder no tenga `.select()`; se registra como PR118-R01.

### H04 — PARCIAL

Mejoras reales:
- publish afirma `status=approved` y `available=true`;
- submit/accept afirman IDs exactos;
- los conjuntos usan longitud + `Set` exacto;
- cancel afirma `request_id`, `decided_at` y estados.

Residual:
- los mocks de `audit_log` son cadenas de `vi.fn().mockReturnValue(...)` que devuelven el mismo actor sin mirar `target_type`, `target_id`, `action`, `order` ni `limit`.
- mutar `action='cancel_request'` por otra acción puede seguir verde.
- el mock de offers no soporta de forma semántica quitar el paso de `decided_at`; esa mutación tiende a fallar por forma de chain/mock y no necesariamente por destinatario histórico extra.

### H05 — ABIERTO

La entrada 02:05 de la bitácora lista mutaciones realizadas, pero no conserva:
- comando exacto por mutación;
- nombre del test rojo;
- línea real `Test Files ...`;
- línea real `Tests ...`;
- GREEN posterior.

Por lo tanto la evidencia no es reproducible. Además el caso `cancel_request sin decided_at` no puede demostrarse como rojo semántico con el mock actual, que no ofrece un `.in()` directo después del primer `.eq(request_id)`.

### M01 — corregido

El cuerpo y la bitácora distinguen local no ejecutado vs CI. En el nuevo SHA el job db-tests volvió a pasar:
`Files=12, Tests=1601, Result: PASS`.

## 3. Nuevos hallazgos

### PR118-H06 — getUser() puede impedir el logout

En `logoutAction`, `await supabase.auth.getUser()` ocurre antes del `try` de la purga.

Si esa llamada rechaza por red/excepción, nunca se alcanza `signOut()`. Eso contradice el objetivo best-effort del hook de lifecycle: fallar la resolución/purga de push no debe bloquear el cierre de sesión.

**Arreglo:** envolver resolución de usuario + purga en el mismo try best-effort; `signOut()` queda fuera.

**Test:** `getUser.mockRejectedValue(...)` debe conservar resultado ok y llamar `signOut` una vez.

### PR118-H07 — errores in-band pueden producir push parcial/incorrecto

Los lookups de Supabase no siempre lanzan; normalmente devuelven `{ data, error }`.

- `accept_offer`: si falla el lookup de merchant pero el de courier tiene data, hoy se envía solo al courier, aunque el DoD exige ambas partes.
- `cancel_request`: si falla el lookup de auditoría, `actorId` queda undefined y un merchant que canceló puede terminar incluido como destinatario, violando D01.
- Los bloques best-effort deben fallar cerrados: si la resolución necesaria de destinatarios tiene `error`, no se envía push y se conserva el resultado exitoso de negocio.

Publish/submit deben seguir la misma convención: error de resolución => cero emisión.

### PR118-R01 — fallback de .select() en código productivo

El arreglo de H03 no encadena `.select()` de forma obligatoria. Construye `offersUpdateBuilder`, pregunta con `typeof ...select`, y si no existe continúa esperando el builder.

Todos los mocks actuales ya pueden y deben implementar el contrato real. Este fallback es un escape productivo para una interfaz que en Supabase sí tiene `.select()`, y debilita la propiedad que H03 buscaba garantizar.

**Arreglo:** cadena directa e incondicional terminada en `.select('request_id, courier_id')`.

## 4. Evidencia de CI

Run `36380194256` asociado al SHA revisado:
- unit: `Test Files 92 passed (92)`, `Tests 1255 passed (1255)`;
- verify-workflows: 22 tests;
- verify-adr: 6 tests;
- db-tests: `All tests successful. Files=12, Tests=1601. Result: PASS`;
- typecheck, lint, build, audit y bundle-budget: success.

El cuerpo de la PR todavía dice 1254 tests y 21 verify-workflows; PR118-M02 pide corregir esa evidencia.

## 5. Limitación del revisor

La revisión actual se hizo por inspección exacta del SHA y lectura de logs de CI; no hubo checkout ejecutable local para correr una batería de mutaciones independiente. Por eso H05 permanece abierto y los arreglos H01-H03 no se consideran cerrados únicamente por la afirmación del autor.

## Informe revisar-pr

```text
Informe revisar-pr — T-206 — Ronda 2 — 2026-09-28
Resultado: CON BLOQUEANTES
SHA revisado: aba405dd4544af13d85cdd0b3e26a1f8bca8e07d
develop: 57badabc28fd3bd8e913674bd80b30feb8828414
CI: unit ✅ 92/92 · 1255/1255 · db-tests ✅ 12/1601 · typecheck/lint/build ✅

R1:
- H01: implementación corregida; pendiente evidencia de mutación reproducible.
- H02: implementación corregida; residual de audit_log cubierto por H04.
- H03: implementación corregida; regresión R01.
- H04: PARCIAL — audit_log no está protegido semánticamente.
- H05: ABIERTO — evidencia RED narrativa/no reproducible.
- M01: CORREGIDO — db-tests CI PASS.

NUEVOS BLOQUEANTES:
- PR118-H06: getUser() fuera del try puede impedir signOut().
- PR118-H07: errores in-band de resolución pueden generar push parcial/incorrecto.
- PR118-R01: fallback condicional permite continuar sin el select de filas actualizadas.

MEJORA:
- PR118-M02: cifras del cuerpo de PR no coinciden con CI (1254/21 vs 1255/22).
```

## Prompt de corrección

```text
Tarea: T-206, PR #118, rama feat/T-206-cableado-push.

0. `git pull` primero: trae el commit de revisión de Ronda 2. Sin rebase, force-push ni amend.

Podés tocar SOLO:
- `src/server/rpc/requests.ts`
- `src/server/rpc/requests.test.ts`
- `src/server/rpc/offers.ts`
- `src/server/rpc/offers.test.ts`
- `src/server/cron/sweep.ts`
- `src/server/cron/sweep.test.ts`
- `src/features/auth/actions.ts`
- `src/features/auth/actions.test.ts`
- `docs/tasks/log/T-206.md`
- cuerpo de la PR #118

Prohibido:
- `docs/revision-pr/**`
- editar `docs/tasks/T-206.md`
- dependencias o migraciones nuevas
- archivos auxiliares dentro del repo; scripts temporales van en `/tmp`
- marcar hallazgos como “verificados”
- rebase, force-push o amend
- tests falsos, tautológicos, mocks que ignoren la propiedad bajo prueba, o cambiar expectativas/mocks para forzar verde.

Mantener D01/1-A sin cambios.

1. **PR118-H04 — cerrar el hueco restante en los predicados de audit_log y hacer semántica la mutación de cancel_request.**

En `src/server/rpc/requests.test.ts`, los mocks de `audit_log` no pueden devolver el mismo actor ignorando argumentos. Construí un mock semántico/registrador que valide y modele exactamente:
- `.eq('target_type', 'delivery_request')`
- `.eq('target_id', requestId)`
- `.eq('action', 'cancel_request')`
- `.order('created_at', { ascending: false })`
- `.limit(1)`

La fixture debe contener al menos:
- un audit de `cancel_request` para esa request con actor merchant/admin según el escenario;
- un audit de otra acción o de otra request con actor distinto.

El query mock debe aplicar los filtros acumulados; no devolver siempre el actor esperado.

Además, rehacé el mock de offers de cancelación para que tras `.eq('request_id', requestId)` soporte semánticamente tanto:
- el camino correcto `.eq('decided_at', cancelledAt).in(...)`
- como una implementación mutada que omita `decided_at` y haga `.in(...)` directamente.

Si se omite `decided_at`, debe devolver también una oferta histórica `expired/cancelled` de otro momento, de modo que falle por **destinatario extra**, no por TypeError ni por forma del mock.

RED obligatorios, sin tocar tests durante la mutación:
- `action='cancel_request'` → `action='publish_request'`: falla por actor/destinatarios incorrectos o aserción exacta del predicado.
- quitar `.eq('decided_at', cancelledAt)`: falla porque entra la oferta histórica extra.
- `target_id=reqId` → otro UUID: falla semánticamente.

2. **PR118-H05 — evidencia RED reproducible, no narrativa.**

La bitácora actual enumera mutaciones pero no contiene las líneas reales de salida pedidas.

Ejecutá de nuevo las mutaciones finales sobre el GREEN y agregá una entrada nueva append-only en `docs/tasks/log/T-206.md`. Para CADA mutación registrá:
- archivo/símbolo mutado;
- cambio exacto;
- comando ejecutado;
- nombre del test que falla;
- líneas reales de resumen de Vitest, incluyendo `Test Files ...` y `Tests ...`;
- luego el resumen GREEN después de revertir la mutación.

Como mínimo registrar:
- accept_offer sin guarda idempotente;
- publish available true→false;
- publish emisión antes de terminar la RPC;
- cancel action incorrecta;
- cancel sin decided_at;
- sweep dispersando couriers entre requests;
- sweep sin `.select('request_id, courier_id')`.

No inventes salidas ni copies resultados esperados. Si una mutación falla por TypeError/setup del mock en vez de por la propiedad, corregí el mock y repetí: ese rojo NO cuenta.

3. **PR118-H06 — getUser() no puede impedir logout.**

En `src/features/auth/actions.ts`, meté la resolución de usuario y la purga dentro del bloque best-effort. `supabase.auth.signOut()` debe quedar fuera y ejecutarse aunque `getUser()`, `createAdminClient()` o `delete().eq()` lancen.

Patrón esperado:
```ts
const supabase = await createClient();

try {
  const user = typeof supabase.auth.getUser === 'function'
    ? (await supabase.auth.getUser()).data?.user
    : null;

  if (user?.id) {
    const admin = createAdminClient();
    await admin.from('push_subscriptions').delete().eq('user_id', user.id);
  }
} catch {
  // best-effort purge
}

await supabase.auth.signOut();
return ok(null);
```

En `actions.test.ts` agregá:
- `getUser.mockRejectedValue(new Error('network'))` → `signOut` llamado exactamente una vez y resultado `ok:true`.
- `delete().eq()` rechazando → `signOut` llamado exactamente una vez y resultado `ok:true`.

RED:
- mover temporalmente `getUser()` fuera del try: el primer test debe fallar.
- quitar el catch de la purga: el segundo test debe fallar.

4. **PR118-H07 — resolución de destinatarios debe fallar cerrada ante errores in-band.**

Los errores de Supabase llegan muchas veces como `{ error }`, no como throw. No envíes un push parcial o a un actor incorrecto cuando no pudiste resolver todos los destinatarios.

En `acceptOfferRpc`:
- después de `Promise.all([reqRes, offerRes])`, si `reqRes.error || offerRes.error`, lanzá/abortá el bloque best-effort antes de construir `parties`.
- si cualquiera falla, resultado de negocio sigue `ok` y `safeNotifyPostTransition` NO se llama.

En `cancel_request`:
- si `offersRes.error || reqRes.error || auditRes.error`, abortá el bloque best-effort y no llames al emisor.
- esto evita que un `auditRes.error` deje `actorId=undefined` y termine notificando al merchant que fue quien canceló.

Para consistencia, en publish/submit también capturá el `error` de los lookups y abortá el side effect si existe; no llames `safeNotifyPostTransition([],...)`.

Tests exactos:
- accept: merchant lookup devuelve error y offer lookup éxito → resultado ok, cero push.
- accept: offer lookup error y merchant éxito → resultado ok, cero push.
- cancel: audit lookup error con merchant actor potencial → resultado ok, cero push.
- cancel: offers lookup error → resultado ok, cero push.
- publish: couriers lookup error → resultado ok, cero push.
- submit: request lookup error → resultado ok, cero push.

RED:
- eliminá temporalmente cada guard de error. El test correspondiente debe fallar porque aparece un push parcial/incorrecto (o una llamada que debería ser cero), no por TypeError.

5. **PR118-R01 — quitar el fallback condicional de .select() del sweep.**

En `src/server/cron/sweep.ts` eliminá por completo:
- `offersUpdateBuilder`
- el `typeof ...select === 'function'`
- casts/fallback PromiseLike.

Dejá la cadena real, directa y obligatoria:
```ts
const { data: expiredOffers, error: offersUpdateError } = await supabase
  .from('offers')
  .update({ status: 'expired', decided_at: nowIso })
  .in('request_id', actuallyExpiredIds)
  .eq('status', 'pending')
  .select('request_id, courier_id');
```

Todos los mocks actuales ya tienen que modelar ese contrato. Si alguno falla, arreglá el mock; no agregues escapes al código productivo.

RED:
- quitar temporalmente `.select('request_id, courier_id')` del código: el test T-206 debe fallar porque no se obtiene la lista exacta de filas afectadas / no se invoca el select esperado.
- el rojo debe ser por la propiedad, no por un mock roto deliberadamente.

6. **PR118-M02 — corregir cifras de evidencia en el cuerpo de la PR.**

El CI del SHA `aba405dd...` reportó:
- Vitest: `92 passed (92)`
- Tests: `1255 passed (1255)`
- verify-workflows: `22`
- verify-adr: `6`
- db-tests: `Files=12, Tests=1601, Result: PASS`

El cuerpo actual dice 1254 y 21+6. Al terminar, actualizá las cifras usando la corrida del NUEVO SHA; si local y CI difieren, mostrarlas separadas y no mezclar conteos.

Comandos finales:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm vitest run src/server/rpc/requests.test.ts src/server/rpc/offers.test.ts src/server/cron/sweep.test.ts src/features/auth/actions.test.ts`
- `pnpm test`
- no levantes Supabase/Docker local; db-tests se valida en el CI normal posterior al push.

Al terminar:
- nueva entrada append-only en `docs/tasks/log/T-206.md` con outputs RED/GREEN reales;
- no escribas “verificado”;
- commit Conventional Commits terminado en `[T-206]`;
- push;
- pegá `git ls-remote origin feat/T-206-cableado-push`;
- no toques `docs/revision-pr/**`.
```
