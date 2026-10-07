# Evidencia — PR #288

HEAD revisado: `d653a64d8b944ec07f5beec5fdfacec048b4776c`.  
SHA funcional: `015b2414273541b844d30f79afeb6718b37395ab`.

## Sincronización y alcance

```text
develop = 6e2da8fb02d4797b9add222206342e6055f1d81c
HEAD    = d653a64d8b944ec07f5beec5fdfacec048b4776c
ahead   = 2
behind  = 0
```

Diff:

```text
docs/tasks/log/T-345.md
src/domain/cc023-request-private-fields.test.ts
src/domain/rpc-contracts.ts
src/domain/testing/rpc-fake.ts
src/features/requests/components/merchant-requests-list.test.tsx
src/features/requests/components/request-offers.test.tsx
src/features/requests/queries.test.ts
src/features/requests/queries.ts
src/features/requests/types.ts
src/server/rpc/request-private-fields.test.ts
src/server/rpc/request-private-fields.ts
```

No hay `supabase/**`, migraciones ni `database.types.ts`.

Historial previo de `docs/revision-pr/pr-288/**`: vacío.

## Checkpoint PR 1

```text
#287 merged → develop 6e2da8f
migrate run 37544715605
conclusion: success
```

## CI exact-head — run 37547526858

### unit

```text
Test Files 123 passed (123)
Tests      1941 passed (1941)
All files  83.28 stmts / 78.62 branches / 78.54 funcs / 83.81 lines
workflows  tests 57 / pass 57
ADR        tests 6 / pass 6
```

### db-tests

```text
git diff --exit-code -- src/types/database.types.ts

Files=1, Tests=10
Result: PASS

Files=19, Tests=1827
Result: PASS

[db:types] Tipos generados exitosamente en .../src/types/database.types.ts
```

### build

```text
Compiled successfully in 26.5s
```

### audit

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

Job success.

### bundle-budget

```text
/courier/feed                 159 kB  OK
/merchant/requests            103 kB  OK
/merchant/requests/[id]       163 kB  OK
/merchant/requests/new        163 kB  OK
/design-system                178 kB  OK
/admin/applicants             235 kB  Supera el límite
/admin/audit                  235 kB  Supera el límite
/admin/merchants              235 kB  Supera el límite
/admin/settings               235 kB  Supera el límite
/login/mfa                    235 kB  Supera el límite
```

La deuda admin/login es preexistente; no hay aumento relevante del diff de T-345.

## E2E exact-head — run 37547628600

Resolver:

```text
PR interna #288 contra develop.
Preview listo para E2E.
```

Checkout del job:

```text
ref: d653a64d8b944ec07f5beec5fdfacec048b4776c
HEAD is now at d653a64
```

Playwright:

```text
Running 37 tests using 1 worker
37 passed (6.8m)

Running 3 tests using 1 worker
3 passed (50.0s)
```

Reporte:

```text
TARGET_SHA: d653a64d8b944ec07f5beec5fdfacec048b4776c
trusted E2E gate GREEN contra el Preview
```

## RED declarado por el autor

La bitácora registra:

```text
cc023-request-private-fields.test.ts → 7 failed antes de contrato/fake
request-private-fields.test.ts → módulo inexistente antes del wrapper
queries.test.ts CC-023 → 4 failed con queries.ts anterior
mutación de precedencia → VALIDATION_ERROR esperado / UNAUTHORIZED_ACTOR recibido
```

Contraste estático contra la base `6e2da8f`:

- el contrato y el método del fake no existían;
- `request-private-fields.ts` no existía;
- los listados seleccionaban `cash_change_amount`;
- el detalle seleccionaba `cash_change_amount` y `notes`;
- el branch especial del fake es el que pone la validación de input antes del rol.

No se pudo ejecutar un checkout local independiente porque el runtime de revisión no resuelve `github.com` por DNS:

```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

Por eso esta parte queda registrada como contraste por inspección, no como RED runtime independiente.

## approval-policy antes de la revisión

```text
Falta el informe completo de revisar-pr sin bloqueantes.
Process completed with exit code 1.
```

No hubo hallazgos que requirieran una batería de mutaciones propia.
