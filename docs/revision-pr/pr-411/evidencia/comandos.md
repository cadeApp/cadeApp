# Evidencia — PR #411, ronda 1

SHA revisado: `672de34db9602ccb0c97b3ee8d780acbd0d52f08`. Herramientas: GitHub fetch_file, fetch_pr_patch, logs de Actions; **no** se ejecutaron tests o SQL localmente.

- `e2e/specs/courier-onboarding.spec.ts:550-562` (archivo ya en develop) asigna `const existingDni = '35999888'` → HMAC SHA-256 → update de courier 1; si la base ya tiene ese HMAC, falla antes de navegar.
- `e2e-preview.yml:119-120`: `pnpm exec playwright test --project=chromium --workers=1` y después `--project=global-settings --workers=1`. Con shell `-e`, el segundo no se ejecuta si el primero falla.
- [Run 39094918384, job 117579281090](https://github.com/cadeApp/cadeApp/actions/runs/39094918384/job/117579281090): T-369 piloto activo `✓` (15,3s), T-302 dedup `✘` 3 intentos, `87 passed (21.2m), 1 failed`; error de seed SQL `duplicate key value violates unique constraint "couriers_dni_hmac_key"`.
- [Develop run 39090664594](https://github.com/cadeApp/cadeApp/actions/runs/39090664594): falla anterior al PR en misma área de T-302 (causa preexistente).
- [CI 39094854809](https://github.com/cadeApp/cadeApp/actions/runs/39094854809): unit/typecheck/lint/build/db-tests/audit/bundle-budget GREEN. `approval-policy` falló por bloque placeholder; no arreglar desactivando control.
- `docs/tasks/log/T-369.md` también admite que `global-settings` no tuvo ejecución real. `e2e/AGENTS.md` exige gate real en Preview/Develop.

## Reproducción recomendada PARA AGY (no realizada aquí)

```bash
git fetch origin
git switch feat/T-369-e2e
git pull --ff-only origin feat/T-369-e2e
git diff --check origin/develop...HEAD
# Revisar la falla real del job E2E en GitHub; no modificar Supabase Develop para limpiar el DNI.
# Resolver el fixture T-302 solo en una PR separada/autorizada: DNI por corrida, HMAC real, dos couriers propios, cleanup.
# Volver a ejecutar el workflow normal e2e-preview sin grep/skip/only, recoger resultado del chromium Y del global-settings.
pnpm typecheck && pnpm lint && pnpm test
```

Los datos de E2E son desechables y se rastrean por testRunId. No borrar/actualizar datos de otros runs, no probar contra staging ni producción por esta reparación. Si la falla global-settings aparece tras desbloquear T-302, levantar hallazgo nuevo con log y pruebas del mismo SHA.

## Ronda 3 — Reproducción del oráculo independiente

El revisor usó fuentes reales de GitHub, diffs y logs (14 controles positivos y 6 negativos en memoria); no ejecutó Playwright local. Script equivalente para correr en checkout de SHA eaf3689:

```js
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const old='a91263615730f36c817811f0ac92f56058838409';
const git=(...a)=>cp.execFileSync('git',a,{encoding:'utf8'});
const paths=['e2e/specs/publication-credits.spec.ts','e2e/specs/publication-credits.global-settings.spec.ts','e2e/specs/subscription.global-settings.spec.ts','src/server/e2e/staging-seed.ts'];
const diff=git('diff','--name-only',old,'HEAD').trim().split('\n');
assert.deepEqual(diff,['docs/tasks/log/T-369.md']);
for(const path of paths){ const src=git('show',old+':'+path); const dst=git('show','HEAD:'+path);assert.equal(dst,src);assert.notEqual(dst+'mutant',src); }
const text=git('show','HEAD:e2e/specs/publication-credits.global-settings.spec.ts');
const marker='await setPilotActive(original);';assert.ok(text.includes(marker));assert.ok(!text.replace(marker,'removed').includes(marker));
console.log('Control de identidad de código y negativos PASS');
```

Resultado E2E real observado en logs de https://github.com/cadeApp/cadeApp/actions/runs/39159260485/job/117768945794. **No confundir control estático de fuente con ejecución de Playwright**. Se constató postintegración CC-031, 88+6 PASS; sin ejecutar de nuevo por commits solo documentales.
