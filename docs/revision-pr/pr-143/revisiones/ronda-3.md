# Informe de revisión — PR #143 / T-318 — Ronda 3

**Head SHA revisado:** `fb308412d868b210c6c3152ebc2ed1414596120f`  
**develop actual al revisar:** `10c229f628e89527e20d222ca536af46eda015f1`  
**Fecha:** 2026-09-30

## Resultado

**SIN BLOQUEANTES.**

PR143-H02 continúa corregido y ejecutable. PR143-H01 se cierra en esta ronda porque la deriva residual de 7 commits de `develop` es materialmente ajena a T-318: solo toca T-301/E2E, no modifica la ficha, `docs/implementation-plan.md`, contratos de auth ni workflows/checks.

## PR143-H01 — aceptado/cerrado

Estado actual:
- `develop = 10c229f628e89527e20d222ca536af46eda015f1`;
- merge-base = `a16acd4831e2e538d4313e6821d3ebc4e7f758ac`;
- behind=7 / ahead=6;
- PR `mergeable=true`.

Los 7 commits nuevos desde `a16acd4` cambian únicamente:
- `docs/tasks/T-301.md`;
- `docs/tasks/log/T-301.md`;
- `e2e/pages/login.page.ts`;
- `playwright.config.test.ts`.

A diferencia de R2, no hay cambios nuevos en workflows. Por eso exigir otro merge de `develop` no agrega evidencia sobre T-318 y puede entrar en un bucle si develop sigue activo.

Reabrir este punto solo si antes del merge entra un cambio nuevo que toque T-318, el plan, auth relevante, workflows/checks o genere conflicto.

## PR143-H02 — arreglado-verificado

La ficha mantiene:
- respuesta sanitizada `identities: []`;
- `user_already_exists`;
- `email_exists`;

como señales de cuenta existente que producen el mismo resultado público que un alta nueva válida:
- mismo `ok`;
- mismo shape/campos públicos;
- misma navegación;
- sin ids distinguibles;
- sin copy de existencia;
- sin `activate_account_consents`.

El primer DoD sigue idéntico a la fila T-318 del plan.

## Ejecutabilidad contra develop actual

`registerAction` actualmente devuelve `userId, role, redirectTo`, pero `RegisterForm` solo consume `redirectTo`. Como `src/features/auth/**` está permitido, la implementación puede:
- eliminar del resultado público campos que no puedan igualarse entre alta nueva y cuenta existente;
- conservar `role`/`redirectTo` derivados del input;
- cortar los caminos de cuenta existente antes de `activate_account_consents`;
- mantener los códigos de dominio sin cambios.

No se requiere `contract-change`.

## CI exact-head

Workflow CI run #672 sobre `fb308412d868b210c6c3152ebc2ed1414596120f`: **7/7 jobs verdes**:
- typecheck;
- lint;
- unit;
- db-tests;
- build;
- bundle-budget;
- audit.

## No revisado / dudas

- No se usaron cuentas reales ni Supabase remoto.
- No aprobé ni mergeé la PR.

## Conclusión

La PR #143 queda **aprobable desde la revisión independiente**. Solo falta actualizar el body con este informe para satisfacer el flujo de cierre.
