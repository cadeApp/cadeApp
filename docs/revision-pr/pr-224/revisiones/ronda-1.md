# Informe de revisión — PR #224 / T-308 — Ronda 1

**SHA revisado:** `9c2a5f3447f0b8e3c4c215cda0846088e75b8507`  
**Rama:** `feat/T-308-incidents-e2e`  
**Base del autor:** `125728b591950f0de2ecd520eea2617415ac9508`  
**develop al revisar:** `20db1bdbfd44f5a398dbfa984cc8ea291a56a493`  
**Fecha:** 2026-10-03

## Resultado

**CON 4 BLOQUEANTES: PR224-H01 a PR224-H04.**

Además, la rama está **49 commits detrás de develop**. No hay decisiones 🔵 de P1 en esta ronda: la ficha y los contratos existentes determinan las correcciones.

## Alcance y sincronización

T-308 autoriza:

```text
e2e/specs/incidents.spec.ts
docs/tasks/T-308.md
docs/tasks/log/T-308.md
docs/revision-pr/**
```

El SHA del autor modifica solo:

```text
docs/tasks/log/T-308.md
e2e/specs/incidents.spec.ts
```

No hay ampliación de ficha.

Comparación al iniciar la ronda:

```text
origin/develop...HEAD
behind: 49
ahead: 3
merge-base: 125728b591950f0de2ecd520eea2617415ac9508
```

Los 49 commits de develop incluyen cambios en `e2e/AGENTS.md`, `e2e/fixtures/**`, workflows E2E, `e2e/specs/request-states.spec.ts` y `src/server/e2e/staging-seed.ts`. La próxima reparación debe traer develop por merge antes de tocar T-308.

## Barrido completo de la clase

Se recorrieron los cuatro tests nuevos de `e2e/specs/incidents.spec.ts`, no solo el primer fallo:

1. reporte desde viaje → bandeja admin;
2. suspendido no oferta en UI ni RPC;
3. suspendido no puede ser aceptado;
4. control específico de revalidación de `accept_offer`.

También se cruzaron sus precondiciones contra el esquema/RPC que ya existían en el **mismo base del autor**, para no atribuir defectos a cambios posteriores de develop.

---

## PR224-H01 · ALTO · BLOQUEANTE
### El bootstrap de admin nunca puede completar

`createAdminWithAal2Session` crea:

```ts
admin.auth.admin.createUser({
  ...
  user_metadata: {
    role: 'admin',
  },
})
```

en `e2e/specs/incidents.spec.ts:69-82`.

Pero el esquema que ya estaba en el base `125728b5` dice explícitamente:

```sql
if requested_role not in ('merchant', 'courier') or requested_role is null then
  raise exception using errcode = 'P0001', message = 'INVALID_SIGNUP_ROLE';
end if;
```

y documenta que el bootstrap válido crea primero un merchant/courier y luego promueve el profile con service role.

Por tanto los tests que llaman a ese helper abortan en el setup antes de probar suspensión, MFA o bandeja. No es una incompatibilidad causada por los 49 commits nuevos: el contrato ya existía en el SHA base de esta PR.

### Corrección esperada

Después de mergear develop, reutilizar las fixtures canónicas de `e2e/fixtures` / `src/server/e2e/staging-seed.ts`:

- `seedAdminUser(stagingContext)`;
- `createAuthenticatedClient(credentials)`;
- `elevateAdminToAal2(client, credentials)` para RPC administrativas programáticas;
- `generateTotp` si hace falta el flujo MFA del navegador.

No mantener un segundo bootstrap que intente saltarse `handle_new_user`.

---

## PR224-H02 · ALTO · BLOQUEANTE
### DoD 1 crea un “matched trip” inválido

El setup crea una oferta con `status: 'accepted'` y luego cambia la solicitud a:

```ts
.update({
  status: 'matched',
  matched_at: new Date().toISOString(),
})
```

(`incidents.spec.ts:174-199`), pero no escribe `accepted_offer_id`.

El contrato `get_trip_details` del mismo base exige:

```sql
if v_request.accepted_offer_id is null then
  raise exception 'INVALID_STATE_TRANSITION';
end if;
```

y después busca la oferta aceptada exactamente por ese ID.

`/trips/[id]` obtiene el viaje mediante ese RPC. Con la fixture actual el viaje no llega a renderizarse correctamente y el test no puede alcanzar “Reportar un problema”.

### Corrección esperada

Tras traer develop, usar `seedDeliveryRequestInState` para preparar una precondición coherente, por ejemplo:

```ts
const matched = await seedDeliveryRequestInState(stagingContext, {
  status: 'matched',
  merchantId: merchant.id,
  assignedCourierId: courier.id,
  withContacts: true,
});
const targetRequestId = matched.requestId;
```

El helper canónico crea la oferta aceptada, enlaza `accepted_offer_id` y registra todo para cleanup. No repetir manualmente una transición parcial.

---

## PR224-H03 · MEDIO · BLOQUEANTE
### El helper de login espera lo contrario de lo que DoD 1 necesita

DoD 1 hace:

```ts
await loginPage.login(adminEmail, adminPassword);
await adminPage.waitForURL(/\/login\/mfa/);
```

(`incidents.spec.ts:239-248`).

Pero `LoginPage.login()` define su finalización así:

```ts
await this.page.waitForURL(
  (url) => url.pathname !== '/login' && !url.pathname.startsWith('/login/'),
  { timeout: 30000 }
);
```

El método **no retorna mientras el navegador esté en `/login/mfa`**. El test intenta esperar MFA después de una llamada que solo termina cuando MFA ya dejó de ser la ruta; queda bloqueado hasta timeout.

### Corrección esperada

No modificar `LoginPage.login()` — su contrato sirve al flujo normal y no está en el alcance de T-308. En este test usar sus locators accesibles de forma explícita:

```ts
await loginPage.navigate();
await loginPage.emailInput.fill(adminCredentials.email);
await loginPage.passwordInput.fill(adminCredentials.password);
await loginPage.submitButton.click();
await adminPage.waitForURL(/\/login\/mfa/);
```

Luego generar el TOTP en ese momento y completar el formulario MFA.

---

## PR224-H04 · ALTO · BLOQUEANTE
### La evidencia no demuestra que los cuatro E2E protejan el DoD

La bitácora registra:

```text
pnpm exec playwright test --list
4 tests descubiertos
```

Eso demuestra discovery, no ejecución.

La supuesta fase RED contiene solo:

```text
Expected: true
Received: false
```

sin nombre de test, mutación aplicada, aserción alcanzada ni relación con cada uno de los cuatro controles. Después aparece el fail-closed del entorno local. No hay una salida GREEN de `incidents.spec.ts`.

Esto repite las lecciones AG-68/AG-70: nombrar o describir un RED no demuestra que la mutación haya ejecutado y matado el control.

### Corrección esperada

Después de H01-H03:

1. ejecutar realmente los cuatro E2E contra el Preview + Supabase Develop mediante el gate vigente;
2. guardar en la bitácora el run/SHA y la salida resumida;
3. demostrar RED para cada control nuevo con una mutación temporal que rompa su propiedad, y copiar el nombre exacto del test que falla;
4. revertir todas las mutaciones antes del commit final;
5. no crear mocks de DB, no sustituir RPC por fakes y no cambiar expectativas solo para obtener verde.

Para DoD 4, la sonda debe demostrar que el test queda rojo cuando la aceptación logra avanzar pese a que el repartidor fue aprobado al crear la oferta y suspendido **después**. No alcanza una aserción unitaria sobre `evaluateRouteGuard` o `canReportIncident`: son propiedades distintas.

---

## Lo que sí está bien encaminado

- La suite cubre las cuatro caras pedidas por la ficha: bandeja, bloqueo de oferta, bloqueo de aceptación y revalidación.
- Los casos 3/4 construyen la secuencia conceptualmente correcta: la oferta nace antes de la suspensión y `accept_offer` se invoca después, que es la condición necesaria para detectar una revalidación ausente.
- `submit_offer` comprueba `COURIER_SUSPENDED` antes del piso dinámico de oferta, por lo que los montos fijos de estos casos no desvían ese rechazo concreto.
- No se detectó cambio de alcance en la ficha.

## CI

No se inspeccionó el CI completo para declarar readiness: la ronda tiene bloqueantes estáticos previos. La revisión del CI del SHA corregido se hará cuando H01-H04 estén resueltos. El color de Vercel por sí solo no sustituye la ejecución E2E.

## Conclusión

**NO MERGEAR PR #224 todavía.**

Primero: traer `origin/develop` por merge. Después corregir H01-H03, producir evidencia real para H04 y volver a revisión.
