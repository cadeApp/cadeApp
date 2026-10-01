# Evidencia — PR #142 / T-318

## Ronda 2

SHA: `9d34f42841ec9ed9875324e8d81f36dd7234315a`.

Se detectaron PR142-H01, H02 y A01. Detalle en `revisiones/ronda-2.md`.

## Ronda 3

SHA funcional: `6947d68ffca5c5510aa0e943355fa1ff33e8bc23`.

H02/A01 quedaron cerrados; H01 siguió abierto por el efecto de sesión cuando Confirm Email estaba desactivado.

## Ronda 4

SHA funcional revisado: `d9d7b063e346443155b3208d271ddf3f9d225aef`.  
Base: `develop` @ `158f83b2b1bf6211a2bf8e53ae7cd90130edc445`.

### Diff desde R3

Solo:
- `src/features/auth/actions.ts`
- `src/features/auth/actions.test.ts`
- `src/features/auth/components/register-enumeration.test.tsx`
- `docs/tasks/log/T-318.md`

### H01

Código verificado:
- si `data.session` existe → `supabase.auth.signOut({ scope: 'local' })`;
- si signOut devuelve error → `INTERNAL_ERROR`;
- ese bloque corre antes de `identities: []`, `createAdminClient` y `activate_account_consents`;
- sin sesión → no signOut.

Tests verificados:
- alta nueva con sesión no nula → signOut local 1 vez + 1 activación;
- alta nueva sin sesión → 0 signOut + 1 activación;
- `identities: []`, `user_already_exists`, `email_exists` → mismo resultado público, 0 activaciones, 0 signOut;
- fallo de signOut → INTERNAL_ERROR, 0 activaciones, sin filtrar detalle.

RED natural:
- 2 archivos fallidos; 3 tests fallidos antes del bloque de signOut.

GREEN focal:
- 2 archivos passed; 45 tests passed.

Mutaciones:
- S1 quitar bloque signOut → 3 failed;
- S2 signOut sin scope → 2 failed;
- S2b scope global → 2 failed;
- S3 ignorar signOutError → 1 failed.

### Sincronización

`compare develop...feat/T-318-register-errors`: behind=0.

### CI exact-head

Workflow CI #683 sobre `d9d7b063e346443155b3208d271ddf3f9d225aef`: **7/7 jobs verdes**:
- typecheck
- lint
- unit
- db-tests
- build
- bundle-budget
- audit

La corrida local global documentó dos fallos preexistentes/interferencias; los aislados pasaron y el runner limpio quedó completamente verde.
