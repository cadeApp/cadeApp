# Informe de revisión — PR #275 / T-343 — ronda 4

**PR:** https://github.com/cadeApp/cadeApp/pull/275  
**Head SHA revisado:** `44f61124f5fa5e2c1a5b62b58f772cb283e84254`  
**Base:** `develop` @ `83aeb34f00d2a4e78332d4da9004e1bdaab6def5`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

La decisión B de ronda 3 quedó implementada dentro del alcance autorizado y PR275-H04 se cierra como `arreglado-verificado`.

## Alcance desde ronda 3

Desde `76bd49aa5bb3d84d11e97736e1bf70e3a7dbeea4` hasta el SHA revisado, el autor modificó únicamente:

- `src/server/rpc/cc007.test.ts`
- `tools/verify-scaffold.test.ts`
- `docs/tasks/log/T-343.md`

No escribió `docs/revision-pr/pr-275/**` y no tocó archivos prohibidos por la decisión B.

## PR275-H04-A — aislamiento de mutaciones CC-007

### Inspección

El helper de mutación ya no resuelve archivos contra el checkout principal. Ahora:

- crea un `git worktree add --detach` bajo `os.tmpdir()`;
- enlaza `node_modules` hacia ese worktree;
- resuelve cada ruta como `path.join(mutationWorktree, relativeFilePath)`;
- ejecuta el Vitest hijo con `cwd: mutationWorktree`;
- restaura el archivo dentro del worktree en `finally`;
- elimina el enlace, remueve el worktree y limpia el temporal en `afterAll`.

No hay ningún `writeFileSync` de las mutaciones apuntando a `repoRoot` ni a rutas del checkout principal.

Las expectations de mutación siguen exigiendo:

- que el target exista;
- que el mutator cambie realmente el contenido;
- `status !== 0`;
- salida `FAIL|failed`.

No se agregaron mocks, `.skip`, `.only`, cambios de paralelismo ni timeouts globales.

### Evidencia

La bitácora registra:

- `cc007.test.ts + guards.test.ts` → 100/100 PASS;
- `git diff --exit-code` sobre `guards.ts`, `queries.ts`, `actions.ts` y la migración → exit 0;
- dos `pnpm test` completos consecutivos → 121/121 archivos, 1921/1921 tests.

Además, el job `unit` de CI del mismo SHA ejecutó Vitest con coverage en Linux y obtuvo:

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
Duration   64.15s
```

Esto confirma independientemente que el aislamiento funciona también fuera del Windows donde se produjo la evidencia local.

## PR275-H04-B — ESLint batch

### Inspección

`tools/verify-scaffold.test.ts` ahora:

- declara los 14 paths en `FILES`;
- crea una sola instancia de `ESLint`;
- ejecuta una única llamada `eslint.lintFiles(...)` en `beforeAll`;
- indexa por path absoluto en `Map<string, ESLint.LintResult>`;
- cada `it` usa `resultFor()`.

Las assertions funcionales no se debilitaron: permanecen los mismos `ruleId`, `messages.length > 0` y `messages.length === 0` según el caso. No se aumentó ningún timeout ni se cambiaron fixtures/configuración ESLint.

### Evidencia

- autor: `verify-scaffold` 14/14 PASS;
- CI `unit` sobre el mismo SHA: suite completa 1921/1921 PASS.

## Resto de T-343

Los hallazgos anteriores permanecen cerrados:

- PR275-H01: SSR propaga error de contrato y no simula feed vacío;
- PR275-A01: ampliación de `feed-privacy.test.tsx` aceptada por Lautaro073;
- PR275-H03: body completo; `approval-policy` final PASS.

No se reintrodujeron cambios funcionales del vocabulario durante H04.

## CI del SHA revisado

Run CI `37413116003`:

- typecheck ✅
- lint ✅
- unit ✅ — 121/121 archivos, 1921/1921 tests
- build ✅
- db-tests ✅ — Files=18, Tests=1811, Result: PASS
- bundle-budget ✅
- audit ❌ — advisory de dependencias, no bloqueante según el propio workflow y sin cambios de `package.json` / lockfile

Externos:

- Vercel ✅
- e2e-preview run `37413211750` ✅:
  - chromium: 33 passed;
  - `courier-feed-vocabulary.spec.ts` PASS;
  - global-settings: 3 passed.
- approval-policy run `37414360623` ✅ — “Informe de revisar-pr completo y sin bloqueantes.”

## Conclusión

No quedan hallazgos abiertos ni decisiones pendientes. El único check rojo es `audit`, explícitamente advisory hasta contracts-v1 y causado por dependencias no modificadas por T-343.
