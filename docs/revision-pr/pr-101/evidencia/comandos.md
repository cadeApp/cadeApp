# Evidencia y probes — PR #101 / CC-007

**SHA revisado:** `203654e6d8e7857da12295f3ef83a7b0a9282713`

## Estado del diff

```text
changed_files: 1
docs/contracts/CC-007.md
```

## Contrastes realizados

- `docs/master-plan.md`: D1 = Supabase/BaaS.
- `docs/implementation-plan.md`: P2 = @KiraK72.
- `src/features/auth/server.ts`: `updateSession()` construye sesión desde profile + MFA.
- `src/features/auth/guards.ts`: `evaluateRouteGuard()`; no existen `requireAuth` ni `requireRole`.
- `supabase/migrations/20260922051650_rls_v1.sql`: policies operativas usan `auth.uid()` directamente.
- CC-005 / PR #79: el PR de contract-change incluyó contrato + implementación + tests.

## Probe DB requerido al implementar

Ejecutar como authenticated merchant/courier en cada estado:

```text
pending              -> SELECT/INSERT/UPDATE operativo denegado
reconsent_required   -> SELECT/INSERT/UPDATE operativo denegado
active               -> comportamiento RLS normal
admin                -> comportamiento actual
```

Mantener allowlist de regularización.

## Probe RPC

```text
authenticated -> activate_account_consents: permission denied
server/service_role -> RPC disponible
fallo durante insert/status -> rollback transaccional completo
éxito -> ambas filas TOS+Privacy + status active
```

## Backfill

Fixtures:
- merchant/courier con tos+privacy -> active
- solo tos -> pending
- solo privacy -> pending
- ninguna -> pending
- admin -> exento del gate

## Mutaciones mínimas

1. quitar condición de consent status de una policy operativa -> test RLS rojo;
2. grant execute a authenticated sobre RPC de activación -> test de permisos rojo;
3. permitir pending en evaluateRouteGuard -> test auth rojo;
4. separar status update de la transacción de inserts -> test atomicidad rojo.

No se inspecciona CI final hasta que los bloqueantes estén resueltos.
