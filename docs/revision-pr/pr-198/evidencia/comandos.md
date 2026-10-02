# Evidencia reproducible — PR #198 / ronda 1

**SHA revisado:** `97314707933b07657a9b64ed8a305643c5d4157a`

Esta ronda fue estática porque quedaron bloqueantes antes de la fase de CI. No se levantó Docker ni Supabase local.

## Estado y divergencia

```
PR #198
head = 97314707933b07657a9b64ed8a305643c5d4157a
base = develop
compare develop...head => behind_by = 38, ahead_by = 2
```

## H01 — selección de proyecto / workflow

`playwright.config.ts` en develop:
```ts
{
  name: 'chromium',
  testIgnore: /global-settings\.spec\.ts$/,
},
{
  name: 'global-settings',
  testMatch: /global-settings\.spec\.ts$/,
  fullyParallel: false,
}
```

Nombre entregado:
```
e2e/specs/subscription.spec.ts
```

`.github/workflows/e2e-preview.yml` en develop:
```sh
pnpm exec playwright test
e2e/specs/smoke.spec.ts
e2e/specs/main-flow.spec.ts
--project=chromium
--workers=1
```

Resultado por inspección: el spec nuevo no entra ni en `global-settings` ni en el gate Preview actual.

## H02 — paid_until no decide

Spec:
```ts
await setPlatformSettingPilotActive(false);
await setMerchantSubscription(merchant.id, 'expired', '2020-01-01');
```

Dominio:
```ts
if (input.subscriptionStatus === 'cancelled' || input.subscriptionStatus === 'expired') {
  return err('SUBSCRIPTION_INACTIVE');
}
```

Resultado: cambiar/eliminar la rama de `paidUntil` no cambia este caso.

## H03 — publicación no observada

Spec positivo:
```ts
const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
await merchantPage.gotoRequestDetail(createdRequestId);
await expect(page.getByText(/paquete chico/i)).toBeVisible();
```

Flujo productivo observado:
```ts
const requestPayload = {
  // ...
  status: 'draft',
};
// ...
return ok({ requestId: createdRequest.id, redirectTo: '/merchant/requests' });
```

No hay llamada a `publish_request` en `createDeliveryRequestAction`.

## H04 — contradicción con seed

Fixture:
```ts
await seedStagingData(context, {
  requestsCount: 1,
  withMerchant: true,
});
```

Seed:
```ts
status: 'published',
notes: `E2E automated test run ${context.testRunId}`,
```

Test:
```ts
.eq('merchant_id', merchant.id)
.eq('status', 'published');
expect(requestRows?.length ?? 0).toBe(0);
```

## H05 — mutación sintética

```ts
const mutatedPublishCheck = (_input: typeof expiredMerchantInput) => ({
  ok: true as const,
  data: true as const,
});
const mutatedResult = mutatedPublishCheck(expiredMerchantInput);
expect(mutatedResult.ok).toBe(true);
expect(mutatedResult.ok).not.toBe(result.ok);
```

Este bloque no depende de `publish_request`.

## H06 — restauración hardcodeada

```ts
let initialPilotActive = true;
try {
  // leer
} catch {
  // fallback
}
// ...
expect(setting?.value).toBe(true);
```

## H07 — evidencia declarada

La bitácora del SHA revisado declara:
```
Pruebas: typecheck ✅ · lint ✅ · test ✅ · test:db n.a.
```
No declara un comando Playwright del spec. También mantiene:
```
Falta: Push de rama a origin y apertura del PR en Draft.
```
aunque la PR #198 ya estaba abierta.

## Batería de mutaciones para la próxima ronda

La revisión no reutilizará como prueba la función `mutatedPublishCheck` del autor. Tras mergear #209, la nueva verificación debe atacar al menos:

1. quitar/omitir el paso real que lleva la solicitud a `publish_request` → el caso positivo debe quedar RED porque `status` queda distinto de `published`;
2. romper la rama que invalida `paid_until` pasado manteniendo `subscription_status='active'` → el negativo debe quedar RED;
3. retirar la restauración de `pilot_active` → una relectura del valor original debe quedar RED;
4. volver a consultar “todas las published del merchant” en vez del marcador del caso → el control debe revelar la contaminación del seed, no ocultarla.

No se aceptará como mutación una función falsa, un mock que no atraviese el flujo real ni una expectativa cambiada para provocar artificialmente RED/GREEN.

# Evidencia reproducible — PR #198 / ronda 2

## Baseline

```text
HEAD funcional: 5ad81b8e13191c4ef9bc2d96339bf8dea30723ea
develop: ff5c51f7edd003c152f56a2bd2edc0cf2feab698
ahead: 12
behind: 0
```

CI:

```text
run 37052337255: success
```

Preview confiable:

```text
run 37052602334: success
checkout SHA: 5ad81b8
gate core: 9 passed
global-settings: 3 passed
```

Logs relevantes:

```text
if [ -f e2e/specs/subscription.global-settings.spec.ts ]; then
  pnpm exec playwright test e2e/specs/subscription.global-settings.spec.ts --project=global-settings --workers=1
fi

Running 3 tests using 1 worker
✓ DoD 1 ... SUBSCRIPTION_INACTIVE
✓ DoD 2 ... sí se publica
✓ DoD 3 ... paid_until futuro sí se publica
3 passed (44.8s)
```

## Mutación real

PR temporal: #216  
Branch: `review/T-306-mutation-no-publish`  
Commit: `2687be147930c5d9adcd71bf975ce6a4eebc579b`

Mutación única:

```text
src/features/requests/actions.ts
- se elimina callRequestRpc(..., 'publish_request', ...)
- la action continúa al ok(...)
```

Preview mutation run:

```text
37053309856: failure
gate core: 9 passed
global-settings:
DoD 1 failed + retry #1 failed + retry #2 failed
Expected SUBSCRIPTION_INACTIVE alert visible
Received element not found
```

Estado final de PR temporal:

```text
PR #216: closed
merged: false
```

La rama productiva T-306 no contiene la mutación.
