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
