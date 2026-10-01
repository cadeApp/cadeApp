# Evidencia — PR #140 / Ronda 1

SHA de implementación: `faef9f075b2eb29ba20a22cde2e1d58854d60ea7`.

## Sincronización y alcance

`compare develop...head`:
- status: ahead
- behind_by: 0
- ahead_by: 1

Archivos cambiados:
- `src/features/auth/actions.test.ts`
- `src/features/auth/actions.ts`
- `src/features/auth/components/register-form.test.tsx`
- `src/features/auth/components/register-form.tsx`
- `src/features/auth/copy.ts`

Todos están dentro de `src/features/auth/**`.

## H01 — tarea cerrada / branch

- Issue #10 `[T-009] Auth base`: closed/completed desde 2026-09-23.
- PR #60 ya implementó T-009.
- PR #140 usa nuevamente `[T-009]`, branch `fix/T-009-register-errors`, base `develop`, sin issue enlazado.
- `.agents/rules/50-git-y-coordinacion.md`: `feat/T-xxx-*` → develop; `fix/T-xxx-*` está descrito como hotfix desde main.
- `docs/tasks/log/T-009.md` no tiene sesión posterior al 2026-09-23.

## H02 — respuesta sanitizada de Supabase

Documentación actual de `auth.signUp`:
https://supabase.com/docs/reference/javascript/auth-signup

Indica que si una cuenta existe puede devolverse una respuesta que intenta ocultar esa información.

Fuente oficial de GoTrue:
https://github.com/supabase/auth/blob/master/internal/api/signup.go

La función `sanitizeUser` documenta que se usa para impedir filtrar si un usuario está registrado y asigna una lista vacía de identidades. La PR transforma esa señal en `CONFLICT` y luego en el mensaje “Ya existe una cuenta con ese email”.

## H03 — harness exacto del mapper

Se extrajo `signUpErrorCode` del SHA revisado y se evaluó con códigos representativos:

~~~text
user_already_exists          -> CONFLICT
email_exists                 -> CONFLICT
over_email_send_rate_limit   -> RATE_LIMITED
over_request_rate_limit      -> RATE_LIMITED
weak_password                -> VALIDATION_ERROR
email_address_invalid        -> VALIDATION_ERROR
unexpected_failure           -> VALIDATION_ERROR
email_provider_disabled      -> VALIDATION_ERROR
email_address_not_authorized -> VALIDATION_ERROR
captcha_failed               -> VALIDATION_ERROR
hook_timeout                 -> VALIDATION_ERROR
hook_timeout_after_retry     -> VALIDATION_ERROR
validation_failed            -> VALIDATION_ERROR
undefined                    -> VALIDATION_ERROR
~~~

Esto reproduce H03 sin depender de un mock escrito por el autor.

## H04 — cobertura de la rama catch

`register-form.test.tsx`:
- 4 casos de `registerAction.mockResolvedValue({ok:false, code})`
- 1 test de unicidad de mensajes
- 0 casos de `mockRejectedValue` / excepción.

Por lo tanto reemplazar en el catch `errorUnexpected` por `errorGeneric` no afecta ninguna aserción existente.

## H05 — evidencia

Bitácora del head: última entrada 2026-09-23.

Body de PR #140:
- focal auth 63/63
- mutaciones declaradas
- typecheck ✅
- lint ✅
- no declara `pnpm test` global.

## CI exact-head

Workflow CI `36777395119`:
- typecheck ✅
- lint ✅
- unit ✅
- db-tests ✅
- audit ✅
- build ✅
- bundle-budget ✅

Log unit:
- `src/features/auth/actions.test.ts`: 29 tests ✅
- `src/features/auth/components/register-form.test.tsx`: 5 tests ✅
- `Test Files 104 passed (104)`
- `Tests 1396 passed (1396)`
- verify-workflows: 29
- verify-adr: 6

`approval-policy` falla con:
`Falta el informe completo de revisar-pr sin bloqueantes.`

Ese rojo es esperado mientras existan hallazgos abiertos.

# Continuación Ronda 2 — PR #142 / T-318

SHA revisado: `9d34f42841ec9ed9875324e8d81f36dd7234315a`.

- H03: harness exacto del mapper confirmó allowlist correcta.
- H04: test rejected Server Action presente y ejecutado en CI (`register-form.test.tsx` 33 tests).
- H05: bitácora T-318 presente; CI exact-head 104 archivos / 1433 tests en verde.
- H01/H02 quedan parciales y se trasladan a los hallazgos propios de PR #142.
