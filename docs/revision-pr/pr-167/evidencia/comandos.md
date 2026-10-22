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

## Ronda 2

SHA funcional: `3c94d0eb8116987cc605ce5b433ad05e89b1b470`.

### CI exact-head 36914443982

```text
typecheck       success
lint            success
build           success
bundle-budget   success
audit           success
db-tests        success — 1614/1614
unit            failure — 1580 passed / 1 failed
```

Test fallido:

```text
src/features/legal/legal-red.test.ts:57
registerSchema: displayName y phone son facultativos...
expected true, received false
```

### Verificación H01–H04

- `actions.test.ts`: 55 tests verdes.
- `auth/confirm/route.test.ts`: 27 tests verdes.
- `register-enumeration.test.tsx`: 4 tests verdes.
- `courier-onboarding/components.test.tsx`: 23 tests verdes.
- `route-integrity.test.ts`: 53 tests verdes.

### R01

`src/features/legal/documents.ts` v1.0 todavía declara nombre visible y teléfono facultativos. La corrección funcional los vuelve obligatorios. CI detecta correctamente la contradicción.

P1 eligió opción A. PR documental #168 formaliza:
- archivos legales permitidos;
- Privacy v1.1;
- conservación de consentimientos históricos.

## Ronda 3

SHA funcional: `490979e74286aad3a287a958902a21abfd03bf08`.  
develop: `76d71d67f5e2b7c026f2abe20f9d05a337d1bb51`.

### CI exact-head 36923370905

```text
typecheck       success
lint            success
unit            success — 110 files / 1581 tests
build           success
bundle-budget   success
audit           success
db-tests        success — 13 files / 1614 tests
```

Suites relevantes:

```text
src/features/auth/actions.test.ts                    55/55
src/app/route-integrity.test.ts                      53/53
src/features/courier-onboarding/actions.test.ts      10/10
src/features/courier-onboarding/components.test.tsx  23/23
src/features/legal/legal-red.test.ts                 11/11
src/features/auth/components/register-enumeration...  4/4
src/app/auth/confirm/route.test.ts                   27/27
```

### PR167-R01

Inspección:
- Privacy actual = 1.1;
- Privacy 1.0 deja de ser vigente en `isCurrentLegalVersion`;
- texto legal cambia solo metadata de Privacy y el párrafo de obligatoriedad relevante;
- no se agregó migración ni escritura sobre consentimientos históricos.

Resultado: **arreglado-verificado**.

### PR167-A01

Comparación `develop...HEAD` contiene:

```text
src/features/courier-onboarding/actions.test.ts
```

La ficha vigente en `develop` no incluye ese archivo. La rama añadió dos líneas a su copia de `docs/tasks/T-322.md`: una afirmación de autorización P1 y el propio path en “Archivos permitidos”.

Según `.agents/skills/revisar-pr/SKILL.md`, el alcance se evalúa contra la ficha de `develop`; por eso permanece **decision-pendiente** aunque CI esté verde.

## Ronda 4

SHA funcional: `bff48abd64dbf596add21df8ec4f68d1ed299b11`.  
develop: `0b6b540096de15a84d7693b2e0d23b3ad9357fb0`.

### Cambios desde R3

Comparación `843e112...bff48abd64dbf596add21df8ec4f68d1ed299b11`:
- merge de PR #169 / documentación de alcance;
- `docs/tasks/log/T-322.md`;
- sin cambios funcionales nuevos de Auth, legal, courier onboarding ni RLS.

### Alcance formal

La ficha en `develop` incluye:
```text
src/features/courier-onboarding/actions.test.ts
```
con la restricción expresa de usarlo solo para fixtures Privacy 1.1.

### CI exact-head 36927363187

```text
typecheck       success
lint            success
audit           success
build           success
bundle-budget   success
unit            success — 110 / 110 files; 1581 / 1581 tests
db-tests        success — 13 files; 1614 / 1614 tests
```

Evidencia de suites:
```text
courier-onboarding/actions.test.ts      10/10
courier-onboarding/components.test.tsx  23/23
legal/legal-red.test.ts                 11/11
register-enumeration.test.tsx            4/4
auth/confirm/route.test.ts              27/27
verify-fichas.test.ts                    7/7
```

### PR167-A01

Estado final: `aceptado`.

Decisión P1 registrada en `develop@0b6b540096de15a84d7693b2e0d23b3ad9357fb0` mediante PR #169. El diff actual ya no presenta un desvío de alcance.
