# Ronda 3 — PR #118 · T-206

- **SHA:** `6980fb095b3605663ad658e8c885ed2b7906df3b`
- **Fecha:** 2026-09-28
- **Resultado:** **CON BLOQUEANTES**
- **D02:** 2-A — desvío test-only de `src/app/api/cron/sweep/route.test.ts` aceptado explícitamente por Lautaro073.

## Sincronización

Desde la Ronda 2 hubo un único commit de producto. No tocó `docs/revision-pr/**`.

La rama quedó divergida respecto de develop: **8 ahead / 1 behind**. El nuevo commit de develop es `c91ec4e...` (T-116). La siguiente sesión debe hacer merge de `origin/develop` antes de la corrección/finalización.

## Revalidación

### H04 — cerrado en implementación/control

`requests.test.ts` ahora usa `createOffersQueryBuilder` y `createAuditLogQueryBuilder` con estado real de filtros. El audit builder modela target_type, target_id, action, order y limit; las fixtures incluyen filas distractoras. Ya no es el mock complaciente de Ronda 2.

### H06 — cerrado

`logoutAction` mete `getUser()` y purga dentro del try best-effort y ejecuta `signOut()` fuera. Hay tests para rechazo de getUser y rechazo del delete.

### R01 — cerrado

El sweep encadena directamente:
`.eq('status','pending').select('request_id, courier_id')`.
Se eliminó el fallback productivo.

### H07 — PARCIAL

Los errores in-band `{ error }` ya cortan el side effect en publish/submit/accept/cancel.

Residual concreto en `cancel_request`:
- `auditRes={data:null,error:null}` deja `actorId=undefined`; si merchant existe, se lo agrega como destinatario aunque pudo ser el actor que canceló.
- `reqRes={data:null,error:null}` o `offersRes={data:null,error:null}` también representan resolución incompleta y hoy no se tratan como fail-closed.

Debe requerirse data indispensable antes de construir destinatarios. `offersRes.data=[]` sí es válido.

### H05 — ABIERTO

La nueva bitácora sí mejoró: registra comando, test, mensaje y resumen RED/GREEN. Pero no ejecutó toda la batería mínima pedida en Ronda 2.

Faltan:
- publish `available:true → false`;
- publish pre-commit;
- sweep dispersión de couriers entre requests;
- quitar completamente `.select(...)` (se cambió a `.select('courier_id')`, que es otra mutación).

Además, la mutación “quitar decided_at” quedó documentada como fallo de:
`expected spy to be called with ['decided_at', ...]`.
Eso prueba la forma del query, no la propiedad solicitada de **histórico extra**. Con el builder semántico actual debe agregarse/separarse un test donde la aserción de destinatarios se ejecute antes y falle por longitud/Set.

### M02 — sigue abierto

El body conserva 92/92 y 1255/1255, pero el run actual `36461968118` dio:
- 93/93 files
- 1275/1275 tests
- workflows 22
- ADR 6
- db-tests 12/1601 PASS

Después de la próxima corrección y merge de develop, se deben usar las cifras del nuevo CI, no estas.

## PR118-A01 — desvío aceptado

El commit modificó `src/app/api/cron/sweep/route.test.ts`, fuera de los Archivos permitidos y de la lista cerrada de Ronda 2. El cambio solo adapta el mock a la nueva cadena `.select(...)`.

Lautaro073 resolvió **D02=2-A**: se acepta y conserva excepcionalmente. Estado: `aceptado`; no es un precedente para ampliar el resto de T-206.

El body debe declarar la excepción; no puede afirmar sin matiz “ningún cambio fuera de Archivos permitidos”.

## CI inspeccionado

Run `36461968118`: todos los jobs verdes.
```text
Test Files 93 passed (93)
Tests      1275 passed (1275)
verify-workflows # tests 22
verify-adr       # tests 6
DB: Files=12, Tests=1601, Result: PASS
```

## Informe revisar-pr

```text
Informe revisar-pr — T-206 — Ronda 3 — 2026-09-28
Resultado: CON BLOQUEANTES
SHA: 6980fb095b3605663ad658e8c885ed2b7906df3b
CI: 93/93 files · 1275/1275 tests · db 12/1601 PASS

CERRADOS:
- H04: mocks/builders semánticos implementados.
- H06: logout resiliente.
- R01: select directo obligatorio.

ABIERTOS:
- H05: faltan mutaciones mínimas y el RED sin decided_at no demuestra histórico extra.
- H07: cancel_request no falla cerrado ante data crítica ausente sin error.
- M02: body de PR desfasado.
- sync: rama 1 commit detrás de develop.

ACEPTADO:
- A01 / D02=2-A: route.test.ts test-only fuera de alcance, aceptado por Lautaro073.
```

## Prompt de corrección

```text
Tarea: T-206, PR #118, rama feat/T-206-cableado-push.

0. Sincronización obligatoria:
   - `git pull` primero para traer el commit de revisión de Ronda 3.
   - `git fetch origin`
   - `git merge origin/develop` (NO rebase, NO force-push).
   La rama estaba 1 commit detrás de develop (`c91ec4e...`, T-116). Resolver conflictos sin tocar semántica de T-206. Después continuar.

Decisiones humanas vigentes:
- D01 = 1-A: cancelación/expiración notifican solo actores afectados por ESA transición.
- D02 = 2-A: se ACEPTA excepcionalmente el cambio ya hecho en `src/app/api/cron/sweep/route.test.ts` por ser test-only y necesario para adaptar el mock al `.select('request_id, courier_id')` obligatorio. No ampliar más ese archivo ni usar esta excepción para otros paths.

Podés tocar SOLO:
- `src/server/rpc/requests.ts`
- `src/server/rpc/requests.test.ts`
- `docs/tasks/log/T-206.md`
- cuerpo de la PR #118
Más el merge limpio de `origin/develop`. No hace falta volver a tocar offers/auth/sweep salvo conflicto real del merge; si aparece, reportarlo antes de cambiar semántica.

Prohibido:
- `docs/revision-pr/**`
- editar `docs/tasks/T-206.md`
- nuevas dependencias/migraciones
- rebase, force-push o amend
- tests falsos/tautológicos, cambiar mocks o expectativas para fabricar verde
- afirmar “SIN BLOQUEANTES” antes de que la próxima revisión cierre estos puntos

1. **PR118-H07 residual — cancel_request debe fallar cerrado también ante data ausente sin error.**

El código actual solo corta por:
`offersRes.error || reqRes.error || auditRes.error`.

Eso no alcanza. Si `auditRes = { data: null, error: null }`, `actorId` queda undefined y el código puede agregar al merchant aunque él mismo haya cancelado. Si `reqRes.data` falta, tampoco hay resolución completa del conjunto.

Después de Promise.all, abortá SOLO el side effect y devolvé el resultado de negocio exitoso si ocurre cualquiera:
- `offersRes.error`
- `reqRes.error`
- `auditRes.error`
- `offersRes.data == null`
- falta `reqRes.data?.merchant_id`
- falta `auditRes.data?.actor_id`

`offersRes.data = []` sí es válido (request publicada sin ofertas).

Ejemplo:
```ts
if (
  offersRes.error ||
  reqRes.error ||
  auditRes.error ||
  offersRes.data == null ||
  !reqRes.data?.merchant_id ||
  !auditRes.data?.actor_id
) {
  return ok(output.data as RpcOutput<K>);
}
```

Tests nuevos:
- audit_log => `{ data:null, error:null }`: resultado ok y CERO push.
- delivery_requests => `{ data:null, error:null }`: resultado ok y CERO push.
- offers => `{ data:null, error:null }`: resultado ok y CERO push.
- control: offers => `{ data:[], error:null }`, merchant actor válido => resultado ok y cero push (válido sin ofertas, no “error”).

RED reales:
- quitar guard de `!auditRes.data?.actor_id` => el test debe fallar porque aparece merchant en safeNotify.
- quitar guard de `!reqRes.data?.merchant_id` => test debe demostrar que se intentaría continuar con resolución incompleta; cero push es la propiedad.
- quitar guard de `offersRes.data == null` => test debe detectar intento de side effect inconsistente si la fixture lo hace observable.
Si una mutación no cambia conducta observable, ajustá la prueba para ejercer la propiedad real, no agregues una aserción tautológica.

2. **PR118-H05 — completar EXACTAMENTE la batería RED mínima faltante.**

La bitácora ya contiene 7 mutaciones, pero NO cumplió toda la lista mínima de Ronda 2. Agregá una nueva entrada append-only con estas mutaciones que faltan, sin borrar las anteriores:

A) `publish_request`: `.eq('available', true)` → `false`.
- comando: `pnpm exec vitest run src/server/rpc/requests.test.ts`
- debe fallar el control de elegibilidad.

B) `publish_request`: demostrar orden post-commit.
- mutación temporal que haga que la resolución/emisión ocurra antes de finalizar la RPC, de forma que `orderIsPostCommit` quede false.
- debe fallar el test de orden por esa propiedad.

C) `runSweep`: dispersar/globalizar temporalmente los couriers entre dos requests.
- el test de dos requests debe fallar por destinatario extra/cruce entre requests.

D) `runSweep`: quitar por completo `.select('request_id, courier_id')`, NO cambiarlo solo a `.select('courier_id')`.
- el RED debe demostrar pérdida de la lista de filas afectadas/control obligatorio. No cuenta un TypeError artificial.

E) `cancel_request` sin `decided_at`: repetir la mutación, pero la evidencia debe mostrar fallo por **destinatario histórico extra**, no por la aserción estructural `toHaveBeenCalledWith('decided_at', ...)`.
- Conservá el test estructural, pero agregá/separá un test semántico cuyo primer control relevante sea el conjunto exacto de destinatarios. Con el builder semántico actual, omitir `decided_at` debe incluir `courierHistoricExpired/Cancelled` y fallar por longitud/Set.
- No debilitar el test estructural existente.

Por CADA mutación registrar:
- archivo/símbolo
- diff exacto
- comando
- nombre del test
- mensaje de aserción
- línea `Test Files ...`
- línea `Tests ...`
- GREEN posterior tras revertir

3. **PR118-M02 — actualizar body con el CI DEL SHA NUEVO.**

El CI del SHA `6980fb09...` terminó verde, pero el body quedó viejo:
- real: `Test Files 93 passed (93)`
- real: `Tests 1275 passed (1275)`
- verify-workflows: 22
- verify-adr: 6
- db-tests: Files=12, Tests=1601, PASS

Después de mergear develop y pushear las correcciones, NO copies estos números: esperá la corrida normal del NUEVO SHA y poné esos valores exactos.

4. **PR118-A01 / D02 — documentar la excepción de alcance aceptada.**

En el body no puede seguir diciendo literalmente “Sin cambios fuera de Archivos permitidos” y “Rutas de otra zona: ninguna” sin aclaración.

Agregar nota factual:
- `src/app/api/cron/sweep/route.test.ts` fue un desvío test-only necesario para adaptar el mock al encadenamiento `.select(...)`.
- Lautaro073 lo aceptó explícitamente en Ronda 3 mediante D02 = 2-A.
- No modifica producción ni contratos.

El checkbox de alcance puede quedar marcado solo acompañado de esa excepción explícita; no afirmar que no hubo ningún path fuera de la lista.

5. Final:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm vitest run src/server/rpc/requests.test.ts src/server/cron/sweep.test.ts`
- `pnpm test`
- no levantar Supabase/Docker local; db-tests se toma del CI normal

Al terminar:
- nueva entrada append-only en `docs/tasks/log/T-206.md`
- commit Conventional Commits con `[T-206]`
- push
- pegar `git ls-remote origin feat/T-206-cableado-push`
- comprobar `git rev-list --left-right --count origin/develop...HEAD` y debe mostrar `0 <N>` (cero commits detrás)
- no tocar `docs/revision-pr/**`.
```
