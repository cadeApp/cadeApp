# Comandos reproducibles — PR #138

## H01 · Contratos raíz contradictorios

```bash
grep -n "Supabase remoto\|credenciales" AGENTS.md docs/onboarding.md .agents/rules/00-confianza-y-seguridad.md
```

- En `f280bc9`: AGENTS prohibía Supabase remoto de forma general y onboarding conservaba “Credenciales de staging o producción”.
- En `7f698de`: AGENTS distingue operaciones privilegiadas de llamadas de aplicación autorizadas; onboarding distingue credenciales privilegiadas de credenciales de usuario final interactivas.

## H02 · Ficha sin fila del plan

```bash
pnpm exec vitest run tools/verify-fichas.test.ts
grep -n "^| T-31[567] |" docs/implementation-plan.md
```

RED reportado antes de agregar filas:
```
Estas fichas no tienen fila en docs/implementation-plan.md §8: T-315, T-316, T-317
Tests 1 failed | 6 passed
```

GREEN reportado después:
```
Test Files 1 passed (1)
Tests 7 passed (7)
```

Las filas T-315/T-316/T-317 se contrastaron contra sus fichas y coinciden en dependencias, archivos permitidos y primer DoD.

## H03 · Referencia muerta

Issue #137 verificado en Ronda 3: usa `verifyAdminMfaAction`.

## CI observado

Workflow `CI` run #634 sobre `7f698dedb08480d5b39914389bfcba463b196fb8`:
- typecheck: success
- lint: success
- unit: success
- build: success
- audit: success
- db-tests: success
- bundle-budget: success

Resultado: **7/7 jobs verdes**.