# Evidencia reproducible — PR #240

## Ronda 1

Ver historia para evidencia del SHA `5c31ed8`.

## Ronda 2

Ver historia para evidencia del SHA `94cf3db`.

## Ronda 3 — H04

### RED manual

Lautaro073 reprodujo en localhost el caso courier incompleto:

```text
estado mostrado: "En revisión manual"
DNI frente/dorso: Pendiente
Selfie: Pendiente
Foto perfil: Pendiente
Vehículo y consentimientos: Listo
acción: "Ir al panel de repartidor"
resultado: no avanza correctamente y el usuario no vuelve a completar onboarding
```

### Causa en el SHA anterior

```ts
matchesSegment(pathname, '/courier/onboarding') ||
pathname === '/courier/profile'
```

La primera condición incluye `/courier/onboarding/status`.

### Fix `4bf9cfacf20aabd9b217eb8681febb0c04e96153`

```ts
pathname === '/courier/onboarding/identity' ||
pathname === '/courier/onboarding/vehicle' ||
pathname === '/courier/profile'
```

### Tests de contrato

Courier incompleto:

```ts
expect(followGuard('/courier/onboarding/status', session))
  .toBe('/courier/onboarding/identity');

expect(followGuard('/onboarding/status', session))
  .toBe('/courier/onboarding/identity');
```

Courier completo:

```ts
expect(
  evaluateRouteGuard('/courier/onboarding/status', baseSession('courier', true))
).toEqual({ action: 'allow' });
```

Volver a la mutación amplia `matchesSegment('/courier/onboarding')` rompe el primer control porque status queda permitido.

### CI

GitHub Actions run **#1075 / 37160178864**, SHA `4bf9cfacf20aabd9b217eb8681febb0c04e96153`: **SUCCESS**.

```text
unit           success
build          success
typecheck      success
lint           success
db-tests       success
audit          success
bundle-budget  success
```

### Pendiente manual H03

Comercio: PASS ya informado.

Courier: repetir sobre `4bf9cfacf20aabd9b217eb8681febb0c04e96153` o posterior:
1. entrar con cuenta incompleta;
2. feed/ofertas/status → identity;
3. profile exacto → permitido + “Completá tu registro”;
4. profile/notifications → identity.
