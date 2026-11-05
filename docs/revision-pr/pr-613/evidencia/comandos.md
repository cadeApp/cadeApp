# Evidencia reproducible — PR #613 / T-422

**SHA:** `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`. **R1:** 2026-11-05.

## Comprobación en CI del SHA exacto

- E2E success: https://github.com/cadeApp/cadeApp/actions/runs/42075421860 (job 127414325335). Log: checkout de `95f95eed...`; `announcements.spec.ts:67` verde al primer intento; `116 passed (32.6m)`, `6 passed (2.5m)`, reporte `TARGET_SHA=95f95eed...` y `RESULT: success`.
- CI: https://github.com/cadeApp/cadeApp/actions/runs/42073826935 (unit 193/193 archivos y 3568/3568 tests; workflow 85/85; db-tests `Files=42, Tests=3396, Result: PASS`, `git diff --exit-code`; typecheck/lint/build success).
- RED funcional anterior: https://github.com/cadeApp/cadeApp/actions/runs/42061362490 (114 pasaron, 1 flaky, 1 falló en 3 intentos). El detalle de POST abortado -1 solo consta en la bitácora, no se certificó su trace por segunda vez.

## Harness de inspección y mutaciones independientes

Copiar el **código completo** siguiente a `/tmp/pr613-audit.mjs` y ejecutarlo pasando la raíz de un checkout limpio del SHA revisado. No hace `git checkout`, no altera archivos, no lee secretos. Las mutaciones son copias en memoria y el control original se verifica primero.

```bash
cat > /tmp/pr613-audit.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const root = process.argv[2] || process.cwd();
const workflow = readFileSync(join(root,'.github/workflows/e2e-preview.yml'),'utf8').replace(/\r\n/g,'\n');
const spec = readFileSync(join(root,'e2e/specs/announcements.spec.ts'),'utf8').replace(/\r\n/g,'\n');
function timeoutControl(source) {
  const start=source.indexOf('\n  e2e:\n');
  assert.ok(start >= 0, 'job e2e presente');
  const end=source.indexOf('\n  report:',start);
  const job=source.slice(start, end < 0 ? undefined : end);
  const matches=[...job.matchAll(/^    timeout-minutes:\s*(\d+)$/gm)].map(m=>Number(m[1]));
  assert.deepEqual(matches,[75],'el job e2e tiene exactamente timeout 75');
}
function dismissalControl(source) {
  const from=source.indexOf('const banner = merchantPage.getByRole(');
  const to=source.indexOf('await merchantContext.close();',from);
  assert.ok(from >= 0 && to > from,'fragmento del comercio encontrado');
  const part=source.slice(from,to);
  const steps=[
    'const dismissed = merchantPage.waitForResponse(',
    "response.request().method() === 'POST'",
    "new URL(response.url()).pathname === '/merchant/dashboard'",
    "await banner.getByRole('button', { name: 'Cerrar novedad' }).click();",
    'await expect(banner).toHaveCount(0);',
    'expect((await dismissed).ok()).toBe(true);',
    'await merchantPage.reload();',
    'await waitForNoSkeletons(merchantPage);',
    "merchantPage.getByRole('region', { name: 'Novedad de cadeApp' }).filter({ hasText: title })",
    ').toHaveCount(0);',
  ];
  let last=-1;
  for (const step of steps) {
    const at=part.indexOf(step,last+1);
    assert.ok(at>last,`secuencia necesaria ausente: ${step}`);
    last=at;
  }
}
function mutationRed(label, original, mutant, checker) {
  assert.notEqual(mutant,original,`${label}: mutacion sin objetivo`);
  assert.throws(()=>checker(mutant), undefined,`${label}: control ciego`);
  console.log(`${label}: RED (el control rechazo la mutacion)`);
}
timeoutControl(workflow);
dismissalControl(spec);
console.log('CONTROL: GREEN (workflow y spec originales)');
mutationRed('M1 timeout=45',workflow,workflow.replace('timeout-minutes: 75','timeout-minutes: 45'),timeoutControl);
mutationRed('M2 no espera respuesta',spec,spec.replace('expect((await dismissed).ok()).toBe(true);',''),dismissalControl);
mutationRed('M3 metodo GET',spec,spec.replace("method() === 'POST'","method() === 'GET'"),dismissalControl);
mutationRed('M4 path distinto',spec,spec.replace("pathname === '/merchant/dashboard'","pathname === '/merchant/plan'"),dismissalControl);
mutationRed('M5 reload antes del acuse',spec,spec.replace(/expect\(\(await dismissed\)\.ok\(\)\)\.toBe\(true\);\s*await merchantPage\.reload\(\);/, 'await merchantPage.reload();\n        expect((await dismissed).ok()).toBe(true);'),dismissalControl);
console.log('FIN: 5/5 mutaciones rechazadas en memoria; arbol inalterado');
NODE
node /tmp/pr613-audit.mjs "$PWD"
```

Salida esperada (y observada en una prueba aislada del harness con fixture que contiene el contrato de las rutas citadas):

```text
CONTROL: GREEN (workflow y spec originales)
M1 timeout=45: RED (el control rechazo la mutacion)
M2 no espera respuesta: RED (el control rechazo la mutacion)
M3 metodo GET: RED (el control rechazo la mutacion)
M4 path distinto: RED (el control rechazo la mutacion)
M5 reload antes del acuse: RED (el control rechazo la mutacion)
FIN: 5/5 mutaciones rechazadas en memoria; arbol inalterado
```

**Alcance real:** el harness fue ejecutado desde `/tmp` sobre un fixture aislado; no sobre el checkout real porque este contenedor no pudo resolver github.com. No atribuir el RED de este control textual a Playwright ni usarlo como sustituto del GREEN de CI. Los controles textuales prueban orden y presencia, no persistencia end-to-end. El `node --test` del autor tiene 85/85 en CI; el rojo 84/85 al mutar 75→45 fue reportado por el autor pero no reproducido localmente por esta revisión.

## Comandos finales que puede repetir un agente con checkout

```bash
git fetch origin
git diff origin/develop...95f95eedda08ab5b1bb04d289e100ed7649a2b8a --stat
node --test .github/workflows/verify-workflows.test.mjs
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git status --short
```

No levantar Supabase o Docker local. Para DB leer el resultado final de CI como en el encabezado. **No ejecutar contra entornos remotos ni correr workflows manualmente.**
