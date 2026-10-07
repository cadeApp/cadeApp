# Informe de revisión — PR #254 / T-302 — Ronda 4

**Head SHA revisado:** `2033b931e192b822f4e0b26578d174465f099fbc`  
**Base:** `develop` @ `6e2da8fb02d4797b9add222206342e6055f1d81c`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES TÉCNICOS.** H05 queda **aceptado por decisión D01 de Lautaro073 (opción A)**, no `arreglado-verificado`.

## Sincronización y alcance

- `develop...HEAD`: ahead 11 / behind 0.
- Merge-base: la punta vigente de `develop`.
- El arreglo propio de R4 modifica únicamente `e2e/specs/courier-onboarding.spec.ts` y `docs/tasks/log/T-302.md`; el resto de cambios entre R3 y R4 proviene del merge de `develop`.
- Sin dependencias nuevas de T-302.
- No quedan `.only`, `.skip`, sleeps fijos, `any`, `@ts-ignore`, `.first()`/`.nth()`, escapes `isVisible/isEnabled` ni fallback de navegación/RPC en el spec.

## H07 — verificado

La rama integró `origin/develop` mediante merge y ahora está **behind 0**. Se cierra H07 en `2033b931...`.

## R01 — verificado

Las tres ocurrencias problemáticas quedaron corregidas:

- los dos errores de DNI usan `getByRole('alert').filter({ hasText: ... })`;
- Moto usa `getByRole('radio', { name: ... })`, `check()` y `toBeChecked()`;
- no se introdujeron `.first()`, `.nth()` ni `force: true`.

El run real de Preview confirma el arreglo: los cinco casos T-302 pasan.

## H05 — decisión D01

La bitácora R4 corrige de forma append-only la evidencia previa:

- H01/H02/H04 locales no se presentan ya como RED E2E reproducible;
- H03 unitario se reconoce como evidencia complementaria;
- se conserva el fail-closed local por falta de credenciales de Supabase Develop.

La propiedad que faltaba demostrar era la mutación deliberada E2E. Con el mecanismo actual, reproducirla contra Preview exigiría publicar temporalmente código que elimina una protección de MFA o deduplicación.

Lautaro073 eligió **A**:

> Aceptar la excepción para T-302 con la evidencia runtime real existente y sacar el mecanismo seguro de mutaciones a un follow-up.

Por tanto H05 queda `aceptado`, no verificado. Se abrió **Issue #289** para diseñar un runner trusted que aplique mutaciones en un checkout efímero sin publicar código roto.

### Evidencia compensatoria

- `e2e-preview` exact-head: los **5/5 tests T-302 pasan sin retries**.
- El caso MFA recorre el segundo factor en la sesión real del navegador.
- El caso DNI duplicado recorre UI → Server Action y observa el error productivo.
- Las suites unitarias existentes cubren `AAL2_REQUIRED` y `DNI_ALREADY_REGISTERED`.

## CI exact-head

### CI principal — run 37548946258

Todos los jobs: ✅

- lint
- unit
- db-tests
- typecheck
- audit
- build
- bundle-budget

La suite unit exacta reporta **121/121 archivos y 1921/1921 tests**; verify-workflows **57/57** y ADR **6/6**.

### E2E Preview — run 37549090092

Checkout explícito de `2033b931...`.

- chromium: **42 passed**
- global-settings: **3 passed**
- T-302: **5/5 passed**, sin retries.

### Vercel

✅ success.

### Bundle budget

El job es advisory y muestra rutas actuales de `develop` en 235 kB sobre el umbral de 180 kB. T-302 no modifica código de aplicación/bundle en R4; el valor llega por el merge de `develop`. No se atribuye a esta PR ni se abre como hallazgo T-302.

### approval-policy

❌ `El PR requiere aprobación vigente de Lautaro073.`

Es el único check rojo observado y corresponde a la acción humana posterior a esta revisión.

## Conclusión

T-302 queda **lista para aprobación humana**. La aprobación no se ejecuta desde esta skill y el PR continúa en draft hasta que el flujo humano lo cambie.