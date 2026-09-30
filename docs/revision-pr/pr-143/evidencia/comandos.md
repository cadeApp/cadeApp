# Evidencia — PR #143 / T-318 — Ronda 1

SHA revisado: `d843026b9d0e951278c954fdde7494dddbd88f56`.

## Alcance

Archivos propios del PR:
- `docs/implementation-plan.md`
- `docs/tasks/T-318.md`

No hay runtime ni bitácora en esta PR documental.

## Sincronización

`compare develop...head` al revisar:
- develop: `ec3c671db6f5ae5664f929925f5a77209bd57682`
- merge-base: `75950cdf2a8a47d5f0642c3caa479c6f364e13bc`
- status: diverged
- behind_by: 8
- ahead_by: 1

Los cambios entrados en develop desde la base vieja corresponden principalmente a T-301/E2E; no modifican `docs/implementation-plan.md`, pero la rama sigue necesitando sincronización antes del cierre.

## Sincronía ficha-plan

Primer DoD de T-318:

`Anti-enumeración: una respuesta sanitizada de Supabase (...) nunca se llama activate_account_consents con el id sanitizado.`

La celda DoD de la fila T-318 en `docs/implementation-plan.md` coincide exactamente: `exact=true`.

## Contradicción anti-enumeración

La ficha afirma:
- objetivo: nadie puede averiguar desde el cliente si un email ya tiene cuenta;
- DoD 1: alta nueva vs `identities: []` deben tener mismo `ok`, campos y navegación;
- DoD 3: `user_already_exists` / `email_exists` se tratan como `VALIDATION_ERROR`.

Por diseño de `ActionResult`, `VALIDATION_ERROR` implica camino de error, observable frente al camino de éxito del alta nueva.

### Fuente Supabase

Documentación `auth.signUp`: una cuenta existente puede devolver una respuesta que intenta ocultar esta información.

Fuente oficial `supabase/auth/internal/api/signup.go`:
- si `UserExistsError` y autoconfirm está habilitado, devuelve `ErrorCodeUserAlreadyExists`;
- si autoconfirm no está habilitado, usa `sanitizeUser`;
- `sanitizeUser` declara que debe usarse para evitar filtrar si un usuario está registrado y establece `Identities=[]`.

Por tanto ambos caminos representan variantes de la misma información sensible y la ficha no debe hacer públicamente distinguible uno de ellos.

## CI exact-head

- `tools/verify-fichas.test.ts`: 7/7 ✅
- Test Files: 103 passed
- Tests: 1383 passed
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- approval-policy ❌: falta informe independiente SIN BLOQUEANTES.

# Ronda 2

SHA revisado: `bb6e18be470af93f5a26306970240ae0e1e35e07`.

## H02

Primer DoD de T-318 y celda DoD del plan: `exact=true`.

Contenido verificado:
- cubre `identities: []`, `user_already_exists`, `email_exists`;
- mismo `ok`, shape/campos, navegación;
- sin ids distinguibles;
- sin copy que confirme existencia;
- sin `activate_account_consents`;
- mapper genuino separado.

Hashes de `docs/revision-pr/pr-143/**` en R1 vs head: idénticos en los cinco archivos, por lo que el autor no tocó la carpeta.

## H01

Al terminar la corrección el body declaró `0 4` contra `ec3c671`.

Al revisar:
- develop = `a16acd4831e2e538d4313e6821d3ebc4e7f758ac`;
- compare develop...head = behind 14 / ahead 4;
- los 14 commits posteriores a `ec3c671` modifican workflows CI/deploy/E2E y archivos T-301/E2E, no T-318 ni implementation-plan.

## CI exact-head

- verify-fichas: 7/7
- Test Files: 104 passed
- Tests: 1407 passed
- typecheck/lint/db-tests/build/bundle-budget/audit: success
- approval-policy: failure esperado por falta de informe SIN BLOQUEANTES.
