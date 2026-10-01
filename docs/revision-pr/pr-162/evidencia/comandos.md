# Evidencia — PR #162 / T-320

## Ronda 1

- RED original: CI `36818656439` sobre `0de9f858`.
- Resultado: **25 failed / 1527 passed**.
- HEAD R1: `49bc8c92ddd225e65cc930a71f2104957eb1ef7e`.
- CI R1: `36820292693` verde, **1552/1552** unitarios y **1611/1611** DB.

## Ronda 2

SHA funcional: `b892e2a0d7e7b32f39b34350c188765edc6a8cd0`.

Desde el commit de revisión `4636dcc9bb5130b5bb307564c587e0975c804c34` hubo un solo commit de autor y seis archivos, todos autorizados:

```text
docs/tasks/log/T-320.md
src/app/auth/confirm/route.test.ts
src/features/auth/actions.test.ts
src/features/auth/actions.ts
src/features/auth/components/reset-password-form.test.tsx
src/features/auth/components/reset-password-form.tsx
```

### H01

- producción inspecciona `signOutError`;
- `{ error }` -> `INTERNAL_ERROR`;
- rechazo -> `INTERNAL_ERROR`;
- `{ error:null }` -> camino verde.

Mutaciones independientes por inspección:
- quitar el check de `signOutError` rompe el test M01;
- volver el `catch` best-effort rompe M02.

### H02

Se eliminó matching sobre `error.message`.

Caso adversarial:

```text
code=unknown_failure
name=AuthApiError
message=Session backend unavailable
esperado=INTERNAL_ERROR
```

Reintroducir `.includes('session')` vuelve el caso rojo.

### H03

Casos del handler:

```text
%2F%2Fevil.com
https%3A%2F%2Fevil.com
%2F%5Cevil.com
%252F%252Fevil.com
```

Todos exigen 303 y `Location=http://localhost:3000/merchant/dashboard`.

### H04

Control:
- link `/forgot-password` sin `button` descendiente;
- dos toggles;
- `min-h-12`;
- `min-w-12`;
- `focus-visible:ring-2`;
- sin `focus:outline-none`.

### CI R2

Run `36822459862`:

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success

Test Files 110 passed (110)
Tests      1559 passed (1559)
Files=13, Tests=1611
Result: PASS
[db:types] Tipos generados exitosamente
```

## develop actual

`develop = 7c2f9e6d924dc034e23ae3f093f16f95e0906bf5`.

La rama está detrás solo por:

```text
f56b65fb docs(T-319): add hosted auth email task [T-319]
d6b05ef3 docs(T-319): register task in implementation plan [T-319]
7c2f9e6d Merge PR #163 — ficha T-319
```

Archivos afectados: `docs/tasks/T-319.md` y `docs/implementation-plan.md`. Sin impacto funcional sobre T-320.

## Residual manual

Sigue pendiente:
- Redirect URLs en Supabase Dashboard;
- evidencia E2E real en staging.
