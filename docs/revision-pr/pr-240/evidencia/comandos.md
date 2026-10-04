# Evidencia reproducible — PR #240

## Rondas 1–3

Ver historia del archivo.

## Ronda 4 — H05

### RED manual

Lautaro073 informó:

```text
cuenta courier recién creada
onboarding no completado
login
resultado observado: /courier/feed
resultado esperado: /courier/onboarding/identity
```

### Causa

`loginAction` ya devolvía identity para `vehicle_type = null`, pero el cliente ejecutaba:

```ts
resolvePostLoginRedirect(
  initialRedirectTo,
  result.data.role,
  result.data.consentStatus
)
```

Sin `onboardingComplete`, el resolver toma el default del rol: `/courier/feed`.

### Intento intermedio

Commit `3cfe1b0` usó `router.push(result.data.redirectTo)`.

CI detectó correctamente:

```text
src/features/auth/components/login-form.tsx navega a redirectTo indirecto
sin productor verificable (inexistente): result.data.redirectTo
```

Origen: `src/app/route-integrity.test.ts`, T-118. No se modificó ese test.

### Fix definitivo `db42f5283a915eeb17fe50ab9fb6aea438b063ab`

`loginAction` devuelve `onboardingComplete` y `LoginForm` lo usa:

```ts
const targetUrl = resolvePostLoginRedirect(
  initialRedirectTo,
  result.data.role,
  result.data.consentStatus,
  result.data.onboardingComplete
);
```

`updatePasswordAction` también carga `business_name` / `vehicle_type` antes de resolver su destino.

### Controles

`login-form.test.tsx`:
- merchant false → `/merchant/onboarding`;
- courier false → `/courier/onboarding/identity`;
- merchant/courier true → destino normal;
- admin MFA;
- redirect hostil.

`actions.test.ts`:
- reset merchant incompleto;
- reset courier incompleto;
- reset courier completo;
- D02 fail-open.

Mutación equivalente: eliminar el cuarto argumento en `LoginForm`; courier false vuelve a feed y el test queda RED.

### CI definitivo

GitHub Actions run **#1082 / 37166448240**, SHA `db42f5283a915eeb17fe50ab9fb6aea438b063ab`: **SUCCESS**.

```text
unit           success
build          success
typecheck      success
lint           success
db-tests       success
audit          success
bundle-budget  success
Vercel         success
```

### Pendiente H03

Repetir el flujo manual courier sobre `db42f5283a915eeb17fe50ab9fb6aea438b063ab` o un SHA posterior con el mismo código.
