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
