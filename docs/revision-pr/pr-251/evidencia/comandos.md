# Evidencia y comandos — PR #251

## Ronda 7 — revalidación ambiental

### Run
`e2e-preview` `37433304282`, attempt 2, job `112489877756`.

Resultado:

```text
35 passed
1 failed
```

### T-313
```text
DoD courier                    GREEN
DoD sin consentimiento         GREEN
DoD alta completa              RED
```

Fallo:

```text
merchant-registration.spec.ts:184
Locator: getByRole('alert')
Expected: 0
Received: 1
```

### Artifact
Artifact `11443831505`, `playwright-report`.

Page snapshot final:
- heading `Revisá tu email`
- copy neutral de registro exitoso
- un único `alert` vacío

Trace:
```html
<NEXT-ROUTE-ANNOUNCER>
  <template shadow-root="open">
    <div
      aria-live="assertive"
      id="__next-route-announcer__"
      role="alert"
    />
  </template>
</NEXT-ROUTE-ANNOUNCER>
```

El mismo route announcer aparece en el snapshot inicial, antes de enviar el formulario.

### Conclusión
La modificación manual en Supabase Develop permitió completar el alta. El rojo actual es un falso positivo del selector E2E global, no evidencia de error de Auth.

### Sincronización
Rama: 23 ahead / 34 behind respecto de develop `5c7febf6c2a4cba97d29148cc797e373103bd838`.

### P3
Solicitud existe en comment `5999858656`; no hay respuesta explícita P3 registrada.

## Ronda 8 — H09 corregido; fallo real en merchant onboarding

### SHA revisado

```text
b62331f5c96b2c79da5fac2960bf7e9baa815210
```

El job E2E hizo checkout explícito de ese SHA.

### Sincronización

```text
develop = 64dfdf653219c6cf08a223c0df829353d9d9d8f1
HEAD    = b62331f5c96b2c79da5fac2960bf7e9baa815210
ahead   = 27
behind  = 1
mergeable = true
```

El commit pendiente de develop corresponde a T-345 / CC-023 y no toca T-313 ni merchant onboarding.

### CI

```text
CI              37567209715  success
approval-policy 37567207925  success
Vercel                         success
e2e-preview      37567338127  failure
```

### trusted e2e-preview

Run `37567338127`, job `112618005276`:

```text
T-313 alta completa             FAIL (+ retry #1 + retry #2)
T-313 courier                   PASS
T-313 sin consentimiento        PASS

44 passed
1 failed
```

Fallo final:

```text
Expected URL: /merchant/dashboard
Received:     /merchant/onboarding
merchant-registration.spec.ts:228
```

Artifact `11458974386`:

```text
Ocurrió un error al guardar los datos. Por favor reintentá.
```

Trace seguro del POST `/merchant/onboarding`:

```text
{ ok: false, code: "INTERNAL_ERROR" }
```

No se copiaron cookies, tokens, emails ni datos personales del trace.

### H09

El locator actual está acotado al formulario:

```ts
const registrationError = page.locator('form').getByRole('alert');
await expect(registrationError).toHaveCount(0);
```

El mismo run avanza más allá de esa aserción hasta el submit de onboarding. H09 queda revalidado.

### Enumeración de merchantOnboardingAction

Ramas que pueden devolver `INTERNAL_ERROR` en el tramo alcanzado:

1. lectura/validación de `platform_settings.pilot_terms_version`;
2. upsert de `consents(pilot_terms)` vía admin;
3. update de `profiles` vía cliente autenticado;
4. upsert de `merchants` vía cliente autenticado.

Precondiciones estáticas verificadas:

- documento publicado `pilot_terms = 1.0`;
- T-321 siembra `pilot_terms_version = "v1"` y la action lo normaliza a `1.0`;
- el seed usa `ON CONFLICT DO NOTHING`, así que no prueba el valor remoto actual;
- SELECT de `platform_settings` está permitido a `authenticated`;
- CC-007 permite update a actor `active`;
- el E2E comprueba `consent_status=active` antes del onboarding;
- `merchants.subscription_status` default = `pilot`.

Los unit tests de `src/features/merchants/actions.test.ts` mockean esos cuatro accesos y no reproducen la integración remota.

### Observabilidad externa

- El conector Supabase accesible en esta sesión no expone cadeApp Develop; no se consultó ni modificó ningún otro proyecto.
- Vercel runtime logs en la ventana exacta del fallo no contienen un error de aplicación para `/merchant/onboarding`. La action devuelve el código de dominio sin loguear qué operación interna falló.

Conclusión: la causa raíz exacta sigue **no demostrada**.

### P3

Solicitud: comentario `5999858656`. No existe visto bueno explícito P3 en las reviews/comentarios actuales.
