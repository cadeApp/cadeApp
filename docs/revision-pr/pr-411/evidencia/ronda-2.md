# PR #411 — evidencia independiente ronda 2

SHA revisado: `7d8ed48a63753e37f3a838738eefedf2ccbcd699`; SHA que realmente probó E2E: `c1224841cd9348798dc96d802abda36f60abdda2`. **Diferencia: solo docs/tasks/log/T-369.md.**

[E2E run 39103489668, job 117604421950](https://github.com/cadeApp/cadeApp/actions/runs/39103489668/job/117604421950) — logs inspeccionados directamente:
```text
HEAD is now at c122484 Merge remote-tracking branch 'origin/develop' into feat/T-369-e2e
88 passed (23.7m)    [chromium]
✓ T-369 piloto activo sin cargos (16.5s)
✓ T-369 sin créditos: admin AAL2, reserva, consumo (42.9s)
✓ T-369 vencimiento y reintegro (22.3s)
✓ T-369 plan ilimitado publicado sin créditos (30.7s)
6 passed (2.7m)      [global-settings: 3 T-369 + 3 T-306]
```

[CI 39103421344](https://github.com/cadeApp/cadeApp/actions/runs/39103421344): `unit` 145/145, 2765/2765; `db-tests` Files=29, Tests=2764, Result PASS; T369 8/8 escenarios de concurrencia PASS.

## Oráculo propio (fuente + cinco controles negativos en memoria)

Se descargó `e2e/specs/courier-onboarding.spec.ts` del SHA revisado y se acotó al test `Flujo 2`, más el helper `pickAvailableDni`. El original cumplió cinco comprobaciones y los cinco mutantes textuales rompieron **su respectiva comprobación**. No equivale a una mutación del runtime de Playwright.

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('e2e/specs/courier-onboarding.spec.ts','utf8');
const a=source.indexOf("test('Flujo 2: Deduplicación de DNI"), b=source.indexOf("test('Flujo 3: Admin",a);
assert.ok(a>=0&&b>a);
const block=source.slice(a,b);
const h=source.indexOf('async function pickAvailableDni(');
assert.ok(h>=0);
const helper=source.slice(h,source.indexOf('test.describe(',h));
const checks=(f,s)=>[s.includes('testRunId}:${attempt}:${randomBytes(8)'),s.includes(".eq('dni_hmac', dniHmac)"),f.includes('{ dni: existingDni, courierId: courier2.id }'),f.includes('await expect(duplicateDniAlert).toBeVisible'),f.includes("expect(page.url()).not.toContain('/courier/onboarding/status')")];
assert.ok(checks(block,helper).every(Boolean));
const mutations=[
[block,helper.replace('testRunId}:${attempt}:${randomBytes(8)','${attempt}:${randomBytes(8)'),0],
[block,helper.replace(".eq('dni_hmac', dniHmac)",".eq('dni_hmac','wrong')"),1],
[block.replace('{ dni: existingDni, courierId: courier2.id }','{ dni: "00000000", courierId: courier2.id }'),helper,2],
[block.replace('await expect(duplicateDniAlert).toBeVisible','// removed'),helper,3],
[block.replace("expect(page.url()).not.toContain('/courier/onboarding/status')",'// removed'),helper,4]
];
for(const [f,s,i] of mutations)assert.equal(checks(f,s)[i],false);
console.log('5/5 invariantes y 5/5 controles negativos detectados');
```

## Gate de integración aún pendiente

Al revisar `develop` SHA `29a44225513621ca9430924cd90d4c929c219e8d`; rama 13 commits detrás y 7 adelante. Nuevos archivos CC-031 incluyen migración SQL, pgTAP, integración de concurrencia y workflow. Ninguna prueba citada cubre el merge futuro. No se ejecutaron tests, Docker, Postgres ni acceso a Supabase local por esta revisión.