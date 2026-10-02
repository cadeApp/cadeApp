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

### 1. Sincronización actual

Consulta GitHub compare:

```text
develop: 6577d9e427c5efc0a79a2c374f0f74d847732f4d
PR head: 0a70b6819e67a8c83c6b8ddb8a5f160ff5096240
status: diverged
ahead_by: 9
behind_by: 30
```

La rama debe volver a integrar `origin/develop`. El nuevo delta contiene T-327 (Preview E2E + Supabase Develop).

### 2. Corrección H01/H02 inspeccionada

Commit del agy:

```text
062d29679b811abac246b0fd1d5a53a532c6f83b
feat(e2e): resolve round 1 review findings for notifications and resilience [T-307]
```

H01 ya usa:
- solicitud real de `stagingContext`;
- login real;
- inserción real en `offers`;
- UI real del detalle;
- cero `page.route().fulfill()` para fabricar la oferta;
- cero `fetch()` manual para hacer aparecer el resultado.

H02 ya usa:
- listener exclusivo del path `/api/live/requests/<requestId>/offers`;
- baseline;
- `setOffline(true)` / `setOffline(false)`;
- cero `/api/health` manual;
- cero `_rsc`;
- cero `navigator.onLine` como oráculo.

### 3. PR180-H05 — carrera reproducible por inspección

Código funcional relevante:

```text
notifications.spec.ts:122  page.goto(/merchant/requests/<id>)
notifications.spec.ts:124  waitForNoSkeletons
notifications.spec.ts:127  courier no visible
notifications.spec.ts:131  INSERT offer
notifications.spec.ts:147  espera UI
```

Producto:

```text
use-request-offers.ts:
  initialDataUpdatedAt: 0
  staleTime: 0
  queryFn -> GET /api/live/requests/<requestId>/offers
  refetchInterval: 30_000
```

El test no espera que el GET inicial termine antes del INSERT. Por lo tanto, una respuesta inicial tardía puede incluir la nueva oferta y satisfacer la UI incluso sin evento Realtime. El timeout de 15 s solo excluye el polling de 30 s.

Mutación RED exigida para la próxima ronda:
1. esperar la respuesta inicial exacta;
2. fijar baseline;
3. bloquear Realtime temporalmente;
4. insertar oferta;
5. comprobar que no hay segunda request/UI dentro de 15 s;
6. restaurar Realtime y demostrar GREEN.

### 4. CI del SHA revisado

Run: `36972452441` — **SUCCESS**.

Jobs:
- typecheck ✅
- lint ✅
- unit / `pnpm test:coverage` ✅
- workflow tests ✅
- ADR tests ✅
- db-tests ✅
- build ✅
- audit ✅
- bundle-budget ✅

Esto permite cerrar H03 como problema de evidencia: la ficha ya no falsifica el DoD y los componentes de tests están verdes en CI. El comando final se vuelve a ejecutar tras el próximo merge de `develop`.

### 5. Vercel Preview del SHA

Deployment:
```text
dpl_6Rk7k6S7hyuUnGEsRViuDcBGkBpj
project: cadeapp-develop
branch: feat/T-307-notificaciones-resiliencia
sha: 0a70b6819e67a8c83c6b8ddb8a5f160ff5096240
state: READY
```

Health:
```text
GET https://cadeapp-develop.vercel.app/api/health
HTTP 200
{"status":"ok"}
```

### 6. Cuarta Regla / T-327

En el `develop` actual existe `.github/workflows/e2e-preview.yml` con Environment `develop`, Supabase Develop y Vercel Preview del SHA exacto.

Su comando actual es:

```text
pnpm exec playwright test
  e2e/specs/smoke.spec.ts
  e2e/specs/main-flow.spec.ts
  --project=chromium
  --workers=1
```

**No incluye `e2e/specs/notifications.spec.ts`.**

Consulta de runs para el SHA revisado:

```text
repository_dispatch / head_sha=0a70b681...
total_count: 0
```

El deployment de PR #180 ocurrió antes de que la infraestructura T-327 estuviera disponible en la rama por defecto. Además, incluso un nuevo GREEN de la configuración actual solo probaría smoke + main-flow.

Se dejó follow-up en **issue #205 / T-327** para habilitar una vía trusted de ejecución de `notifications.spec.ts`. No se modifica el workflow desde PR #180 porque el diseño de seguridad exige que el job que recibe secrets provenga de la rama por defecto.

### 7. Evidencia del autor no aceptada como verificación

La bitácora del agy registra:
- Tests 1 y B bloqueados por fail-closed local;
- H02 RED no ejecutado;
- y a la vez afirma H01 RED + GREEN.

No hay output reproducible ni corrida remota del SHA que sostenga H01. La revisión no lo usa como evidencia de cierre.

### 8. Estado final de Ronda 2

```text
H01 original  -> arreglado-verificado
H02           -> arreglado-sin-verificar (falta RED/GREEN real)
H03           -> arreglado-verificado
H04           -> arreglado-verificado
H05           -> abierto
D01 1-A       -> aplicado
Infra T-327   -> follow-up abierto en #205
```
