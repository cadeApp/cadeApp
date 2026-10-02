# Evidencia y comandos — PR #204

## Ronda 1

**SHA funcional:** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`  
**Decisiones P1:** `23cf11f8e86a6c9ff7f5387f9ab673a328397de1` + `b9e2a05847cfd273076025aad45400a8398531c4`

### Sync

```text
develop = 6577d9e427c5efc0a79a2c374f0f74d847732f4d
head    = 8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c
ahead   = 3
behind  = 38
status  = diverged
```

### H01

`authorization.spec.ts` usa:

```ts
const admin = createAdminClient();
await admin.rpc('admin_suspend_courier', ...)
```

La RPC usa `perform app_private.assert_admin_aal2();`, y esa función devuelve `UNAUTHENTICATED` cuando `auth.uid()` es null. El código productivo de `suspendCourierAction` usa cliente de sesión AAL2 y documenta “NUNCA createAdminClient”.

### H02

La bitácora pega:

```text
- Expected: action=allow
+ Received: action=redirect
```

El árbol entregado espera `redirect`. El RED se obtuvo mutando el expected.

### H03

`develop:.github/workflows/e2e-preview.yml` ejecuta:

```text
e2e/specs/smoke.spec.ts
e2e/specs/main-flow.spec.ts
```

No ejecuta `authorization.spec.ts`.

### H04

Barrido del spec: `getByText` solo en líneas 59 y 150 para los dos estados revisados. `e2e/AGENTS.md` exige rol/label accesible.

### H05

`docs/tasks/log/T-305.md:41` declara que falta ejecución E2E, mientras el body marca el DoD completo como `[x]` y no sigue el template.

### CI observado

Run `36970896014` / CI #863 — success en lint/typecheck/unit/build/audit/db-tests/bundle-budget. No ejecuta `authorization.spec.ts`, por lo que no se usa como cierre de T-305.

### Mutación independiente prevista para Ronda 2

Objetivo: cambiar temporalmente, dentro de `evaluateRouteGuard`, la rama de rol incorrecto en rutas courier para devolver `{ action: 'allow' }`; ejecutar:

```bash
pnpm exec playwright test e2e/specs/authorization.spec.ts \
  --grep "Falla al desactivar el chequeo de submit_offer o la guarda" \
  --project=chromium
```

La mutación se restaura desde una copia en memoria/`/tmp`, nunca con `git checkout`. Si queda GREEN, H02 sigue abierto. Si queda RED por la aserción de redirect y luego GREEN restaurado, la mutación queda matada.

No se ejecutó este harness desde la sesión del reviewer porque este entorno no tiene checkout/red del repo; no se registra como verificado-runtime.

### Decisión 3-A — bootstrap del gate

`repository_dispatch` ejecuta la definición de `e2e-preview.yml` que vive en la rama default (`develop`). Por eso, aunque #204 agregue `authorization.spec.ts` al workflow de su propia rama, ese cambio no puede gobernar el `repository_dispatch` de la misma #204 antes del merge.

P1 decidió:
- corregir el gate dentro de #204;
- permitir que #204 llegue a estado mergeable sin un GREEN remoto de `authorization.spec.ts` en ese mismo PR;
- mantener **T-305 / #37 abierta** hasta que una PR posterior produzca un `e2e-preview` GREEN ejecutando `authorization.spec.ts`;
- usar `Refs #37` en #204, no `Closes #37`.

Esto separa “PR apta para merge” de “tarea terminada” y evita declarar evidencia que técnicamente no puede existir pre-merge.

## Ronda 2

**SHA funcional:** `328e63ad9ba44f3fd2281fb8bc758b95533d3429`

### Sync

```text
develop = 721f6e0b0fcbab466ce97812c2a31694a2fbff88
head    = 328e63ad9ba44f3fd2281fb8bc758b95533d3429
ahead   = 13
behind  = 20
merge-base = cb4111273da663f7591aec370a44767c4e677b82
```

GitHub reporta mergeable=true. Los 20 commits nuevos de develop incluyen cambios de contratos/tipos y deben integrarse antes de la siguiente validación exact-head.

### CI exact-head

Run **37047363108 / CI #914** — success.

```text
Vitest: 113/113 archivos, 1678/1678 tests
verify-workflows: 47/47
ADR: 6/6
db-tests: Files=14, Tests=1645, PASS
```

Jobs GREEN: unit, typecheck, lint, build, audit, db-tests, bundle-budget.

### e2e-preview exact-head

Run **37047498248** apuntó correctamente a `328e63a`, verificó Supabase Develop y health, y falló en el gate por **T-303 Flujo 4**.

Salida relevante:
```text
8 passed
1 failed: T-303 Flujo 4 — Ordenamiento de ofertas recibidas por documentación y precio
retry: Expected courier name / Received "Repartidor"
```

El comando ejecutado por el workflow confiable de develop no incluyó `authorization.spec.ts`, exactamente por el bootstrap documentado en decisión 3-A.

### H01

Inspección: admin transitorio + TOTP + challengeAndVerify + AAL2 + RPC con cliente de sesión. Cleanup registra el UUID como user. Sin fallback service-role.

### H02

Bitácora nueva:
```text
Expected: redirect
Received: allow
1 failed
...
1 passed
```

Eso sí corresponde a romper la implementación. El reviewer intentó clonar para repetirla, pero el entorno devolvió:
```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com
```

Por eso queda `arreglado-sin-verificar`, no `arreglado-verificado`.

### H06 — sesión compartida

`authorization.spec.ts` usa el mismo `page`:
```ts
await loginAsMerchant(page);
...
await loginAsCourier(0, page);
```

`loginAsCourier` hace `LoginPage.navigate()` → `/login`, pero `evaluateRouteGuard('/login', merchantSession)` retorna redirect a `/merchant/dashboard`. Debe limpiarse/aislarse la sesión antes del segundo login.

### H05 — rollback incorrecto

El body propone `git revert 328e63ad...`. El diff real de ese commit es únicamente:
```diff
- **Último commit:** `TBD`
+ **Último commit:** `1bae33d`
```

No revierte ni el spec ni el workflow.

## Ronda 3

**SHA:** `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`

### H06

```ts
await page.context().clearCookies();
await page.evaluate(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
await loginAsCourier(0, page);
```

Inspección: la sesión merchant se elimina antes de volver a `/login`; no hay mock ni bypass del middleware.

### CI exact-head

- CI run: `37051189722` — GREEN.
- e2e-preview status: GREEN, run `37051338095`.
- Log e2e: `Running 9 tests using 1 worker` → `9 passed (2.8m)`.
- El comando del workflow confiable de develop no incluyó `authorization.spec.ts`; residual 3-A sigue abierto.

### Drift de base

```text
develop = ff5c51f7edd003c152f56a2bd2edc0cf2feab698
head    = b20d7cb4f5d1199e06610d6b9ed604ab07f172d8
ahead   = 16
behind  = 4
```

Los cuatro commits nuevos corresponden a T-329 y agregan el gate `subscription.global-settings.spec.ts` + su control en `verify-workflows.test.mjs`.

El `refs/pull/204/merge` observable contiene authorization + request-states, pero no global-settings. Por eso se exige sincronización antes de cerrar.

### H05

El body ya corrigió casi todo, pero el informe quedó sin saltos: `...Lautaro073Resultado: CON BLOQUEANTES...`. Debe reemplazarse por el informe literal de Ronda 3 y luego actualizar el run exact-head tras la sincronización.
