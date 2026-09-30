# Evidencia — PR #143 / T-318

## Ronda 1

SHA revisado: `d843026b9d0e951278c954fdde7494dddbd88f56`.

- develop: `ec3c671db6f5ae5664f929925f5a77209bd57682`
- behind=8 / ahead=1
- H02: contradicción entre anti-enumeración y `user_already_exists/email_exists → VALIDATION_ERROR`.
- CI exact-head: verde salvo approval-policy por falta de informe final.

## Ronda 2

SHA revisado: `bb6e18be470af93f5a26306970240ae0e1e35e07`.

- H02 corregido: `identities: []`, `user_already_exists` y `email_exists` siguen el mismo resultado público no enumerable.
- Primer DoD y fila T-318: coincidencia exacta.
- develop al revisar: `a16acd4831e2e538d4313e6821d3ebc4e7f758ac`
- behind=14 / ahead=4 porque develop había avanzado incluyendo cambios en workflows.
- CI exact-head: verde.

## Ronda 3

SHA revisado: `fb308412d868b210c6c3152ebc2ed1414596120f`.

### Sincronización

La rama volvió a mergear el develop vigente de R2. Al revisar R3:

```
develop = 10c229f628e89527e20d222ca536af46eda015f1
merge-base = a16acd4831e2e538d4313e6821d3ebc4e7f758ac
compare develop...head = behind 7 / ahead 6
```

Delta `a16acd4 → 10c229f`:
- `docs/tasks/T-301.md`
- `docs/tasks/log/T-301.md`
- `e2e/pages/login.page.ts`
- `playwright.config.test.ts`

No cambia:
- `docs/tasks/T-318.md`
- `docs/implementation-plan.md`
- `.github/workflows/**`
- contratos de auth relevantes.

La PR reporta `mergeable=true`. Por eso la deriva residual no invalida esta ficha ni exige otra sincronización.

### Ejecutabilidad de la ficha

En `develop`:
- `registerAction` hoy retorna `userId, role, redirectTo`;
- `RegisterForm` solo consume `result.data.redirectTo`;
- el DoD permite ajustar el resultado dentro de `src/features/auth/**`;
- no hace falta tocar `src/domain/errors.ts`;
- los caminos de cuenta existente pueden terminar antes de `createAdminClient().rpc('activate_account_consents', ...)`.

Esto hace ejecutable el requisito de mismo shape público y sin id distinguible.

### CI exact-head

Workflow CI run #672 sobre `fb308412d868b210c6c3152ebc2ed1414596120f`:
- typecheck ✅
- lint ✅
- unit ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅

Resultado: **7/7 jobs verdes**.
