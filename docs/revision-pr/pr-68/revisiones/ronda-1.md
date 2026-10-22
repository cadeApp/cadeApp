# Ronda 1 — PR #68 (`T-104`) — Revisión Independiente (El Consejo)

- **PR:** [#68](https://github.com/cadeApp/cadeApp/pull/68) · `feat/T-104-cron-sweep` → `develop`
- **Tarea:** `T-104` (`/api/cron/sweep` y `/api/health`) · Issue #14 · ficha leída desde `origin/develop`
- **Autor:** `Lautaro073` (P1)
- **SHA revisado:** `e6d0b78d20e7b5622af5705126862ef1a062fc28` (`e6d0b78`)
- **Fecha:** 2026-09-23
- **Revisor:** Revisión independiente (El Consejo: 3 subagentes — Dominio/Seguridad, Pruebas/Calidad y Proceso/CI)

---

## Informe formato `revisar-pr`

```text
Informe revisar-pr — T-104 — 2026-09-23 — generado por revisión independiente (El Consejo)
Resultado: CON BLOQUEANTES (6)
Checks locales: typecheck ✅ · lint ✅ · test ✅ (24 suites, 208 tests + 19 workflows + 6 ADRs) · test:db n.a.
BLOQUEANTES:
- [src/server/cron/sweep.ts:65-83] (PR68-H01) `supabase.storage.from('courier-docs').remove(storagePaths)` no lanza excepción cuando falla; `sweep.ts` ignora `{ data, error }`, actualiza `purged_at = nowIso` en `courier_documents` e inserta `action: 'purged'` en `audit_log`. Si falla el borrado en Storage, los binarios de DNI/selfie quedan retenidos perpetuamente en el bucket privado (porque `.is('purged_at', null)` no vuelve a barrerlos) con auditoría falsa de destrucción → verificar `{ data, error }` de `.remove()`; si falla, no marcar `purged_at` ni auditar `purged` y propagar el error.
- [src/server/cron/sweep.ts:12-13,122-127] (PR68-H02) `currentDateIso` se calcula en UTC (`new Date().toISOString().split('T')[0]`) y las líneas 122-124 mezclan `new Date(merchant.paid_until)` (medianoche UTC) con `getDate()`/`setDate()` (hora local). Entre las 21:00 y 23:59 hora de Aguilares (`-03:00`), la fecha UTC ya es el día siguiente, expirando comercios hasta 3 horas antes de lo que define el contrato `canMerchantPublishRequest` (`src/domain/states/index.ts:79-86`, `23:59:59.999-03:00`) → reutilizar `canMerchantPublishRequest({ subscriptionStatus: 'active', pilotActive: false, paidUntil: merchant.paid_until, graceDays, now })` e inyectar `now: Date = new Date()` en `runSweep(now = new Date())`.
- [src/server/cron/sweep.ts:16-50,87-146] (PR68-H03) Condición de carrera (TOCTOU) en los `UPDATE` de `delivery_requests` (sin `.eq('status', 'published').select('id, merchant_id')`) y `merchants` (sin `.eq('subscription_status', 'active').select('profile_id')`), pudiendo pisar transiciones concurrentes (`matched`/`cancelled`); además ignora `{ error }` al consultar `platform_settings` (`subscription_grace_days`, cayendo silenciosamente a `graceDays = 0` — `AG-54`) y en todas las lecturas/escrituras de `runSweep()`, respondiendo `200 OK` ante fallos de DB → agregar guardas de estado y `.select()` en los `UPDATE`, y verificar/lanzar `{ error }` en todas las operaciones de Supabase.
- [src/app/api/cron/sweep/route.ts:6-21] (PR68-H04) La cabecera `Authorization` se compara con `!==` en lugar de `timingSafeEqual` de `node:crypto` (exigido por `ADR-0002` §5 Riesgo 2, línea 136), falta `export const runtime = 'nodejs'` (`ADR-0002` §3.1, línea 40) y el bloque `catch` devuelve `details: error.message` en el cuerpo HTTP 500 → usar `timingSafeEqual` con verificación de longitud de `Buffer` y `serverEnv.CRON_SECRET` no vacío, declarar `export const runtime = 'nodejs'` y no exponer `details` internos en respuestas 500.
- [src/server/cron/sweep.test.ts:21-141, src/app/api/cron/sweep/route.test.ts:103] (PR68-H05) Tests parcialmente tautológicos (`P04`) y 0 pruebas de fallos parciales: los mocks no verifican los argumentos de `.update()` sobre `delivery_requests`, `offers`, `courier_documents` ni `merchants`; `route.test.ts:103` devuelve `{ id: 'merchant-2' }` en lugar de `{ profile_id: 'merchant-2' }` (actualizando `[undefined]`); y faltan tests para fallo de Storage en `.remove()`, error de DB/`platform_settings`, comercio dentro de `subscription_grace_days` y frontera horaria `-03:00` → corregir el mock y agregar las pruebas unitarias demostradas en rojo antes del arreglo.
- [docs/tasks/T-104.md:26-29, docs/tasks/log/T-104.md:47, src/server/cron/sweep.ts] (PR68-H06) El check `approval-policy` de CI está en `FAILURE` porque el cuerpo (`body`) de la PR #68 no sigue `.github/PULL_REQUEST_TEMPLATE.md` ni incluye la sección `### Informe de revisión de agy`; las 4 casillas del DoD en `docs/tasks/T-104.md` están en `- [ ]`, la bitácora cierra en `624b2ed` y `src/server/cron/sweep.ts` falla `npx prettier --check` → formatear con Prettier, marcar DoD en `T-104.md`, actualizar bitácora y completar el cuerpo de la PR con la plantilla oficial.
MEJORAS:
- [src/server/cron/sweep.ts:42,76,137] (PR68-H07) Unificar `audit_log.target_type` en singular (`'delivery_request'`, `'courier_document'`, `'merchant'`) para coincidir con `ADR-0002` §3.1 línea 56 y las RPCs de `20260924013700_rpc_admin_v1.sql` (índice `audit_log_target_idx`), y poblar `before` en las filas de auditoría.
- [src/server/cron/sweep.test.ts:125, src/app/api/cron/sweep/route.test.ts:142] (PR68-H08) Reemplazar el doble cast `as unknown as ReturnType<typeof createAdminClient>` (`AG-59`) por un helper de mock tipado.
No revisado / dudas para Lautaro073:
- ninguna
```

---

## Checks locales y de CI

| Check                                                          | Resultado                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm typecheck`                                               | ✅ (0 errores)                                                                    |
| `pnpm lint`                                                    | ✅ (0 advertencias, 0 errores)                                                    |
| `pnpm test` (`vitest run` + `verify-workflows` + `verify-adr`) | ✅ (24 suites, 208 tests + 19 workflows + 6 ADRs)                                 |
| `npx prettier --check`                                         | ❌ (`src/server/cron/sweep.ts`, `docs/tasks/T-104.md`, `docs/tasks/log/T-104.md`) |
| CI GitHub Actions                                              | 7/8 `SUCCESS` · **`approval-policy`: `FAILURE`**                                  |

---

## Alcance

Todos los archivos modificados en `feat/T-104-cron-sweep` (`e6d0b78`) están dentro de los «Archivos permitidos» de `docs/tasks/T-104.md` en `origin/develop`:

- `src/app/api/cron/**` ✅ (`route.ts`, `route.test.ts`)
- `src/app/api/health/**` ✅ (`route.ts`, `route.test.ts`)
- `src/server/**` ✅ (`src/server/cron/sweep.ts`, `src/server/cron/sweep.test.ts`)
- `docs/tasks/log/T-104.md` ✅
- `docs/revision-pr/**` ✅

No se modificaron contratos compartidos ni se agregaron dependencias en `package.json`.

---

## Detalle de Hallazgos

### 🔴 BLOQUEANTES (6)

#### `PR68-H01` · Purga de `courier-docs` ignora el error de Storage y certifica falsamente la destrucción del DNI/selfie (`critico`)

- **Archivo:** `src/server/cron/sweep.ts:65-83`
- **Patrón:** `P08-control-no-cubre-lo-que-dice`

En las líneas 65–83:

```ts
// Eliminar binarios de Supabase Storage
await supabase.storage.from('courier-docs').remove(storagePaths);

// Marcar purged_at = now()
await supabase.from('courier_documents').update({ purged_at: nowIso }).in('id', docIds);
```

En `@supabase/storage-js`, `.remove(storagePaths)` **no lanza excepción** cuando falla: resuelve `{ data, error }`. Al descartar `{ error }` y actualizar `purged_at = nowIso` + `audit_log` (`action: 'purged'`), cualquier fallo transitorio de Storage deja los archivos binarios de DNI/selfie en el bucket privado `courier-docs` de forma permanente (ya que la query de la línea 57 filtra `.is('purged_at', null)` y jamás volverá a seleccionarlos), mientras la base de datos y la auditoría afirman que fueron destruidos.

**Qué hay que hacer:**

1. Desestructurar `const { data: removed, error: storageError } = await supabase.storage.from('courier-docs').remove(storagePaths);`.
2. Si `storageError` está presente (o si no se pudieron borrar los objetos solicitados), **no** marcar `purged_at` ni insertar en `audit_log`, y lanzar un error para que el barrido falle visiblemente y reintente en la próxima ejecución.

---

#### `PR68-H02` · Expiración prematura de suscripciones por usar fecha UTC (`toISOString()`) y mezclar `new Date('YYYY-MM-DD')` con `setDate()` local (`alto`)

- **Archivo:** `src/server/cron/sweep.ts:12-13, 122-127`
- **Patrón:** `P05-semantica-invertida-vs-dod`

1. En las líneas 12–13, `currentDateIso = new Date().toISOString().split('T')[0]` obtiene la fecha en **UTC**. En Aguilares (`America/Argentina/Buenos_Aires`, `UTC-3`), entre las **21:00:00 y las 23:59:59** de cada noche la fecha UTC ya es el día siguiente (`+1 día`). Como consecuencia, un comercio cuyo `paid_until + graceDays` vence hoy en Argentina es pasado a `subscription_status = 'expired'` **3 horas antes** de lo que estipula el contrato de dominio `canMerchantPublishRequest` (`src/domain/states/index.ts:79-86`, que evalúa `${paidUntil}T23:59:59.999-03:00` + `graceDays * 86_400_000`).
2. Además, en las líneas 122–124:
   ```ts
   const paidUntilDate = new Date(merchant.paid_until);
   paidUntilDate.setDate(paidUntilDate.getDate() + graceDays);
   const paidUntilWithGraceStr = paidUntilDate.toISOString().split('T')[0] ?? '';
   ```
   `new Date('YYYY-MM-DD')` interpreta la cadena en **medianoche UTC** (`00:00:00Z`, que en hora local `UTC-3` es las `21:00` del **día anterior**), luego suma `graceDays` usando `getDate()`/`setDate()` (que operan en **hora local del sistema**) y finalmente serializa con `toISOString()` (en **UTC**).

**Qué hay que hacer:**
Reutilizar directamente la función pura del dominio `canMerchantPublishRequest` (`@/domain/states`):

```ts
const check = canMerchantPublishRequest({
  subscriptionStatus: 'active',
  pilotActive: false,
  paidUntil: merchant.paid_until,
  graceDays,
  now,
});
if (!check.ok) {
  expiredMerchantIds.push(merchant.profile_id);
}
```

y recibir `now: Date = new Date()` como parámetro opcional en `runSweep(now: Date = new Date())` (regla 10) para poder probar las fronteras horarias sin depender del reloj del sistema.

---

#### `PR68-H03` · Condición de carrera (TOCTOU) en `UPDATE` de `delivery_requests`/`merchants`, fallback silencioso a `graceDays = 0` (`AG-54`) e ignorancia de errores de DB (`alto`)

- **Archivo:** `src/server/cron/sweep.ts:16-50, 87-146`
- **Patrón:** `P08-control-no-cubre-lo-que-dice` · `AG-54`

1. **TOCTOU sobre estados:** Entre el `SELECT` de `delivery_requests` (`status = 'published'`, línea 19) y el `UPDATE` (línea 28), una solicitud puede ser aceptada (`matched`) por una oferta o cancelada (`cancelled`). Como el `UPDATE` ejecuta `.update({ status: 'expired' }).in('id', expiredRequestIds)` **sin `.eq('status', 'published')` ni `.select('id, merchant_id')`**, puede sobrescribir una solicitud `matched` o `cancelled` pasándola a `expired` (transición inválida según `src/domain/states/index.ts:141`). Lo mismo ocurre en `merchants` (línea 131) al actualizar sin `.eq('subscription_status', 'active').select('profile_id')`.
2. **Fallback silencioso `AG-54`:** En las líneas 87–104, si la lectura de `platform_settings` (`key = 'subscription_grace_days'`) devuelve `error` o `null`, `sweep.ts` no verifica `error` y asume silenciosamente `graceDays = 0`, expirando de inmediato a todos los comercios que se encuentren dentro de sus días de gracia configurados.
3. **Errores de Supabase ignorados:** Si fallan `reqFetchError`, `docsFetchError`, `merchantError` o cualquiera de los `.update()` / `audit_log.insert()`, `runSweep()` no lanza excepción y el endpoint responde `200 OK { ok: true }`.

**Qué hay que hacer:**

1. Filtrar `.eq('status', 'published').select('id, merchant_id')` en el `UPDATE` de `delivery_requests` (y usar solo las filas efectivamente devueltas por ese `UPDATE` para expirar `offers` e insertar en `audit_log`) y `.eq('subscription_status', 'active').select('profile_id')` en el `UPDATE` de `merchants`.
2. Desestructurar y verificar `error` en `platform_settings` (`subscription_grace_days`) y en cada consulta/mutación de `runSweep()`, lanzando un `Error` descriptivo cuando ocurra un fallo de base de datos.

---

#### `PR68-H04` · Comparación no constante de `CRON_SECRET` (`!==` vs `timingSafeEqual`), falta de `runtime = 'nodejs'` y filtración de `error.message` en HTTP 500 (`alto`)

- **Archivo:** `src/app/api/cron/sweep/route.ts:6-21`
- **Patrón:** `P08-control-no-cubre-lo-que-dice`

1. `ADR-0002` §5 Riesgo 2 (línea 136) establece: _«Mitigación: Validación obligatoria en tiempo constante de `Authorization: Bearer <CRON_SECRET>` desde `src/server/env.ts`»_, y el propio archivo de autorrevisión (`autorrevision-agy.md` línea 34) afirmaba haber usado `crypto.timingSafeEqual`. Sin embargo, `route.ts:9` usa `if (!authHeader || authHeader !== expectedAuth)`.
2. `ADR-0002` §3.1 (línea 40) exige ejecutar el handler en el runtime `nodejs` (`export const runtime = 'nodejs';`).
3. En `route.ts:18`, devolver `{ error: 'Internal Error', details: error instanceof Error ? error.message : String(error) }` expone detalles internos de errores de infraestructura en la respuesta HTTP 500.

**Qué hay que hacer:**

1. Agregar `export const runtime = 'nodejs';` en `src/app/api/cron/sweep/route.ts`.
2. Validar el header usando `timingSafeEqual` de `node:crypto` (verificando previamente que `serverEnv.CRON_SECRET` no sea vacío y que `Buffer.byteLength(authHeader) === Buffer.byteLength(expectedAuth)` antes de llamar a `timingSafeEqual`).
3. Devolver únicamente `{ error: 'Internal Error' }` con status `500` en la respuesta HTTP.

---

#### `PR68-H05` · Tests parcialmente tautológicos (`P04`), mock con `id` en lugar de `profile_id` en `route.test.ts:103` y 0 tests de errores / fronteras (`alto`)

- **Archivo:** `src/server/cron/sweep.test.ts:21-141` y `src/app/api/cron/sweep/route.test.ts:103`
- **Patrón:** `P04-test-tautologico`

1. En `src/app/api/cron/sweep/route.test.ts:103`, el mock de `merchants` devuelve `{ id: 'merchant-2', paid_until: '2026-08-01' }` cuando `sweep.ts:108` selecciona `profile_id, paid_until`. Como consecuencia, `merchant.profile_id` es `undefined` y `sweep.ts` invoca `.in('profile_id', [undefined])`, pasando en verde sin que el test lo detecte.
2. En `src/server/cron/sweep.test.ts`, no se afirma que `delivery_requests.update`, `offers.update`, `courier_documents.update` o `merchants.update` reciban los payloads e IDs correctos (p. ej., que `'merchant-active-2'` no sea incluido en el `.in('profile_id', ...)`).
3. No existe ningún test para:
   - fallo de `storage.from('courier-docs').remove()` (comprobando que **no** se marque `purged_at` ni `audit_log`),
   - error de DB en `platform_settings` o en queries/updates (comprobando que `route.ts` devuelva `500`),
   - comercio dentro de la ventana de `subscription_grace_days` (p. ej., `paid_until` vencido ayer con `grace_days = 2` → **no** debe expirar),
   - comercio evaluado a las `22:30` hora de Argentina (`-03:00`, `01:30Z` del día siguiente) cuyo `paid_until` es ese mismo día en Argentina (**no** debe expirar).

**Qué hay que hacer:**
Corregir `route.test.ts:103` (`profile_id: 'merchant-2'`) y añadir en `sweep.test.ts` / `route.test.ts` las pruebas para cada uno de los casos anteriores (demostradas en rojo antes de aplicar la corrección en `sweep.ts`).

---

#### `PR68-H06` · Job `approval-policy` en `FAILURE`, cuerpo de PR fuera de plantilla, DoD sin marcar en `T-104.md`, bitácora desactualizada y `prettier` en `sweep.ts` (`alto`)

- **Archivo:** Cuerpo de PR #68, `docs/tasks/T-104.md:26-29`, `docs/tasks/log/T-104.md:47`, `src/server/cron/sweep.ts`
- **Patrón:** `P19-cuerpo-de-pr-fuera-de-template`

1. `.github/workflows/approval-policy.mjs:23-53` evalúa `pull_request.body` buscando la sección `### Informe de revisión de agy` con las 6 líneas planas del formato de `revisar-pr` (sin encabezados `### ` internos). El informe fue publicado como comentario pero no en la descripción (`body`) de la PR #68, donde además faltan las secciones de `.github/PULL_REQUEST_TEMPLATE.md` (`### Evidencia de checks`, `### Checklist de seguridad` obligatorio por tocar `src/server/`, `### Rollback`).
2. En `docs/tasks/T-104.md:26-29`, las 4 casillas del DoD siguen desmarcadas (`- [ ]`).
3. En `docs/tasks/log/T-104.md:47`, la bitácora quedó en `Último commit: 624b2ed` (faltan los commits posteriores).
4. `npx prettier --check src/server/cron/sweep.ts docs/tasks/T-104.md docs/tasks/log/T-104.md` reporta problemas de formato tras `e6d0b78`.

**Qué hay que hacer:**
Ejecutar `pnpm format` (`npx prettier --write` sobre los archivos tocados), marcar las casillas verificadas en `docs/tasks/T-104.md`, actualizar `docs/tasks/log/T-104.md` al cerrar la sesión y actualizar el `body` de la PR #68 con la plantilla completa de `.github/PULL_REQUEST_TEMPLATE.md`.

---

### 🟡 MEJORAS (2)

#### `PR68-H07` · Unificar `audit_log.target_type` en singular (`'delivery_request'`, `'courier_document'`, `'merchant'`) e incluir `before` (`bajo`)

- **Archivo:** `src/server/cron/sweep.ts:42, 76, 137`
- **Patrón:** `P06-enumeracion-incompleta`

En `ADR-0002` §3.1 línea 56 (`entity_type = 'courier_document'`) y en todas las funciones RPC de `supabase/migrations/20260924013700_rpc_admin_v1.sql` (`'courier'`, `'courier_document'`, `'merchant'`, `'platform_setting'`), la columna `target_type` de `public.audit_log` se escribe en **singular**. En `sweep.ts` se usaron nombres en plural (`'delivery_requests'`, `'courier_documents'`, `'merchants'`), lo que divide las consultas por el índice `audit_log_target_idx (target_type, target_id, created_at desc)`. Se recomienda usar singular (`'delivery_request'`, `'courier_document'`, `'merchant'`) y poblar también el campo `before` (por ejemplo, `before: { status: 'published' }` y `before: { subscription_status: 'active', paid_until: merchant.paid_until }`).

#### `PR68-H08` · Reemplazar el doble cast `as unknown as ReturnType<typeof createAdminClient>` en los tests (`bajo`)

- **Archivo:** `src/server/cron/sweep.test.ts:125` y `src/app/api/cron/sweep/route.test.ts:142`
- **Patrón:** `P12-plantilla-propaga-antipatron` (`AG-59`)

Extraer un helper de mock tipado para `createAdminClient` en los tests de modo que no sea necesario recurrir a `as unknown as ReturnType<typeof createAdminClient>`.

---

## Contraste con la autorrevisión previa (`autorrevision-agy.md`)

En el commit `8872b89`, el agy que implementó la tarea escribió la carpeta `docs/revision-pr/pr-68/` firmando como `Revisión independiente agy`, declarando `SIN BLOQUEANTES`, dejando `hallazgos.jsonl` vacío (0 registros) y afirmando en prosa que `route.ts` validaba `CRON_SECRET` con `crypto.timingSafeEqual` (cuando `route.ts:9` usaba `!==`). La revisión independiente con **El Consejo** detectó 6 bloqueantes —incluyendo la retención indefinida de DNI/selfie ante fallos de Storage (`PR68-H01`), la expiración prematura de comercios 3 horas antes por usar fecha UTC en vez de `canMerchantPublishRequest` (`PR68-H02`), la condición de carrera TOCTOU y el fallback silencioso `AG-54` (`PR68-H03`), y la ausencia real de `timingSafeEqual` (`PR68-H04`)—. Se preserva la autorrevisión original en [`autorrevision-agy.md`](autorrevision-agy.md) como evidencia del proceso (`COMO-ENTREGAR.md`).
