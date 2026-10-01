# Evidencia — PR #167 / T-322

## Ronda 1

SHA funcional revisado: `6c7ace01cbb0ee7151271cceab10f51fbbdff78d`.

### Sincronización

```text
develop = f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c
head    = 6c7ace01cbb0ee7151271cceab10f51fbbdff78d
ahead   = 3
behind  = 0
```

Archivos cambiados: 14, todos permitidos por la ficha T-322.

### CI exact-head

Run `36829069927`:

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success

Test Files 110 passed (110)
Tests      1565 passed (1565)
Files=13, Tests=1614
Result: PASS
```

El DB test `rls_matrix.sql` pasó con los nuevos casos de carpeta propia/ajena/anon; la RLS no se relajó.

### H01 — obligatoriedad no llega a la frontera servidor

`src/features/auth/schemas.ts`:

```text
17: displayName: z.string().trim().max(100).optional()
18: phone: z.string().trim().max(30).optional()
```

Clase completa enumerada:
- displayName omitido;
- displayName vacío;
- displayName whitespace;
- phone omitido;
- phone vacío;
- phone whitespace.

Todos pueden atravesar el schema actual. Los tests no contienen negativos para estas variantes.

### H02 — confirmación todavía salta onboarding

Cadena inspeccionada:

```text
registerAction
  -> activate_account_consents(...)
  -> profiles.consent_status = active

/auth/confirm
  -> resolvePostLoginRedirect(null, role, active)
  -> getRoleDefaultPath(role)
     merchant = /merchant/dashboard
     courier  = /courier/feed
```

Esto contradice la evidencia manual exigida por T-322: `/auth/confirm → onboarding`.

Clase completa a revalidar:
- merchant + code;
- courier + code;
- merchant + token_hash/type=signup;
- courier + token_hash/type=signup;
- sin romper recovery, type=email ni next externo/malformado.

### H03 — copy no neutral

La misma UI para señales de cuenta existente contiene:

```text
Te enviamos un enlace de confirmación.
```

La igualdad de UI preserva anti-enumeración, pero el mensaje afirma un envío que la app no puede garantizar en esos caminos.

### H04 — sensibilidad del test

El control actual siempre llama:

```tsx
<IdentityForm courierId="usr-real-123" />
<VehicleForm courierId="usr-real-123" ... />
```

Mutación independiente por inspección: volver a introducir `courierId = 'temp-courier-id'` en los componentes no afecta esas llamadas ni sus expectativas; por tanto el test permanece verde.

### Follow-up merchant

Fuera de alcance de T-322: el onboarding de comercio necesita tarea separada para lista de barrios + `src/ui/select.tsx`, sin centroides inventados.
