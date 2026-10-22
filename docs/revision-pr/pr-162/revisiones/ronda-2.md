# Ronda 2 — PR #162 / T-320

**Fecha:** 2026-10-01  
**SHA funcional:** `b892e2a0d7e7b32f39b34350c188765edc6a8cd0`  
**Resultado:** **SIN BLOQUEANTES DE CÓDIGO**

## Cambios desde R1

Desde el commit de revisión `4636dcc9bb5130b5bb307564c587e0975c804c34` hubo un único commit de autor, limitado a los seis archivos autorizados para corregir H01–H04. El autor no tocó `docs/revision-pr/**`.

## H01 — arreglado-verificado

`updatePasswordAction` ahora inspecciona `{ error }` de `signOut({ scope: 'others' })` y también convierte un rechazo de la Promise en `INTERNAL_ERROR`. Los tests nuevos cubren ambas clases y conservan el camino exitoso con `{ error:null }`.

Mutación independiente por inspección: eliminar el chequeo de `signOutError` hace que el caso de error retornado llegue a éxito; volver el `catch` best-effort hace que el caso de Promise rechazada llegue a éxito. Ambos contradicen los nuevos tests.

## H02 — arreglado-verificado

Se eliminó la clasificación por `error.message.includes('session')`. Solo se reconocen las señales estructuradas `session_missing` y `AuthSessionMissingError`. El adversarial `unknown_failure / AuthApiError / "Session backend unavailable"` exige `INTERNAL_ERROR`.

Mutación independiente por inspección: reintroducir el substring de R1 vuelve ese test rojo.

## H03 — arreglado-verificado

El Route Handler se ejecuta con cuatro `next` codificados: `%2F%2Fevil.com`, `https%3A%2F%2Fevil.com`, `%2F%5Cevil.com` y doble encoding. Cada caso exige 303 y `Location = http://localhost:3000/merchant/dashboard`, nunca un destino externo.

## H04 — arreglado-verificado

El CTA inválido es ahora un único `Link` estilizado con `buttonVariants`; no hay `a > button`. Los dos toggles usan target mínimo 48×48 y `focus-visible:ring-2`. El test específico verifica las tres propiedades.

## CI del SHA

Run `36822459862` sobre `b892e2a0d7e7b32f39b34350c188765edc6a8cd0`:

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
```

## develop avanzó

`develop` quedó en `7c2f9e6d924dc034e23ae3f093f16f95e0906bf5`. Los tres commits faltantes en la rama solo agregan `docs/tasks/T-319.md` y una línea en `docs/implementation-plan.md`; no cambian Auth, guards, CI ni contratos usados por T-320. La divergencia documental no invalida esta verificación.

## Residual manual

Siguen pendientes, tal como exige la ficha:
- configurar Redirect URLs en Supabase Dashboard;
- después del merge/promoción, ejecutar registro → confirmación y forgot-password → contraseña nueva → login en staging.

## Informe revisar-pr

```text
Informe revisar-pr — T-320 — 2026-10-01 — generado por revisión independiente
Resultado: SIN BLOQUEANTES
Checks: typecheck ✅ · lint ✅ · test ✅ (1559/1559) · test:db ✅ (1611/1611)
BLOQUEANTES:
- Ninguno.
MEJORAS:
- Ninguna.
No revisado / residual manual:
- Redirect URLs de Supabase y evidencia E2E real en staging.
```
