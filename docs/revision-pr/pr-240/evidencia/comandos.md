# Evidencia reproducible — PR #240

## Ronda 1

Ver historia del archivo para la evidencia del SHA `5c31ed8`.

## Ronda 2 — SHA `94cf3db9635833b3ef1c8723717908c11fac1bff`

### Alcance exacto desde el commit de revisión

```text
dee1f2b..94cf3db = 1 commit
7 archivos:
docs/tasks/log/T-334.md
src/features/auth/actions.test.ts
src/features/auth/guards.test.ts
src/features/auth/guards.ts
src/features/auth/server.test.ts
src/features/courier-onboarding/actions.test.ts
src/features/courier-onboarding/actions.ts
```

## H01

Código limpio:

```ts
matchesSegment(pathname, '/courier/onboarding') ||
pathname === '/courier/profile'
```

Sonda del repo:

```ts
expect(followGuard('/courier/profile', baseSession('courier', false)))
  .toBe('/courier/profile');

expect(
  followGuard('/courier/profile/notifications', baseSession('courier', false))
).toBe('/courier/onboarding/identity');
```

Harness independiente de revisión:
- limpio: profile permitido; notifications no exceptuada;
- mutación a `matchesSegment('/courier/profile')`: notifications queda permitida y viola la propiedad.

## H02

Orden observado directamente en el source:

```text
123-131  consents upsert + error return
180-185  courier_documents upsert + error return
191-203  courierUpdatePayload + update de couriers
207-209  return ok
```

Tests nuevos:
- consents error ⇒ INTERNAL_ERROR + admin update 0;
- documents error ⇒ INTERNAL_ERROR + admin update 0.

Control histórico del happy path:
```ts
expect(mockAdminUpdate).toHaveBeenCalledWith({
  dni_hmac: expectedHmac,
  vehicle_type: 'moto',
  vehicle_plate: 'A 123 BCD',
});
```

RLS inspeccionada en `20260922051650_rls_v1.sql`:

```sql
create policy courier_documents_insert_self on public.courier_documents
  for insert to authenticated
  with check (
    courier_id = auth.uid()
    and status = 'submitted'
    and purge_after is null
    and purged_at is null
  );
```

No exige `vehicle_type`.

Harness independiente:
- limpio: marker posterior a consents y documents;
- mutación: marker anterior a ambos ⇒ invariante rojo.

## D02

Los tests de server/actions cubren merchant y courier y comprueban explícitamente que un error de lectura no manda al onboarding.

La mutación registrada por agy `error => onboardingComplete=false` pone 4 casos en rojo; el código final restaura fail-open.

## CI independiente

GitHub Actions run `37159108997`, run #1073, SHA `94cf3db9635833b3ef1c8723717908c11fac1bff`: **SUCCESS**.

```text
build          success
lint           success
unit           success
typecheck      success
db-tests       success
audit          success
bundle-budget  success
```

## Vercel

El deployment del SHA corregido fue rechazado por límite de cuenta:

```text
Resource is limited - try again in 24 hours
code: api-deployments-free-per-day
```

No es un fallo de build, pero impide usar ese Preview para H03.

## Infra de tests fuera de T-334

`src/server/rpc/cc007.test.ts` usa:

```ts
fs.writeFileSync(filePath, mutated, 'utf8');
spawnSync('pnpm', testArgs, ...);
fs.writeFileSync(filePath, original, 'utf8');
```

Eso permite que workers paralelos carguen temporalmente la mutación. Seguimiento: issue #243.

## Pendiente manual H03

Registrar para cada rol:
- cuenta usada (sin exponer contraseña);
- SHA/entorno probado;
- ruta inicial;
- destino observado;
- resultado de perfil courier exacto y notifications;
- PASS/FAIL.
