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
  await waitForURL(/\\/login\\/mfa/)

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


---

# Evidencia — PR #224 / Ronda 2

## SHA y sincronización

```text
HEAD revisado: 4370ddc741bd8be21e7ab5b93add6b9455034ed9
merge develop del autor: 508d619c59190c190ecef0f53b9f242de3bf52bc
develop actual: 3e5d5381dbf59717763f1927e1cf080504a9ebf1
behind actual: 5
```

## Gate E2E real

Commit status:

```text
context: e2e-preview
state: failure
description: trusted E2E gate RED contra el Preview
run: 37144346616
```

Job `e2e-preview`:

```text
23 passed
1 failed
```

Único fallo:

```text
DoD 1: El reporte llega a la bandeja de administración
e2e/specs/incidents.spec.ts:66

Locator: getByRole('radio', { name: /problema con el pago/i })
Expected: visible
Received: <element(s) not found>
Timeout: 10000ms
```

El mismo fallo ocurrió en ejecución inicial y retries #1/#2.

DoD 2/3/4 pasaron.

## Copy real

```text
src/features/incidents/copy.ts:9
payment_issue: 'Problema con el cobro'

:33
descriptionLabel: '¿Qué pasó?'

:39
success: 'Recibimos tu reporte. La administración lo va a revisar.'
```

Selectores desactualizados enumerados en el spec:

```text
:65  /problema con el pago/i
:69  /¿qué sucedió\?/i
:77  /reporte enviado/i
:117 /problema con el pago/i
```

## CI normal

Run:

```text
37144198984
```

Jobs:

```text
typecheck       success
lint            success
build           success
db-tests        success
bundle-budget   success
audit           failure
unit            failure
```

Unit:

```text
Test Files: 113 passed / 1 failed
Tests: 1737 passed / 1 failed
único fallo: tools/verify-fichas.test.ts
Desincronizadas: T-333
```

Audit: advisory `braces`.

Los 5 commits actuales de develop incluyen:

- T-333: sincroniza/cierra la inconsistencia de T-333;
- T-332: excepción audit de `braces` documentada y guardada;
- T-334: cambios de auth/guards relevantes para revalidar H03.

## Estados R2

```text
H01 arreglado-verificado — gate real DoD2/3
H02 arreglado-verificado — DoD1 llegó al Dialog
H03 arreglado-sin-verificar — flujo MFA aún no alcanzado
H04 parcial — gate real existe, pero está RED y no hay mutaciones RED ejecutadas
H05 abierto — cuatro copies viejos; primer caso verificado-runtime
```


---

# Evidencia — PR #224 / Ronda 3

## SHA y sincronización

```text
HEAD revisado: cc3813f05d110c9248f5186decf0fe941f39880a
develop: 59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3
behind: 0
ahead: 10
```

## Commits posteriores a R2

```text
d4c7a665 merge origin/develop
72f95c8 fix selectors H05
cc3813f update bitácora y bloqueo Vercel
```

El autor no tocó `docs/revision-pr/pr-224/**`.

## H05

Spec final:

```text
:65  /problema con el cobro/i
:69  /¿qué pasó\?/i
:77  /recibimos tu reporte/i
:117 /problema con el cobro/i
```

Coinciden con el copy canónico inspeccionado en R2.

No existe E2E runtime posterior al arreglo.

## Vercel

Status de `72f95c8` y `cc3813f0`:

```text
context: Vercel
state: failure
target: upgradeToPro=build-rate-limit
```

Comentario de Vercel en la PR:

```text
Resource is limited - try again in 24 hours
(more than 100, code: "api-deployments-free-per-day")
```

El workflow `.github/workflows/e2e-preview.yml` solo se activa por:

```text
repository_dispatch:
  vercel.deployment.success
  vercel.deployment.ready
```

y luego ejecuta Playwright contra la URL resuelta del deployment exacto. Sin deployment no existe gate para el SHA nuevo.

## CI final

Run `37184458436` sobre `cc3813f0` al corte:

```text
audit           success
lint            success
typecheck       success
build           success
bundle-budget   success
unit            failure
db-tests        in_progress
```

El único unit rojo:

```text
tools/verify-fichas.test.ts
Desincronizadas: T-336
Test Files: 117 passed / 1 failed
Tests: 1834 passed / 1 failed
```

No es un cambio de T-308; viene del develop integrado.

## Estados R3

```text
H01 arreglado-verificado
H02 arreglado-verificado
H03 arreglado-sin-verificar
H04 parcial
H05 arreglado-sin-verificar
```
