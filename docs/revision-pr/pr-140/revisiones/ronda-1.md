# Informe de revisión — PR #140 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/140  
**Head revisado:** `faef9f075b2eb29ba20a22cde2e1d58854d60ea7`  
**Base:** `develop` @ `75950cdf2a8a47d5f0642c3caa479c6f364e13bc`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (5).** Dos son decisiones de Lautaro073; tres son correcciones técnicas/evidencia.

La rama está sincronizada con develop (`behind_by=0`) y los cinco archivos de código modificados están bajo `src/features/auth/**`, por lo que no hay desvío de archivos de runtime respecto de la ficha T-009. El problema de proceso es anterior: T-009 ya fue cerrada por PR #60 / issue #10 y esta PR abre un segundo ciclo con el mismo id sin issue/tarea activos.

## BLOQUEANTES

### PR140-H01 — DECISIÓN · trazabilidad de tarea y rama

T-009 corresponde al issue #10, que está cerrado como completado desde 2026-09-23, y ya tuvo el PR #60. La PR #140 vuelve a usar `[T-009]`, no enlaza un issue nuevo, no agrega una nueva sesión a la bitácora y usa `fix/T-009-register-errors` contra develop.

La regla 50 define trabajo normal como `feat/T-xxx-*` hacia develop y reserva `fix/T-xxx-*` para hotfix desde main con back-merge. AGENTS también exige ficha en develop + issue asignado antes de escribir código.

**Decisión de Lautaro073:**
- **1-A (consistente con el proceso):** abrir una tarea/issue nuevo para este bug y mover/reaplicar el cambio a `feat/T-NNN-register-errors`. El número lo decide Lautaro073; no lo inventa el agy.
- **1-B (excepción explícita):** autorizar que este mantenimiento continúe como T-009/PR #140 pese a que la tarea original está cerrada, y documentar la excepción. Si se elige, igualmente hay que actualizar la bitácora.

### PR140-H02 — DECISIÓN · enumeración explícita de cuentas

En `actions.ts:143`, un resultado de `signUp` con `user.identities = []` se traduce a `CONFLICT`; luego `copy.ts:35` muestra “Ya existe una cuenta con ese email”.

Supabase documenta que `signUp` puede ocultar si una cuenta ya existe. Su implementación oficial usa una respuesta sanitizada con `Identities = []` precisamente para “prevent information about whether a user is registered or not from leaking”. La PR convierte esa señal ofuscada en un oráculo explícito de existencia de cuenta.

Fuentes verificadas:
- https://supabase.com/docs/reference/javascript/auth-signup
- https://github.com/supabase/auth/blob/master/internal/api/signup.go

**Decisión de Lautaro073:**
- **2-A (seguridad):** preservar la no-enumeración; no traducir la respuesta sanitizada `identities: []` a un mensaje público de existencia. Diseñar un mensaje/flujo neutro.
- **2-B (UX):** aceptar conscientemente la enumeración y mantener el mensaje explícito; documentar la aceptación en la tarea/PR para que no parezca un accidente.

### PR140-H03 — ALTO · errores operativos aparecen como datos inválidos

`signUpErrorCode` usa `VALIDATION_ERROR` como default. El harness independiente sobre la función exacta confirmó que códigos como `unexpected_failure`, `email_provider_disabled`, `email_address_not_authorized`, `captcha_failed`, `hook_timeout` y también `undefined` se traducen a `VALIDATION_ERROR`.

Eso hace que la UI culpe al email/contraseña cuando el problema puede ser del servicio o de configuración. La propia PR promete un mensaje distinto para `INTERNAL_ERROR`/excepción.

**Corrección:** usar allowlist de errores realmente atribuibles a datos (`weak_password`, `email_address_invalid`, `validation_failed`) para `VALIDATION_ERROR`; rate-limit a `RATE_LIMITED`; el conflicto depende de H02; cualquier código operativo/desconocido/undefined debe ir a `INTERNAL_ERROR`. Nunca mostrar `error.message` remoto.

### PR140-H04 — MEDIO · el catch nuevo no está cubierto

`register-form.tsx:69` cambió el `catch` para mostrar `errorUnexpected`, pero los 5 tests del nuevo archivo solo prueban respuestas resueltas `{ok:false, code}` y unicidad de copy. Ninguno hace que `registerAction` rechace/lance.

**Corrección:** agregar un test con `registerAction.mockRejectedValueOnce(...)`, enviar el formulario y afirmar `errorUnexpected`. Demostrar RED volviendo temporalmente el catch a `errorGeneric` o equivalente.

### PR140-H05 — MEDIO · falta cierre de sesión/evidencia completa

La bitácora de T-009 en el head termina el 2026-09-23 y no contiene la sesión de PR #140. El body registra suite focal de auth + typecheck/lint, pero no la ejecución global obligatoria `pnpm test`.

CI independiente está verde, pero no reemplaza la obligación de la sesión/autoevidencia definida por AGENTS/revisar-pr.

**Corrección:** después de resolver H01, actualizar la bitácora de la tarea que corresponda con hechos, RED/GREEN, checks globales y faltantes; correr y pegar `pnpm typecheck && pnpm lint && pnpm test`. No copiar secretos ni datos reales.

## MEJORAS

- `authCopy.register.errorGeneric` afirma “evitá números seguidos”. El schema local solo impone longitud mínima y la política de contraseña de Supabase puede cambiar. Conviene que el copy describa una regla realmente estable o use texto neutral (“una contraseña más segura/no común”) para no prometer una validación inexistente.

## Checks y evidencia

CI exact-head:
- `unit` ✅: `src/features/auth/actions.test.ts` 29 tests; `register-form.test.tsx` 5 tests; total 104 archivos / 1396 tests.
- `typecheck` ✅
- `lint` ✅
- `db-tests` ✅
- `build` ✅
- `bundle-budget` ✅
- `audit` ✅
- `approval-policy` ❌: “Falta el informe completo de revisar-pr sin bloqueantes.” Es esperado mientras esta ronda tenga bloqueantes.

## No revisado / dudas para Lautaro073

- H01 y H02 son decisiones; el agy no debe resolverlas solo.
- No se probó contra cuentas reales ni se usaron credenciales/Supabase remoto.
- No se aprueba ni mergea la PR.
