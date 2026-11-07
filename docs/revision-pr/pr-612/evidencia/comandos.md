# Evidencia y comandos — PR #612 / T-422, ronda 1

**SHA inspeccionado:** `aa2357d3646e3e963941c979d8ddb452489d313c`. Los resultados CI se consultaron en GitHub Actions; no son ejecución local del revisor.

## CI de ese SHA

- Run: https://github.com/cadeApp/cadeApp/actions/runs/41982718298
- `unit`: `verify-workflows: # tests 83 / # pass 83`.
- `db-tests`: `Files=42, Tests=3396` y después `Result: PASS`; chequeo final `git diff --exit-code -- src/types/database.types.ts` en verde.
- 7/7 jobs completed/success. `lint`, `typecheck` y `build` verdes.
- Run anterior que motivó la corrección: https://github.com/cadeApp/cadeApp/actions/runs/41977303708; resumen `108 passed, 8 failed`.
- No se afirma que el gate actualizado haya ejecutado los 8 E2E en verde.

## Harness independiente completo — mutaciones estructurales **en memoria**

Copiar el bloque a `/tmp/pr612-mutaciones.sh` y ejecutarlo desde la raíz de un clon **limpio** del SHA inspeccionado. No toca ni revierte archivos del repositorio. Usa solo Node 22 y los bytes del YAML; no prueba Google, APIs ni Playwright. La inspección independiente en memoria ya evaluó una batería equivalente con **GREEN basal y 7/7 RED**; los resultados de **este archivo específico** deben registrarse al ejecutarlo, no suponerse.

```bash
cat > /tmp/pr612-mutaciones.sh <<'SHELL'
#!/usr/bin/env bash
set -euo pipefail
node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = '.github/workflows/e2e-preview.yml';
const original = fs.readFileSync(path, 'utf8');

function part(yaml, first, next) {
  const start = yaml.indexOf(first);
  const end = yaml.indexOf(next, start + first.length);
  assert(start >= 0 && end > start, 'sin objetivo: faltan límites de un step');
  return yaml.slice(start, end);
}
function failures(yaml) {
  const v = part(yaml, '- name: Generate throwaway VAPID keys', '- name: Build PR without privileged secrets');
  const b = part(yaml, '- name: Build PR without privileged secrets', '- name: Run preview E2E gate');
  const r = part(yaml, '- name: Run preview E2E gate', '- uses: actions/upload-artifact');
  const checks = {
    generator: v.includes("require('web-push').generateVAPIDKeys()"),
    maskBeforePrivateOutput: v.indexOf('echo "::add-mask::$private"') >= 0 &&
      v.indexOf('echo "::add-mask::$private"') < v.indexOf('echo "private=$private" >> "$GITHUB_OUTPUT"'),
    noGlobalVapidExport: !v.includes('GITHUB_ENV'),
    mapsKey: b.includes('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${{ vars.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }}'),
    mapsId: b.includes('NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: ${{ vars.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID }}'),
    publicVapidBuildAndServer:
      b.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ steps.vapid.outputs.public }}') &&
      r.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ steps.vapid.outputs.public }}'),
    privateVapidServerOnly:
      !b.includes('VAPID_PRIVATE_KEY') && !b.includes('outputs.private') &&
      r.includes('VAPID_PRIVATE_KEY: ${{ steps.vapid.outputs.private }}'),
    noPrivilegedBuild:
      !/(SUPABASE_SERVICE_ROLE_KEY|DNI_HMAC_SECRET|CRON_SECRET)/.test(b),
    buildCommand: b.includes('run: pnpm build'),
  };
  return Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
}
const mutations = [
  ['private-in-build', x => x.replace('run: pnpm build', 'VAPID_PRIVATE_KEY: ${{ steps.vapid.outputs.private }}\n        run: pnpm build')],
  ['maps-dummy', x => x.replace('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${{ vars.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }}', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: e2e-intercepted-maps-key')],
  ['without-mask', x => x.replace('echo "::add-mask::$private"', 'true')],
  ['private-to-GITHUB_ENV', x => x.replace('echo "private=$private" >> "$GITHUB_OUTPUT"', 'echo "private=$private" >> "$GITHUB_ENV"')],
  ['maps-id-empty', x => x.replace('NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: ${{ vars.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID }}', "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: ''")],
  ['public-vapid-swapped', x => x.replace('NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ steps.vapid.outputs.public }}', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${{ steps.vapid.outputs.private }}')],
  ['private-vapid-swapped', x => x.replace('VAPID_PRIVATE_KEY: ${{ steps.vapid.outputs.private }}', 'VAPID_PRIVATE_KEY: ${{ steps.vapid.outputs.public }}')],
];
assert.deepEqual(failures(original), [], 'El control original debe estar GREEN');
console.log('GREEN basal (estructural)');
for (const [name, change] of mutations) {
  const mutant = change(original);
  assert.notEqual(mutant, original, 'sin objetivo: ' + name);
  const killedBy = failures(mutant);
  assert(killedBy.length > 0, 'FALSA GREEN en mutación ' + name);
  console.log('RED ' + name + ' -> ' + killedBy.join(', '));
}
console.log('7/7 mutaciones independientes detectadas; sin cambios en el árbol');
NODE
SHELL
chmod +x /tmp/pr612-mutaciones.sh
bash /tmp/pr612-mutaciones.sh
git status --short
```

**Limitación:** este harness evalúa invariantes estáticos, no sustituye la suite completa ni certifica las restricciones de referrer. Si un reemplazo no encuentra su objetivo, falla antes de contar esa mutación.

## H01: diagnosticar la guarda ausente

Sobre `aa2357d`, `Verify Supabase Develop target` comprueba los refs de Supabase pero no la presencia de las dos variables de Google Maps. `createPublicEnv` en `src/lib/env.public.ts` usa `z.string().optional().default('')` para ambas. Por tanto no hay evidencia de fail-fast antes de `pnpm build` si falta alguna variable.

**Después del arreglo del agy**:

1. Ejecutar `node --test .github/workflows/verify-workflows.test.mjs` en GREEN.
2. Mutar temporalmente **solo en memoria** el step nuevo y remover cada guarda, una por vez. El nuevo test debe fallar **por la aserción de esa guarda**, no por error de sintaxis.
3. Confirmar GREEN al restaurar el texto original. Documentar el nombre exacto del test fallido y la salida `# pass / # fail` para RED y GREEN.
4. No modificar ni endurecer a la fuerza E2E existentes para obtener verde; usar los specs sin adulteraciones.

## Evidencia que todavía no existe

La primera corrida real del gate actualizado desde `develop`, con valores Maps A, no ocurrió en el SHA revisado. La evidencia de que la API key funciona en `localhost:3100` y de que las ocho fallas iniciales desaparecieron requiere esa corrida **después** del merge. No habilitar prematuramente Ignored Build Step solo `develop`.


---

## Ronda 2 — harness independiente estructural, SHA 4dfca216

Se ejecutó sobre los bytes del YAML devueltos por GitHub, en memoria: **GREEN basal, 9/9 mutaciones detectadas**. No se modificó el repositorio ni se ejecutó E2E. Para reproducirlo sobre una copia limpia del SHA (solo Git y Node 22, sin secretos ni Supabase):

```bash
git show 4dfca21602da7fc067bae4c82ba04c1e1fcd2366:.github/workflows/e2e-preview.yml > /tmp/pr612-r2-workflow.yml
node - /tmp/pr612-r2-workflow.yml <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const yaml = fs.readFileSync(process.argv[2], 'utf8');
const names = ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID'];
const guardName = '- name: Validate Maps public configuration';
const buildName = '- name: Build PR without privileged secrets';
function part(s,a,b) {
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length);
  return i>=0&&j>i?s.slice(i,j):null;
}
function audit(s) {
  const errors=[];
  const positions=['- name: Verify Supabase Develop target','- name: Generate throwaway VAPID keys',
    guardName,buildName,'- name: Run preview E2E gate'].map(x=>s.indexOf(x));
  if(positions.some((v,i)=>v<0||(i>0&&v<=positions[i-1])))errors.push('order');
  const g=part(s,guardName,buildName);
  if(!g)return [...errors,'guard absent'];
  if(!g.includes('shell: bash'))errors.push('shell');
  if(/secrets\.|SUPABASE_SERVICE_ROLE_KEY|DNI_HMAC_SECRET/.test(g))errors.push('privilege');
  if(/continue-on-error:\s*true/.test(g))errors.push('continue-on-error');
  for(const name of names){
    if(!g.includes('          '+name+': ${{ vars.'+name+' }}')) errors.push('env '+name);
    const re=new RegExp('if \\[ -z "\\$'+name+'" \\]; then\\n\\s+echo \'::error::[^\\n]*'+name+
      '[^\\n]*\'\\n\\s+exit 1\\n\\s+fi');
    if(!re.test(g))errors.push('ineffective guard '+name);
  }
  const index=g.indexOf('        run: |\n');
  if(index<0)return [...errors,'run absent'];
  const commands=g.slice(index+15).split('\n').map(x=>x.trim()).filter(Boolean);
  if(commands[0]!=='if [ -z "$'+names[0]+'" ]; then')errors.push('pre-guard');
  if(commands.some(x=>/^(echo|printf|cat).*\$NEXT_PUBLIC_GOOGLE_MAPS/.test(x)))errors.push('leak');
  return errors;
}
const muts=[
 ['key guard bypass',s=>s.replace('if [ -z "$'+names[0]+'" ]; then','if false; then')],
 ['id guard bypass',s=>s.replace('if [ -z "$'+names[1]+'" ]; then','if false; then')],
 ...names.map(n=>['exit 0 '+n,s=>s.replace("echo '::error::Falta la variable "+n+" en el Environment develop.'\n            exit 1",
      "echo '::error::Falta la variable "+n+" en el Environment develop.'\n            exit 0")]),
 ['guard after build',s=>{const block=part(s,guardName,buildName);return s.replace(block,'').replace(buildName,buildName+'\n'+block)}],
 ['secret in guard',s=>s.replace('          '+names[1]+':','          DNI_HMAC_SECRET: ${{ secrets.DNI_HMAC_SECRET }}\n          '+names[1]+':')],
 ['continue-on-error',s=>s.replace(guardName,guardName+'\n        continue-on-error: true')],
 ['logging key',s=>s.replace('if [ -z "$'+names[0]+'" ]; then','echo "$'+names[0]+'"\n          if [ -z "$'+names[0]+'" ]; then')],
 ['pre-guard exit',s=>s.replace('if [ -z "$'+names[0]+'" ]; then','exit 0\n          if [ -z "$'+names[0]+'" ]; then')],
];
assert.deepEqual(audit(yaml), [], 'baseline GREEN');
console.log('GREEN basal');
for(const [name,change] of muts){
  const mutated=change(yaml);
  assert.notEqual(mutated,yaml,'sin objetivo: '+name);
  assert(audit(mutated).length>0,'FALSE GREEN '+name);
  console.log('RED',name,audit(mutated).join(', '));
}
console.log('9/9 mutaciones estructurales detectadas');
NODE
```

**Nota:** el harness estructural independiente no es la ejecución local del test de Node que hizo el agy. Su bitácora registra dos RED de 84 tests / 83 pass / 1 fail, original 84/84. En CI run 42056929601 el archivo original pasó 84/84; Vitest pasó 3568/3568 en 193 archivos. El job `db-tests` terminó en **success**: `Files=42, Tests=3396, Result: PASS`, concurrencia completada y comparación de tipos sin diferencias. **7/7 jobs del CI completos y verdes**.
