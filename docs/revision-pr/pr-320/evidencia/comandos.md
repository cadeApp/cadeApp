# Evidencia reproducible — R1 de PR #320

**SHA leído:** `3f23e01d22e3d32ffa5be5e42d07f5ca13092d85`. Los comandos dinámicos siguientes son para que el agente los EJECUTE con entorno autorizado; no se presentan como ejecutados por este diagnóstico.

## Evidencia observada

- CI `https://github.com/cadeApp/cadeApp/actions/runs/38321991209`: 129/2116 unit PASS; 21/1995 DB PASS; drift de tipos, lint, build, audit, bundle-budget SUCCESS.
- E2E `https://github.com/cadeApp/cadeApp/actions/runs/38322166091/job/115052584011`: 61 passed, 10 failed, un flaky y job cancelled. `multi-drop.spec.ts:182`: 3 FAIL por tarjeta no visible. `t340-legacy-checkpoint.spec.ts`: PASS.
- Vercel `https://vercel.com/lautaroj073/cadeapp-develop/2YWRezV6nh2Ti1WBQfYqf3fUiqQp`: `GET /courier/feed` lanza `Inconsistencia ... drops_count=1 pero no se encontraron entregas`.
- `main-flow.spec.ts:535`: `getByText(/^entregado$/i)` coincide 2 veces.
- `courier-private-columns.spec.ts`: timeout de 0 eventos Realtime en primer intento, retry PASS.

## Harness de inspección exacta (Node estándar, sin secretos, sin DB)

```bash
node <<'NODE'
const fs = require('node:fs');
const s=fs.readFileSync('src/server/e2e/staging-seed.ts','utf8');
const a=s.slice(s.indexOf('export async function seedStagingData('),s.indexOf('export async function seedOffersForFirstRequest('));
const b=s.slice(s.indexOf('export async function seedDeliveryRequestInState('),s.indexOf('export async function getPlatformSettingNumber('));
const v=fs.readFileSync('e2e/specs/courier-feed-vocabulary.spec.ts','utf8');
const q=fs.readFileSync('src/features/offers/queries.ts','utf8');
const found={
  mainSeedPublishesBeforeChildren:a.includes("status: 'published'") &&
    a.indexOf('if (options?.withContacts || options?.recipientPhone)') < a.indexOf(".from('delivery_request_drops')"),
  otherSeedOmitsDrops:!b.includes(".from('delivery_request_drops')"),
  otherSeedOmitsPrivateContacts:!b.includes(".from('delivery_request_drop_contacts')"),
  t343UpdatesOnlyLegacy:v.includes(".from('delivery_requests')")&&!v.includes(".from('delivery_request_drops')"),
  feedUsesDrop1:q.includes('const effectivePackageType = firstDrop.packageType'),
  ambiguousSelector:fs.readFileSync('e2e/pages/trip.page.ts','utf8').includes('getByText(/^entregado$/i)')
};
console.log(found);
if(Object.values(found).some(x=>!x))process.exitCode=1;
NODE
```

**Este harness no es Vitest ni E2E**: muestra propiedades textuales contrastables en el SHA de referencia. Tras corrección se espera que los hallazgos correspondientes desaparezcan, y se necesitan *tests reales* que fallen cuando se mutan los oráculos.

## Comandos solicitados al corrector — NO ejecutados aquí

```bash
pnpm vitest run src/server/e2e/staging-seed.test.ts
pnpm exec playwright test e2e/specs/multi-drop.spec.ts e2e/specs/t340-legacy-checkpoint.spec.ts e2e/specs/courier-feed-vocabulary.spec.ts --project=chromium --workers=1 --reporter=line
pnpm exec playwright test e2e/specs/main-flow.spec.ts e2e/specs/courier-private-columns.spec.ts --project=chromium --workers=1 --reporter=line
pnpm typecheck && pnpm lint && pnpm test
```
Playwright **solo en Develop autorizado**, secretos del runner protegidos. Si no hay entorno seguro para lanzarlo, documentarlo; no inventar GREEN ni imprimir `.env`. No Docker local ni escritura SQL remota desde la revisión.


## Ronda 2 independiente — 2026-10-13

**Código verificado:** `d755e6fb5b9391b81872d9fd7d93359aaf97f5c3`.
**E2E verdadero:** [run 38361113528](https://github.com/cadeApp/cadeApp/actions/runs/38361113528), `resolve-preview` job 115175275790 y `e2e-preview` job 115175339942. El resolver identificó `PR interna #320 contra develop` y el checkout real en el job E2E fue `git checkout --force d755e6fb5b9391b81872d9fd7d93359aaf97f5c3`. No confundir `run.head_sha=875f8621` (workflow control plane de `develop`) con el commit de aplicación realmente ejecutado.

**Resumen exacto del log real:**
```text
Running 72 tests using 1 worker
72 passed (15.5m)
Running 3 tests using 1 worker
[global-settings] subscription.global-settings.spec.ts:107 DoD 1 PASS
[global-settings] subscription.global-settings.spec.ts:159 DoD 2 PASS (21.4s)
[global-settings] subscription.global-settings.spec.ts:209 DoD 3 PASS
3 passed (1.0m)
```
No `failed` ni `flaky` en el resumen final. Se comprobaron `t340-legacy-checkpoint` y los ocho casos que previamente fallaban en el feed.

**Commit status exacto:** `e2e-preview = success` («trusted E2E gate GREEN») sobre SHA `d755e6f`; deployment `dpl_4gCaqqbjBF2MuhGUss9h2UV5kUX8`. Job `report-preview-status` completó `success`.

**CI técnica sobre SHA `d755e6f`:** [run 38361008865](https://github.com/cadeApp/cadeApp/actions/runs/38361008865), unit PASS 129 suites/2133 Vitest, 79 workflows y 6 ADR; db-tests PASS, typecheck/lint/build/audit/bundle-budget PASS; Vercel SUCCESS. `approval-policy` aún FAIL por documentación/revisión pendiente.

**Código verificado por lectura en HEAD:** `src/server/e2e/staging-seed.ts` materializa el drop 1 y `delivery_request_drop_contacts` antes del update `draft→published|matched|in_transit|delivered` en los dos helpers. `e2e/specs/courier-feed-vocabulary.spec.ts` prepara drop 1, `e2e/pages/trip.page.ts` limita el selector al header. Diff sin nuevos `.skip`, `.only`, incrementos de timeouts/retries ni cambios a lectores/RLS. En `docs/tasks/log/T-340.md` la última entrada 07:15 documenta limpieza anterior de Develop, pero no registra este run nuevo y todavía exige checkpoint con T-352: **H07 documental pendiente**.

**Limitaciones de esta revisión:** no se ejecutaron `pnpm` ni `psql` local ni SQL remoto, y no se inspeccionaron datos personales. El usuario documentó una limpieza autorizada de Develop antes del run: el E2E GREEN valida que el feed no se rompió en ese momento, no certifica ausencia futura de residuos ante jobs cancelados. Las mutaciones RED previas constan en la bitácora del autor y no fueron recreadas localmente por el revisor.
