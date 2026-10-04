# Evidencia de revisión independiente — PR #180

## Ronda 1

SHA funcional revisado: `a62abb26d5fbde522f7cf41a2363e0b2e0b30126`.

### Sincronización

```text
develop: 01f8fb20587beb5b43b606103051deb49e1c01d1
PR head: a62abb26d5fbde522f7cf41a2363e0b2e0b30126
compare develop...head: diverged · ahead_by=5 · behind_by=9
```

### Auditoría focal de falsos positivos

```text
H01 CONTROL VERDE sin UI ni Realtime: direct fetch/mock basta
H02 CONTROL VERDE sin refetch de TanStack: /api/health autogenerado basta
```

La ronda 1 dejó tres bloqueantes y preservó la autorrevisión del agy por separado.

---

## Ronda 2

SHA funcional revisado: `0a70b6819e67a8c83c6b8ddb8a5f160ff5096240`.

### Sincronización

```text
develop: 6577d9e427c5efc0a79a2c374f0f74d847732f4d
PR head: 0a70b6819e67a8c83c6b8ddb8a5f160ff5096240
status: diverged · ahead_by=9 · behind_by=30
```

H01/H02 se reescribieron sobre UI/query real. Se detectó H05: el INSERT podía ocurrir antes de concluir el GET inicial.

CI `36972452441`: GREEN completo. Vercel Preview READY y health 200, pero el gate trusted todavía no ejecutaba `notifications.spec.ts`.

---

## Ronda 3

SHA funcional revisado: `ae0758b7c8f8fc88dd2a4201f738835faf200f48`.

### 1. Sincronización

```text
develop: cb4111273da663f7591aec370a44767c4e677b82
PR head: ae0758b7c8f8fc88dd2a4201f738835faf200f48
compare develop...head: diverged · ahead_by=13 · behind_by=5
merge-base: 8bfdd2c5e90584f5ac77c93557077f10e3d6fb9f
```

Los 5 commits nuevos de `develop` cambian únicamente:
- `.github/workflows/e2e-preview.yml`
- `.github/workflows/e2e-staging.yml`
- `.github/workflows/verify-workflows.test.mjs`

La rama debe integrarlos antes del cierre final.

### 2. H05 — corrección estructural

Commit funcional del agy:

```text
3d10f7203c7de6b97af793852095b645e8b7a680
feat(e2e): eliminate initial refetch race in realtime spec and align fixtures [T-307]
```

El primer test ahora:
- usa `loginAsMerchant` y courier sembrado;
- instala listener del endpoint exacto;
- crea `page.waitForResponse` antes del detalle;
- espera response 2xx inicial;
- fija baseline;
- inserta la oferta después;
- exige `offersRequestCount > baseline` en 15 s;
- exige courier + monto visibles.

Esto elimina por inspección la carrera reportada en H05. Falta ejecución remota real y mutación RED.

### 3. H02 — corrección estructural

El test de reconexión:
- usa una query real del detalle;
- espera el response inicial 2xx;
- fija baseline;
- corta y restablece red;
- exige una request nueva del endpoint exacto en 15 s;
- no usa `/api/health`, `_rsc`, `navigator.onLine` ni botón de reintento.

Falta demostrar RED con `refetchOnReconnect:false` y GREEN restaurado en el ambiente real.

### 4. H06 — fix mínimo aplicado por la revisión

El SHA funcional tenía:

```ts
await page.addInitScript(...);
const initialPermission = await page.evaluate(() => Notification.permission);
expect(initialPermission).toBe('denied');
```

Playwright ejecuta `page.addInitScript` cuando la página navega (o al crear/adjuntar un nuevo documento/frame), no sobre el documento actual ya existente. Por eso la lectura inmediata no demostraba que el override estuviera activo.

La revisión hizo el fix mínimo:
- registrar `addInitScript`;
- ejecutar `await loginAsMerchant(page)`, que navega;
- recién entonces leer y exigir `Notification.permission === 'denied'`.

No se alteró el comportamiento de producto ni se debilitó la expectativa. Falta verificarlo cuando `notifications.spec.ts` entre al runner trusted.

### 5. CI general del SHA

Run: `37035483999` — **SUCCESS**.

Jobs GREEN:
- typecheck
- lint
- unit / coverage
- workflow tests
- ADR
- db-tests
- build
- audit
- bundle-budget

La bitácora local registra `pnpm test` rojo por 3 fallos ajenos; CI Linux del mismo SHA ejecutó las suites correspondientes en verde. La ficha mantiene el DoD global abierto, por lo que no hay declaración falsa.

### 6. E2E Preview real del SHA

Status `e2e-preview`: **failure**  
Run: `37035612143`.

Infra previa:
- resolve-preview ✅
- Supabase Develop target ✅
- health check ✅

Playwright ejecutó 9 tests:
- `main-flow.spec.ts`
- `smoke.spec.ts`

Resultado:
```text
8 passed
1 failed: T-303 Flow 4 — ordenamiento por documentación y precio
Expected courier real
Received "Repartidor"
```

Ese fallo corresponde al bloqueante conocido **#200 / CC-016**, no a T-307. PR #180 no modifica el Flow 4 ni la proyección que falla.

Críticamente, ese run **no ejecutó `notifications.spec.ts`**, por lo que no aporta GREEN ni RED sobre H02/H05/H06.

### 7. Estado actual de T-327

El `develop` actual amplió el gate para incluir condicionalmente `request-states.spec.ts`, pero sigue sin incluir `notifications.spec.ts`.

El follow-up quedó actualizado en issue **#205 / T-327** con el run real de PR #180.

### 8. Evidencia RED declarada por el autor

La bitácora afirma RED/GREEN para H05 y H02, pero no adjunta salida de Playwright ni una corrida remota de `notifications.spec.ts`. Como el runner trusted todavía no ejecuta ese archivo, esas afirmaciones **no se usan como verificación independiente**.

Estado:

```text
H01 -> arreglado-verificado
H02 -> arreglado-sin-verificar
H03 -> arreglado-verificado
H04 -> arreglado-verificado
H05 -> arreglado-sin-verificar
H06 -> arreglado-sin-verificar (fix mínimo del revisor)
D01 -> aplicado
T-327/#205 -> bloquea la verificación E2E final de T-307
```

---

## Ronda 4

Base revisada: `bb2fe2a05a8fb8020b24f1eed581dc8f901e62a3`.

### 1. No hubo nueva implementación del agy

El HEAD al comenzar esta revisión seguía siendo el commit de Ronda 3 del revisor. No se inventa una nueva corrección del autor.

### 2. Evidencia nueva del Preview de `bb2fe2a`

- CI: run `37040809661` — GREEN.
- Vercel: READY.
- e2e-preview: run `37040956911` — RED global.
- El job trusted ejecutó `smoke.spec.ts + main-flow.spec.ts`; la copia de `request-states.spec.ts` no existía en ese SHA y `notifications.spec.ts` no fue enumerado.
- Resultado: 8 passed / 1 failed. El único fallo volvió a ser T-303 Flow 4 / #200.

Esto confirma nuevamente que la infraestructura Preview/Develop funciona, pero T-307 todavía no fue ejecutada por el gate trusted.

### 3. PR180-H07 — acoplamiento indebido con #200

El test de Realtime esperaba el heading con `courier.displayName`. El bug conocido #200 hace que el merchant reciba la proyección de courier como null y la UI muestre `Repartidor`.

Por lo tanto, aun con Realtime perfecto, `notifications.spec.ts` podía fallar por T-303/#200.

Fix mínimo aplicado por la revisión:
- mantener el courier sembrado solo como FK válida;
- insertar `message: "T307 realtime <testRunId>"` como marcador único de la oferta;
- verificar ausencia del marcador antes del INSERT;
- después del evento, exigir segunda GET + marcador visible + monto visible;
- dejar de depender del nombre/documentación del courier.

La columna `offers.message` existe y `getRequestOffersLiveServer()` la proyecta sin depender de la relación RLS de `couriers`; `RequestOffersList` la renderiza en la tarjeta.

### 4. Sincronización con develop

Antes del merge:
```text
develop: cb4111273da663f7591aec370a44767c4e677b82
branch: bb2fe2a05a8fb8020b24f1eed581dc8f901e62a3
ahead: 14
behind: 5
```

Los 5 commits pendientes cambian solo:
- `.github/workflows/e2e-preview.yml`
- `.github/workflows/e2e-staging.yml`
- `.github/workflows/verify-workflows.test.mjs`

La revisión integra esas versiones exactas de `develop` mediante merge commit, sin rebase.

### 5. Estado de verificación

```text
H02 -> arreglado-sin-verificar
H05 -> arreglado-sin-verificar
H06 -> arreglado-sin-verificar
H07 -> arreglado-sin-verificar (fix mínimo del revisor)
T-327/#205 -> sigue bloqueando el GREEN/RED real de notifications.spec.ts
```


## Ronda 5 — trusted runner ejecuta T-307

SHA revisado: `d967b7820a43155b076fc0cd501d4a2953054132`.

Run trusted: `37100304678`.

Infra:
- resolve-preview GREEN
- Supabase Develop GREEN
- health GREEN
- `notifications.spec.ts` enumerado y ejecutado

Resultado T-307:
```text
Realtime denied -> RED 3/3, no segunda GET en 15s
Offline/form -> GREEN
Reconnect -> RED 3/3, no segunda GET en 15s
```

La dependencia T-327 dejó de ser bloqueo. Los controles H02/H05 demostraron que no pasan cuando el producto no produce el refetch esperado.

Se abrió #229 como follow-up de producto de T-204.

---

## Ronda 6 — repetición RED + corrección de colisión de tarea

SHA revisado: `cfea63d76850692c3bf99c832cf4044b3859f792`.

Cambio del autor desde R5:
- solo `docs/tasks/T-307.md`;
- solo `docs/tasks/log/T-307.md`;
- no modificó `e2e/specs/notifications.spec.ts`;
- no tocó `docs/revision-pr/**`.

CI run `37138504068`:
- typecheck GREEN
- lint GREEN
- db-tests GREEN
- build GREEN
- unit/coverage + workflow tests GREEN
- bundle-budget GREEN
- audit RED por advisory preexistente, sin cambio atribuible a T-307

Trusted run `37138561471` usa el workflow de `develop@20db1bdbfd44f5a398dbfa984cc8ea291a56a493`, ya con autodiscovery por proyecto.

Resultado:
```text
21 passed
2 failed
- notifications realtime: RED 3/3 en offersRequestCount > baseline
- notifications reconnect: RED 3/3 en count > baseline
offline/form: GREEN
```

No hay cambios de producto en `develop` entre el primer RED y este segundo RED: el compare `973d7fa...20db1bd` no toca:
- `src/lib/hooks/use-realtime-invalidation.ts`
- `src/features/requests/hooks/use-request-offers.ts`
- `src/app/providers.tsx`

### Colisión de identificador

#229 había nacido como T-331 para corregir Realtime/reconnect. Después #232 / PR #233 tomó oficialmente T-331 para otra tarea: autodiscovery del pipeline, creando `docs/tasks/T-331.md` en develop.

El cierre automático de #229 coincidió con el merge de #233, aunque ninguna corrección de producto fue mergeada.

Corrección del revisor:
- #229 reabierto;
- renombrado a **T-333**;
- labels restablecidas a P2 + fase-3;
- body y rutas documentales actualizados a `docs/tasks/T-333.md` / `docs/tasks/log/T-333.md`.

Estado real:
```text
T-327 runner: RESUELTO
T-331: autodiscovery E2E, mergeado
T-333/#229: ABIERTO, bloquea T-307
PR #180: no mergeable por DoD funcional, aunque GitHub diga mergeable
```


## Ronda 7 — post T-333

SHA revisado: `47152d69d1de0a6b32db21f0ab98a8f36e27e8d9`.

Sincronización:
```text
base develop: b4119ef3e16170decda0a1649fc35db207faa8b0
head: 47152d69d1de0a6b32db21f0ab98a8f36e27e8d9
ahead_by: 22
behind_by: 0
```

El compare desde el HEAD previo de T-307 `5f8d78a9` hasta el actual muestra **0 cambios** en `e2e/specs/notifications.spec.ts`.

### Trusted run registrado por el autor

Run `37163278613` sobre `9e465671517f9b71b5f095ea587c79a9b3edb379`:

```text
Realtime: RED 3/3
offline/form: GREEN
reconnect: GREEN
global: 22 passed / 1 failed
```

Fallo Realtime:
```text
notifications.spec.ts:99
Expected offersRequestCount > baseline
Expected: > 2
Received: 2
timeout: 15 s
```

### Trusted run del HEAD documental actual

Run `37163835724`:

```text
Realtime: RED 3/3
offline/form: GREEN
reconnect: GREEN
global: 22 passed / 1 failed
```

Mismo fallo exacto en línea 99. La repetición descarta que el resultado post-T-333 haya sido un run aislado.

### CI exact-head

Run `37163772846`: **SUCCESS**.

Jobs:
- typecheck ✅
- lint ✅
- unit ✅
- db-tests ✅
- build ✅
- audit ✅
- bundle-budget ✅

### Diagnóstico del residual Realtime

Se inspeccionaron:
- todos los archivos de `supabase/migrations/**` de develop;
- `supabase/config.toml`;
- los tres consumidores de `useRealtimeInvalidation`.

Consumidores Postgres Changes:
```text
useRequestOffers        -> public.offers
useAvailableRequests    -> public.delivery_requests + public.offers
useTrip                 -> public.delivery_requests
```

No existe en el repositorio:
```text
ALTER PUBLICATION supabase_realtime ADD TABLE ...
pg_publication_tables
configuración versionada de offers/delivery_requests en supabase_realtime
```

La RLS de `offers` sí permite al merchant dueño leer ofertas:
```sql
create policy offers_select_merchant on public.offers
  for select to authenticated
  using (app_private.is_request_merchant(request_id, auth.uid()));
```

Supabase exige que una tabla esté añadida a la publicación `supabase_realtime` para Postgres Changes y documenta `pg_publication_tables` como verificación.

Conclusión de revisión:
- el E2E no debe tocarse;
- T-333 resolvió reconnect;
- el siguiente diagnóstico/fix corresponde a DB/plataforma y debe comprobar primero la membresía real de la publicación;
- se creó **T-335 / #244**.

No se declara todavía que la ausencia remota esté demostrada únicamente por inspección de repo; T-335 debe comprobarla con SQL/DB test y cerrar la configuración de forma declarativa.
