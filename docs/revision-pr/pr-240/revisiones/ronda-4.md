# Informe de revisión — PR #240 / T-334 — Ronda 4

**PR:** https://github.com/cadeApp/cadeApp/pull/240  
**RED:** retest manual de Lautaro073: courier incompleto terminó en `/courier/feed`  
**SHA corregido:** `db42f5283a915eeb17fe50ab9fb6aea438b063ab`  
**Fecha:** 2026-10-03/04  
**Resultado:** **H05 CERRADO EN CÓDIGO. H03 sigue abierta hasta retest manual courier.**

## H05 — LoginForm pierde el estado de onboarding

### RED manual

Después de crear una cuenta courier y no completar el onboarding, el login seguía enviando al usuario a `/courier/feed`.

### Causa raíz

`loginAction` ya hacía la lectura correcta:

```ts
couriers.vehicle_type === null
→ onboardingComplete = false
→ redirectTo = '/courier/onboarding/identity'
```

Pero `LoginForm` ignoraba ese resultado semántico y ejecutaba de nuevo:

```ts
resolvePostLoginRedirect(
  initialRedirectTo,
  result.data.role,
  result.data.consentStatus
)
```

Sin cuarto argumento, `onboardingComplete` quedaba `undefined`, por lo que un courier activo volvía a `/courier/feed`.

### Enumeración de la clase

Se revisaron los puntos que resuelven navegación después de autenticación:

- `src/app/auth/confirm/route.ts`: seguro; consulta explícitamente onboarding.
- `src/features/auth/components/login-form.tsx`: bug.
- `src/features/auth/components/reset-password-form.tsx`: seguro como consumidor; usa el destino de `updatePasswordAction`.
- `updatePasswordAction`: faltaba cargar onboarding antes de resolver destino; se corrigió dentro del mismo alcance para no repetir H05 tras recuperación.

## Primer intento rechazado por T-118

En `3cfe1b0` se cambió el formulario a:

```ts
router.push(result.data.redirectTo)
```

La suite T-118 falló:

```text
login-form.tsx navega a redirectTo indirecto sin productor verificable:
result.data.redirectTo
```

Ese fallo era correcto. No se modificó ni debilitó `route-integrity.test.ts`.

## Fix definitivo

`loginAction` ahora devuelve también:

```ts
onboardingComplete?: boolean
```

y `LoginForm` conserva el resolver auditado:

```ts
const targetUrl = resolvePostLoginRedirect(
  initialRedirectTo,
  result.data.role,
  result.data.consentStatus,
  result.data.onboardingComplete
);
router.push(targetUrl);
```

Por lo tanto:
- courier incompleto (`false`) → identity;
- merchant incompleto (`false`) → onboarding;
- completo (`true`) → destino normal;
- error/desconocido (`undefined`) → D02 fail-open;
- redirect hostil sigue pasando por el saneamiento de `resolvePostLoginRedirect`.

`updatePasswordAction` aplica el mismo marcador antes de resolver su destino.

## Controles

`login-form.test.tsx` cubre:
- merchant incompleto;
- courier incompleto;
- ambos completos;
- admin/MFA;
- redirect hostil.

`actions.test.ts` cubre además:
- reset merchant incompleto;
- reset courier incompleto;
- courier completo;
- D02 fail-open ante error leyendo el marcador.

La mutación equivalente al bug original es quitar el cuarto argumento del resolver en `LoginForm`; el caso courier incompleto vuelve a esperar identity pero obtiene feed.

## CI

GitHub Actions **#1082 / 37166448240 — SUCCESS** sobre `db42f5283a915eeb17fe50ab9fb6aea438b063ab`.

| Job | Estado |
|---|---|
| unit / test:coverage | ✅ |
| build | ✅ |
| typecheck | ✅ |
| lint | ✅ |
| db-tests | ✅ |
| audit | ✅ |
| bundle-budget | ✅ |
| Vercel | ✅ |

## Estado

- H01 ✅
- H02 ✅
- H04 ✅
- H05 ✅
- H03 ⏳ solo falta retest humano courier

No aprobar ni mergear hasta ese retest.
