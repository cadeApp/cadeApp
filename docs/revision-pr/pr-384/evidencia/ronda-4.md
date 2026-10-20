# Evidencia R4 — PR #384 / T-357

**SHAs:** `25a0a5ea48f8d3d3b052c9eeced8e6c8f619cb68` (RED), `523b49896b495e5faea4e6ef7fae577e249cf874` (corrección del locator, sin GREEN por cancelación).

## CI y E2E del runner, no estimados

- CI https://github.com/cadeApp/cadeApp/actions/runs/39011253559: 136/136 unit files y 2528/2528 tests PASS. DB `Files=26, Tests=2341` PASS. Build/lint/typecheck/audit PASS.
- E2E antiguo https://github.com/cadeApp/cadeApp/actions/runs/39011316740: job 117334308478, test `courier-onboarding.spec.ts:1077` FAIL en línea 1134 con:
  `strict mode violation: getByText('Repartidor asignado') resolved to 2 elements`.
  Los matches fueron `h2` del card y un `div` que contenía la frase dentro de mensaje de WhatsApp. Tres intentos con el mismo error. `82 passed, 1 failed` Chromium. `global-settings` no iniciado.
- Commit de autor `523b4989`: diff de 1 línea `getByText('Repartidor asignado')` → `getByRole('heading', { name: 'Repartidor asignado' })`.
- CI nuevo https://github.com/cadeApp/cadeApp/actions/runs/39014614377: varios jobs core PASS; DB in_progress al registrar.
- E2E nuevo https://github.com/cadeApp/cadeApp/actions/runs/39014666112: run `completed/cancelled`; `e2e-preview: error`. **No hubo resultado de la prueba de vista de viaje**, ni PASS ni nuevo RED funcional.
- El HEAD fue comprobado explícitamente antes de escribir estos archivos. La revisión no ejecutó pnpm local, Docker, Supabase remoto, ni mutaciones runtime propias.

## Comandos para reproducir / certificar en entorno autorizado

```bash
git fetch origin
git rev-parse HEAD
git ls-remote origin feat/T-357-actualizar-vehiculo-perfil
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/courier-onboarding/actions.test.ts
pnpm exec vitest run src/features/courier-onboarding/schemas.test.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git diff --check
node docs/revision-pr/analizar.mjs verificacion
```

E2E deberá correr **automáticamente** con el gate de Preview sobre el SHA integrado; no relanzar workflows manualmente ni desplegar mutaciones de seguridad. Si el siguiente run da error, descargar sus logs y comprobar si es infraestructura o assertion concreta, sin inventar verificación.

### Aserciones de vista de viaje que deben quedar protegidas

```ts
const assignedHeading = merchantBrowserPage.getByRole('heading', {
  name: 'Repartidor asignado',
  exact: true,
});
await expect(assignedHeading).toBeVisible();
const card = assignedHeading.locator('xpath=../..');
await expect(card.getByText('Moto', { exact: true })).toBeVisible();
await expect(card.getByText(/Patente:.*AB 123 CD/)).toBeVisible();
// Cambio desde UI del repartidor, merchantBrowserPage.reload()
await expect(card.getByText('Auto', { exact: true })).toBeVisible();
await expect(card.getByText(/Patente:.*ELA 666/)).toBeVisible();
// Nuevo cambio desde UI y reload
await expect(card.getByText('Bicicleta', { exact: true })).toBeVisible();
await expect(card.getByText(/Patente:/)).toHaveCount(0);
```

Los oráculos paralelos `merchantClient.rpc('get_trip_details')` deben seguir exigiendo `moto/AB 123 CD`, `car/ELA 666`, `bike/null`. Esto es una guía de prueba, **no** afirma que el código propuesto ya haya pasado E2E.

## Modificaciones realizadas por revisión

Solo `docs/revision-pr/pr-384/**`; no se tocó `develop`, SQL, app, CI ni secrets. El push del informe cambia el HEAD y puede reactivar checks: no atribuirle resultados previos al commit de documentación.
