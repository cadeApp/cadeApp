# Evidencia — PR #224 / Ronda 1

## SHA y sincronización

```text
PR: #224
rama: feat/T-308-incidents-e2e
HEAD autor: 9c2a5f3447f0b8e3c4c215cda0846088e75b8507
merge-base: 125728b591950f0de2ecd520eea2617415ac9508
develop al revisar: 20db1bdbfd44f5a398dbfa984cc8ea291a56a493
ahead: 3
behind: 49
```

Equivalente a:

```bash
git fetch origin
git rev-list --left-right --count origin/develop...HEAD
# 49  3
```

## Alcance

Diff del PR:

```text
docs/tasks/log/T-308.md
e2e/specs/incidents.spec.ts
```

La ficha T-308 fue leída desde develop, no desde la rama, y autoriza ambos archivos.

## H01 — bootstrap de admin

Spec revisado:

```text
e2e/specs/incidents.spec.ts:74-82
auth.admin.createUser(...)
user_metadata.role = 'admin'
```

Contrato en el **mismo base del autor**:

```text
supabase/migrations/20260922031435_schema_v1.sql:246-261

handle_new_user:
requested_role NOT IN ('merchant','courier')
→ P0001 INVALID_SIGNUP_ROLE
```

Por inspección, la llamada del spec no puede completar.

## H02 — matched incompleto

Spec:

```text
incidents.spec.ts:174-199
offer.status = accepted
delivery_requests.status = matched
delivery_requests.matched_at = now
accepted_offer_id = <no escrito>
```

Contrato CC-008 en el base:

```text
supabase/migrations/20260926010000_cc008_trip_details.sql:64-76
accepted_offer_id IS NULL
→ INVALID_STATE_TRANSITION
```

El flujo de `/trips/[id]` depende de `get_trip_details`, por lo que la precondición no llega al botón de reporte.

## H03 — contrato de LoginPage

```text
incidents.spec.ts:241-245:
  await loginPage.login(...)
  await waitForURL(/\/login\/mfa/)

e2e/pages/login.page.ts:33-41:
  login() espera hasta que pathname != /login
  Y pathname no empiece con /login/
```

Las dos condiciones no pueden cumplirse en el orden que espera el test.

## H04 — evidencia del autor

Bitácora:

```text
docs/tasks/log/T-308.md:19
pnpm exec playwright test --list
→ 4 tests descubiertos

:23-30
RED:
Expected: true
Received: false

:31-34
E2E Fail-Closed por entorno local no identificado

:35
Falta: monitoreo CI
```

No hay identificación de la mutación, nombre exacto del test rojo ni ejecución GREEN de los cuatro E2E.

## CI

No se inspeccionó el CI completo en esta ronda porque todavía existen bloqueantes estáticos. El procedimiento vigente difiere esa lectura hasta que la ronda esté en condiciones de aprobar. No se levantó Supabase ni Docker local.

## Mutaciones de revisión

No se modificó código ni se ejecutaron mutaciones remotas en esta ronda. H01-H03 son contradicciones deterministas entre el spec y contratos presentes en el propio SHA base. En la siguiente ronda, sobre el arreglo, la revisión reproducirá la evidencia RED que deje el autor y agregará sondas independientes.
