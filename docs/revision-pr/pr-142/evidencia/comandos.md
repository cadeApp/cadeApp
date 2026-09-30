# Evidencia — PR #142 / T-318 — Ronda 2

SHA: `9d34f42841ec9ed9875324e8d81f36dd7234315a`.

## Historia desde la revisión R1

`compare 29b6437...9d34f42841ec9ed9875324e8d81f36dd7234315a`: 2 commits, 8 archivos propios:
- docs/implementation-plan.md
- docs/tasks/T-318.md
- docs/tasks/log/T-318.md
- src/features/auth/actions.ts + test
- src/features/auth/components/register-form.tsx + test
- src/features/auth/copy.ts

El autor no modificó `docs/revision-pr/pr-140/**` después del commit de revisión.

## H03 heredado — mapper

Harness independiente sobre la función exacta:

~~~text
weak_password                -> VALIDATION_ERROR
email_address_invalid        -> VALIDATION_ERROR
validation_failed            -> VALIDATION_ERROR
over_email_send_rate_limit   -> RATE_LIMITED
over_request_rate_limit      -> RATE_LIMITED
user_already_exists          -> VALIDATION_ERROR
email_exists                 -> VALIDATION_ERROR
unexpected_failure           -> INTERNAL_ERROR
email_provider_disabled      -> INTERNAL_ERROR
email_address_not_authorized -> INTERNAL_ERROR
captcha_failed               -> INTERNAL_ERROR
hook_timeout                 -> INTERNAL_ERROR
hook_timeout_after_retry     -> INTERNAL_ERROR
unknown_code                 -> INTERNAL_ERROR
undefined                    -> INTERNAL_ERROR
~~~

## H04 heredado — catch

`register-form.test.tsx`:
- usa `registerAction.mockRejectedValueOnce(new Error('sentinel'))`;
- exige `errorUnexpected`;
- exige que `sentinel` no aparezca.

CI ejecutó el archivo con 33 tests verdes.

## PR142-H01 — anti-enumeración residual

Código exacto:
- `identities: []` -> `err('VALIDATION_ERROR')`;
- alta normal -> `ok({userId, role, redirectTo})`.

La documentación actual de Supabase `auth.signUp` advierte que una cuenta existente puede recibir una respuesta diseñada para ocultar esa información.

Fuente oficial `supabase/auth/internal/api/signup.go`:
`sanitizeUser` declara que debe usarse para evitar que se filtre si un usuario está registrado y establece `Identities=[]`.

Por tanto el booleano `ok` vuelve a introducir la distinción que la respuesta sanitizada intentaba eliminar.

## PR142-H02 / A01 — constitución y alcance

- `docs/tasks/T-318.md@develop`: 404.
- Issue #141: “Ficha ... en la rama feat/T-318-register-errors”.
- AGENTS §1.1: la ficha debe existir en develop antes de escribir código.
- T-318 permite solo src/features/auth/**, su ficha, su bitácora y docs/revision-pr/**.
- `docs/implementation-plan.md` no está permitido pero aparece en el diff.
- `tools/verify-fichas.test.ts` explica que una contradicción entre DoD/archivos obliga al agente a desviarse o frenar.
- Precedente PR #138/T-317: la Ronda 2 dejó que la implementación #139 debía esperar a mergear la PR de ficha #138.

## CI exact-head

- unit ✅: 104 archivos / 1433 tests
- actions.test.ts: 38 tests
- register-form.test.tsx: 33 tests
- verify-fichas: 7 tests
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- board-sync ✅
- approval-policy ❌: falta informe independiente SIN BLOQUEANTES.
