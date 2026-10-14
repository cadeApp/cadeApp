# Ronda 4 — PR #204 / T-305

**Fecha:** 2026-10-03  
**SHA funcional revisado:** `dd29da076a1d8d7194f90568c8a1ae53e1ad5c72`  
**Resultado:** **CON BLOQUEANTES (1)**

## Resumen

Kira resolvió la Ronda 3:
- H05: body con formato estructural válido, `Refs #37`, checkbox de mutaciones sin marcar y rollback real.
- H06: aislamiento de sesión merchant→courier sigue correcto.
- M01: descripción genérica del status sigue correcta.
- CI funcional obligatorio: typecheck/lint/unit/build/db/bundle GREEN.
- `e2e-preview` del SHA quedó GREEN, pero ese run todavía usó el workflow anterior y **no ejecutó authorization.spec.ts**.

## Cambio de infraestructura que altera el cierre de T-305

Desde T-331, `develop` cambió la estrategia del gate:

```bash
pnpm exec playwright test --project=chromium --workers=1
pnpm exec playwright test --project=global-settings --workers=1 --pass-with-no-tests
```

`e2e/AGENTS.md` ahora dice explícitamente que todo spec en `e2e/specs/` entra solo a los gates y que **no hace falta tocar .github/**.

Esto supersede la mecánica histórica de las decisiones 1-A/3-A:
- ya no hace falta que T-305 mantenga un cambio propio en `.github/workflows/e2e-preview.yml`;
- una vez que la rama integre `develop` actual, `authorization.spec.ts` puede correr pre-merge;
- si los 4 casos T-305 aparecen GREEN en el log exact-head, el residual post-merge desaparece y #37 puede cerrarse con el merge.

La actualización quedó registrada también en Issue #37.

## H05 — cerrado

Se validó el body vivo de GitHub con comprobación estructural independiente:
- `Refs #37` presente y `Closes #37` ausente;
- “Cada prueba nueva...” desmarcado;
- `Informe revisar-pr — T-305` presente;
- `Resultado:`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:` y `No revisado / dudas...` presentes;
- rollback apunta al merge/squash final y ya no al commit docs-only.

Resultado de las 9 comprobaciones: **9/9 true**.

## BLOQUEANTE

### PR204-H07 — La rama quedó 49 commits detrás y en conflicto con el gate T-331

**Severidad:** alto · **Categoría:** correctness/integración  
**Dónde:** `.github/workflows/e2e-preview.yml` + base `develop`

Estado al iniciar Ronda 4:

```text
develop = 20db1bdbfd44f5a398dbfa984cc8ea291a56a493
head    = dd29da076a1d8d7194f90568c8a1ae53e1ad5c72
ahead   = 19
behind  = 49
mergeable = false
mergeable_state = dirty
```

Entre esos 49 commits, T-331 reemplazó la lista manual de specs por descubrimiento automático. La rama todavía conserva el bloque viejo:

```bash
specs=(smoke main-flow)
if authorization...
if request-states...
...
```

mientras `develop` ya ejecuta el proyecto completo `chromium`.

**Qué debe pasar:**
1. integrar `origin/develop`;
2. resolver el conflicto de `e2e-preview.yml` quedándose con el bloque de T-331 de `develop`;
3. eliminar el diff propio de T-305 sobre ese workflow;
4. conservar los controles nuevos de `verify-workflows.test.mjs`;
5. revalidar exact-head.

Después del push, el reviewer exige evidencia del run confiable:
- el log debe nombrar explícitamente los cuatro tests de `authorization.spec.ts`;
- los cuatro deben estar GREEN;
- recién entonces DoD 1–3 pueden marcarse, el residual 3-A se elimina y el body puede cambiar `Refs #37` → `Closes #37`.

## CI del SHA revisado

CI run `37088795092`:
- typecheck ✅
- lint ✅
- unit: **114/114 archivos · 1687/1687 tests** ✅
- verify-workflows: **47/47** ✅
- ADR: **6/6** ✅
- db-tests: **15 archivos · 1671 tests · PASS** ✅
- build ✅
- bundle-budget ✅
- audit ❌ por `GHSA-vfj7-8cjw-p6xm`.

El audit no se atribuye a T-305: la PR no cambia dependencias/lockfile y el job está rotulado “advisory until contracts-v1”. No debe “arreglarse” desde esta tarea ni debilitando el check.

## e2e-preview del SHA revisado

Run `37088866612`: GREEN.

Pero el log muestra:
- 9 tests `chromium` GREEN de main-flow/smoke;
- 3 tests `global-settings` GREEN;
- **0 tests T-305**.

Por lo tanto ese GREEN no verifica H01/H03/H06 ni cierra el DoD de autorización.

## Resultado

**CON BLOQUEANTES (1).** No hay decisiones nuevas. El siguiente paso es sincronizar la base y adoptar T-331 sin conservar el diff del workflow. La próxima ronda puede ser final si el nuevo `e2e-preview` ejecuta los cuatro casos de T-305 en GREEN.
