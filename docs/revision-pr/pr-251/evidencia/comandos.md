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
