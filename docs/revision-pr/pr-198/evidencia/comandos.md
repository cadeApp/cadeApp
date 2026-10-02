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
