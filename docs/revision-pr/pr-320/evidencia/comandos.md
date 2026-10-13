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
