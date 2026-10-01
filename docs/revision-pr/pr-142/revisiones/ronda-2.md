# Informe de revisión — PR #142 / T-318 — Ronda 2 de la cadena #140 → #142

**PR:** https://github.com/cadeApp/cadeApp/pull/142  
**Head revisado:** `9d34f42841ec9ed9875324e8d81f36dd7234315a`  
**Base:** `develop` @ `75950cdf2a8a47d5f0642c3caa479c6f364e13bc`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (3).**

Los arreglos técnicos de PR140-H03, H04 y H05 quedaron bien. La migración a T-318 resolvió parte de H01/H02, pero abrió dos bloqueos de proceso y dejó un residual de seguridad material.

## Verificación de los hallazgos heredados

### PR140-H03 — arreglado-verificado

Harness independiente sobre `signUpErrorCode` exacto:
- `weak_password`, `email_address_invalid`, `validation_failed` → `VALIDATION_ERROR`
- los dos rate limits → `RATE_LIMITED`
- `unexpected_failure`, provider/address disabled, captcha, hook timeout, desconocido y `undefined` → `INTERNAL_ERROR`
- `user_already_exists` / `email_exists` → mensaje genérico vía `VALIDATION_ERROR`

### PR140-H04 — arreglado-verificado

`register-form.test.tsx` usa `mockRejectedValueOnce(new Error('sentinel'))`, exige `errorUnexpected` y exige que `sentinel` no aparezca. El archivo ejecutó 33 tests verdes en CI.

### PR140-H05 — arreglado-verificado

Existe `docs/tasks/log/T-318.md` con decisiones, RED/GREEN, mutaciones y salida del comando global. CI exact-head pasó 104 archivos / 1433 tests, además de typecheck/lint/db/build.

## BLOQUEANTES

### PR142-H01 — ALTO · la respuesta sanitizada sigue permitiendo enumerar cuentas

**Archivos:** `src/features/auth/actions.ts:143` y tests T-318.

La decisión 2-A era preservar la anti-enumeración. El copy ya no dice “ese email existe”, pero el comportamiento observable sigue siendo distinto:

- alta nueva válida → `registerAction` termina en `ok:true`;
- respuesta sanitizada `identities: []` → `ok:false, code:'VALIDATION_ERROR'`.

Un cliente o atacante no necesita leer el texto: puede comparar el booleano `ok` de la Server Action. El propio test de T-318 fija esa diferencia, y la bitácora la reconoce como “residual conocido”.

Esto derrota precisamente la propiedad para la que Supabase crea el usuario sanitizado. En la fuente oficial, `sanitizeUser` dice que se usa para evitar filtrar si el usuario está registrado y asigna `Identities=[]`.

**Arreglo requerido:** en el flujo sanitizado, no convertir una respuesta upstream exitosa en un resultado público de error distinguible. La ficha T-318 debe exigir que el resultado observable de un signup válido nuevo y el signup sanitizado sean indistinguibles en clase/shape/navegación pública, mientras se sigue evitando `activate_account_consents` sobre el id sanitizado. Los códigos explícitos `user_already_exists/email_exists` tampoco pueden producir texto explícito de existencia.

Agregar prueba comparativa que falle si uno devuelve `ok:true` y el otro `ok:false`; no alcanza con buscar frases prohibidas.

### PR142-H02 — ALTO · T-318 se implementó sin ficha oficial en develop

**Archivos:** `docs/tasks/T-318.md`, issue #141, historia de #142.

`docs/tasks/T-318.md` existe únicamente en la rama de #142. En `develop` devuelve 404.

AGENTS §1.1 exige una ficha en `develop` y un issue asignado **antes de escribir código**. El precedente inmediato del mismo proyecto es T-317: PR #138 fue la PR de ficha y su Ronda 2 dejó explícito que la implementación #139 debía esperar a que #138 se mergeara.

**Arreglo requerido:** crear una PR documental separada desde el `develop` actual (por ejemplo rama `docs/T-318-ficha`) que contenga la ficha T-318 corregida y su fila del plan. Esa PR se revisa y mergea primero. #142 no debe seguir recibiendo cambios de implementación hasta entonces. Después, mergear `origin/develop` dentro de `feat/T-318-register-errors` sin rebase/force/amend y verificar `behind=0`.

### PR142-A01 — ALTO · docs/implementation-plan.md fuera de alcance

La propia ficha T-318 lista:
- `src/features/auth/**`
- `docs/tasks/T-318.md`
- `docs/tasks/log/T-318.md`
- `docs/revision-pr/**`

pero #142 modifica `docs/implementation-plan.md`.

La bitácora reconoce literalmente que está fuera de los archivos permitidos y lo justifica porque `verify-fichas.test.ts` exige una fila. La regla de revisión es inequívoca: archivo fuera de «Archivos permitidos» → bloqueante. El comentario del propio test también explica que ante esa contradicción el agente debe desviarse o frenar, no autoautorizarse.

**Arreglo requerido:** el plan debe entrar por la PR documental de H02, no por la implementación. Una vez mergeada esa PR y sincronizado #142, `docs/implementation-plan.md` y `docs/tasks/T-318.md` deben desaparecer del diff de implementación contra develop.

## MEJORAS

- La PR #140 ya fue reemplazada; cerrarla como superseded evita dos PR abiertas para la misma corrección. No bloquea el código de #142.

## CI

Exact-head `9d34f42841ec9ed9875324e8d81f36dd7234315a`: unit/typecheck/lint/db-tests/build/bundle-budget/audit/board-sync verdes. `approval-policy` rojo solo porque el body todavía no tiene un informe independiente `SIN BLOQUEANTES`.

## No revisado / dudas

- No se usaron cuentas reales ni Supabase remoto.
- No aprobé ni mergeé #140 ni #142.
