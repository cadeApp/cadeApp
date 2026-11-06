# PR #617 / T-407 — Ronda 5: cierre independiente (2026-11-06)

**Resultado: SIN BLOQUEANTES. REVISIÓN ACEPTADA; APTA PARA MERGE POR LAUTARO073.**

## SHAs y alcance

- HEAD realmente revisado y probado: `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`. Último código: `7411c8656f1001738431ff9f4d7d8b66438a516a`; el diff entre ambos consta solo de cinco archivos de `docs/revision-pr/pr-617/**`. No hay modificación de aplicación sin gate posterior.
- PR abierta, `mergeable=true` al cierre. La comparación remota con `develop=c4d579ad` diverge por 3 commits del lado de develop; el conector no ejecuta `git merge-tree`, por lo que **no se atribuye** un merge-tree local exitoso.
- D01=B continúa vigente: nota de inmutabilidad diferida a T-408. D06, autorizada para el selector del E2E legado de T-380, está incluida en el último SHA de código.
- H01/H02/H03 conservan su comprobación y `verificado_en_sha` original. H04 pasa a `arreglado-verificado` **por Playwright real** del HEAD.

## Gate E2E comprobado en logs del runner

[Run #42154936711](https://github.com/cadeApp/cadeApp/actions/runs/42154936711), intento 1: `completed/success`. El evento es `workflow_run` y su cabecera apunta a `develop`, pero **el job `e2e-preview` #127686799555 hizo checkout explícito de `7d966e77bc3dbd33e74e28e4f79822a30d4e8373`**. Se inspeccionaron `ref:`, `git checkout` y `HEAD is now at 7d966e7` en los logs. El commit status `e2e-preview` también es `success`.

- Suite Chromium: **117 passed (28.9m)**, sin fallas ni flakies reportados.
- Proyecto global-settings: **6 passed (2.3m)**.
- T-407 `admin-audit-filters.spec.ts:69`: **pasó** en 18,1 segundos.
- T-380/D06 `admin-courier-reinstate.spec.ts:80`: **pasó al primer intento** en 28,4 segundos. El mismo flujo fallaba previamente por `strict mode violation` en run #42145295195 (sobre `e6894f16`), 3/3 intentos. Con D06, la aserción real se ejecutó con `main` acotado y pasó.

## Gate CI comprobado en logs del runner

[Run #42151756302, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42151756302): `head_sha=7d966e77bc3dbd33e74e28e4f79822a30d4e8373`, `completed/success`, **7/7 jobs success**: `build`, `audit`, `typecheck`, `unit`, `lint`, `db-tests`, `bundle-budget`. [Approval-policy #42151754006](https://github.com/cadeApp/cadeApp/actions/runs/42151754006): `success`.

- `unit`: **193 archivos; 3654 tests passed**, y tests de workflows auxiliares 86 + 6 sin fallas.
- `db-tests`: **42 archivos, 3396 tests, Result PASS**; 9/9 escenarios multisesión. Se ejecutaron generación local de tipos y comparación con la versión trackeada, sin fallo del job.
- `build`: Next.js compiló; `typecheck`, `lint`, `audit` success.
- Advertencias sin carácter bloqueante: `pnpm format:check` reporta 333 archivos con diferencias y fue tratado como advisory (ESLint no tuvo errores); `bundle-budget` advierte que `/admin/audit` pesa 267 kB frente al umbral de 180 kB. **No se demostró una regresión atribuible a T-407**; ambos jobs CI terminaron en success.

## Cierre

Sin hallazgos abiertos ni decisiones pendientes para esta PR. Se deja H04 en `arreglado-verificado` con `verificado_en_sha=7d966e77bc3dbd33e74e28e4f79822a30d4e8373` y se conservan los tres SHA históricos de H01-H03.

**ACEPTACIÓN DE REVISIÓN, no GitHub APPROVE:** esta sesión no aprueba ni mergea. Lautaro073 es quien decide y realiza el merge. El issue [#621](https://github.com/cadeApp/cadeApp/issues/621) queda abierto hasta que la traducción de incidentes llegue a `develop`. El commit documental que publica esta ronda mueve HEAD pero no requiere otro gate GREEN solo por documentación.
