# Informe de revisión — PR #143 / T-318 — Ronda 2

**Head SHA revisado:** `bb6e18be470af93f5a26306970240ae0e1e35e07`  
**develop actual al revisar:** `a16acd4831e2e538d4313e6821d3ebc4e7f758ac`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (1).**

PR143-H02 quedó corregido correctamente. PR143-H01 había sido corregido contra el develop de ese momento (`ec3c671`), pero develop avanzó nuevamente antes de esta revisión y ahora la rama vuelve a quedar 14 commits atrás. Como entre esos commits hay cambios en `.github/workflows/ci.yml`, el cierre final debe ejecutarse sobre el develop vigente.

## PR143-H02 — arreglado-verificado

La ficha ahora declara:

- `identities: []`
- `user_already_exists`
- `email_exists`

como señales de cuenta existente que deben producir para el cliente un resultado indistinguible de un alta nueva válida:
- mismo `ok`;
- mismo shape y campos públicos;
- misma navegación;
- sin id real ni sanitizado;
- sin texto que confirme existencia;
- sin `activate_account_consents`.

El segundo DoD exige una comparación de cuatro caminos y falla ante cualquier diferencia pública relevante.

El mapper de errores genuinos quedó separado:
- weak password / email inválido / validation failed → `VALIDATION_ERROR`;
- rate limits → `RATE_LIMITED`;
- operativos/desconocidos/ausentes → `INTERNAL_ERROR`;
- señales de existencia no pasan por ese mapper.

La fila T-318 de `docs/implementation-plan.md` coincide byte a byte con el primer ítem del DoD.

## PR143-H01 — sigue abierto por nueva deriva de develop

La corrección hizo el merge solicitado y en ese momento llegó a `0 4` contra `ec3c671`.

Sin embargo, al revisar de nuevo:
- develop = `a16acd4831e2e538d4313e6821d3ebc4e7f758ac`;
- merge-base = `ec3c671db6f5ae5664f929925f5a77209bd57682`;
- `behind_by=14`;
- `ahead_by=4`.

Los 14 commits nuevos no tocan T-318 ni `docs/implementation-plan.md`, pero sí modifican:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/e2e-staging.yml`
- `.github/workflows/verify-workflows.test.mjs`
- E2E/T-301 relacionados.

Por lo tanto el exact-head CI verde de esta rama todavía usa una definición anterior a la vigente en develop.

**Corrección requerida:** mergear nuevamente `origin/develop` dentro de `docs/T-318-ficha` sin rebase/amend/force, verificar `behind=0`, diff esperado y CI exact-head.

## CI exact-head de `bb6e18be470af93f5a26306970240ae0e1e35e07`

- verify-fichas ✅ 7/7
- unit ✅ 104 archivos / 1407 tests
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- approval-policy ❌ únicamente por faltar informe independiente SIN BLOQUEANTES.

## No revisado / dudas

- No se usaron cuentas reales ni Supabase remoto.
- No aprobé ni mergeé la PR.
