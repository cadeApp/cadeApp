# Evidencia y comandos — PR #375 / T-358 / ronda 1

## Evidencia comprobada (GitHub Actions, sin logs enteros)
- Código revisado: `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91`.
- `CI`: https://github.com/cadeApp/cadeApp/actions/runs/38799974364, sobre HEAD del PR. `unit`: **Test Files 133 passed (133), Tests 2389 passed (2389)**; `lint/typecheck/build/audit/bundle-budget/db-tests` SUCCESS.
- Job db-tests: **Files=24, Tests=2283, Result: PASS**, seguido del paso `git diff --exit-code -- src/types/database.types.ts`; existen verificaciones intermedias negativas deliberadas ajenas a T-358, no confundir con fallo final.
- `E2E Preview` del código `42ace275`: https://github.com/cadeApp/cadeApp/actions/runs/38794014208; test T-358 `merchant-registration.spec.ts:454` PASS, **79 passed (22.7m)** (junto con 2 global-settings PASS).
- `E2E Preview` del HEAD `b3ace3eb`: https://github.com/cadeApp/cadeApp/actions/runs/38800094742; job e2e-preview **cancelled** y status commit error.
- La inspección estática NO demuestra un fallo runtime ni RED→GREEN propio. Tampoco hubo checkout local por no estar disponible el clon en este entorno.

## Batería de mutaciones independiente — harness COMPLETO
Copiar el script completo siguiente a `/tmp/pr375-r1-mutations.mjs`. Ejecutarlo **solo desde un worktree limpio** en el SHA objetivo con dependencias instaladas. Nunca contra Preview/Supabase ni sobre rama compartida con cambios locales. La batería es de la revisión, no del autor. Primero corre control original; después muta un símbolo identificado y corre el mismo control; finalmente restaura bytes desde memoria (**no usa git checkout**).

```bash
git fetch origin
git worktree add /tmp/cadeapp-pr375-r1 b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91
cd /tmp/cadeapp-pr375-r1
pnpm install --frozen-lockfile
# Copiar el bloque de JS de abajo a /tmp/pr375-r1-mutations.mjs
node /tmp/pr375-r1-mutations.mjs
git status --short
```

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const cases = [
  {
    id: 'H02-control-existente-de-payload',
    file: 'src/features/merchants/actions.ts',
    needle: "business_name: parsed.data.businessName ?? existingMerchant.business_name,",
    mutant: "business_name: 'MUTACION_PR375_DESCARTA_NOMBRE',",
    command: ['pnpm', 'exec', 'vitest', 'run', 'src/features/merchants/actions.test.ts'],
  },
  {
    id: 'H04-vacio-no-detectado',
    file: 'src/features/merchants/schemas.ts',
    needle: 'const hasLat = data.defaultPickupLat !== undefined;',
    mutant: 'const hasLat = false;',
    command: ['pnpm', 'exec', 'vitest', 'run', 'src/features/merchants/schemas.test.ts'],
  },
  {
    id: 'H05-auth-error-degradado',
    file: 'src/features/merchants/queries.ts',
    needle: 'if (authError || !user) {',
    mutant: 'if (!user) {',
    command: ['pnpm', 'exec', 'vitest', 'run', 'src/features/merchants/queries.test.ts'],
  },
];

function run(command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const lines = ((result.stdout || '') + '\n' + (result.stderr || '')).split('\n');
  console.log(lines.filter(x => /Test Files|Tests |FAIL|PASS|Duration|Error:/i.test(x)).slice(-15).join('\n'));
  return result.status ?? -1;
}

let baselinesOk = true;
for (const entry of cases) {
  const target = path.join(root, entry.file);
  const original = fs.readFileSync(target, 'utf8');
  const count = original.split(entry.needle).length - 1;
  if (count !== 1) throw Error(entry.id + ': MUTACIÓN SIN OBJETIVO ÚNICO (' + count + ')');
  console.log('\n' + entry.id + ' CONTROL sin mutar:');
  const baseline = run(entry.command);
  if (baseline !== 0) {
    baselinesOk = false;
    console.log('CONTROL ROJO; no mutar hasta diagnosticarlo');
    continue;
  }
  try {
    fs.writeFileSync(target, original.replace(entry.needle, entry.mutant));
    console.log(entry.id + ' MUTADO:');
    const mutated = run(entry.command);
    console.log(entry.id + ' resultado independiente: ' +
      (mutated === 0 ? 'VERDE CON MUTACIÓN: hueco de cobertura para este mutante' :
       'ROJO CON MUTACIÓN: control detecta este mutante'));
  } finally {
    fs.writeFileSync(target, original);
    if (fs.readFileSync(target, 'utf8') !== original) throw Error('NO RESTAURADO: ' + target);
  }
}
if (!baselinesOk) process.exitCode = 1;
```

> Ninguna salida del harness se inventa ni se considera ejecutada en esta ronda. El script analiza mutantes existentes, NO sustituye los tests ausentes de H01, H03 y H06 ni prueba condiciones de carrera. Si un cambio del código elimina un `needle`, hay que rediseñar el mutante: «sin objetivo» no es verde.

## Comprobaciones exigidas tras corregir (otra ronda)
- **H01/H06 (CC #378)**: test de `MapPicker` **real**, `value=null`, centroide existente/no existente, sin Marker; click genera Marker; botón Quitar vuelve a sin Marker. Mutación en CC: forzar render de Marker con `value=null` ⇒ RED.
- **H02/H03 (CC #379)**: pgTAP con dos transacciones/actores y locks coordinados: cambio A teléfono, cambio B dirección, ambos preservados; rollback al forzar falla en merchants; actor courier y otro merchant sin privilegios. Mutación SQL en suite de prueba local (no Preview): quitar lock/rollback/guard de propietario ⇒ RED; restauración ⇒ GREEN. No levantar Docker aquí sin autorización.
- **H04**: `merchantUpdateSchema.safeParse({defaultPickupLat:null}).success === false`, también `{defaultPickupLng:null}`, pareja nula aceptada, pareja válida aceptada. Mutación que reintroduzca comparación `null==undefined` ⇒ RED.
- **H05**: mock `auth.getUser()` con `error: { message:'auth unavailable' }`, `user:null`; debe lanzar error y activar boundary, no devolver `null`. Mutación `if(authError||!user) return null` ⇒ RED.
- **H07**: E2E Preview de comercio con/sin pin, permiso de otra cuenta, borrado, fallo fetch, phone-only con snapshots concurrentes, con fixtures segregados y cleanup. Publicar SHA, run, resultado por test.
- **Cierre**: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db` en CC por SQL/RPC, `node docs/revision-pr/analizar.mjs verificacion`, comprobar SHA remoto, `git merge-tree --write-tree origin/develop HEAD` y E2E Preview en último SHA.

## Restricciones
No tests falsos, no adulterar expectations/mocks/fixtures/checks/timeouts; no tocar `docs/revision-pr/**` desde agy. No disparar workflows manualmente, no leer `.env*` ni utilizar Supabase remoto de administración.

---
## Ronda 2 — evidencia y control independiente pendiente
**SHA:** e8206d770718766fa0888df68252cb078b131bf0; CI https://github.com/cadeApp/cadeApp/actions/runs/38863709147 (7 jobs success vistos); E2E anterior del SHA e07247b4: https://github.com/cadeApp/cadeApp/actions/runs/38861116727, 79 passed T-358 incluido. E2E del SHA de ronda: https://github.com/cadeApp/cadeApp/actions/runs/38863810444 seguía pending. No afirmar ejecución propia.

**R01 (control propuesto):** montar en onboarding-form.test.tsx modo edit con pin previo (-27.435,-65.615). Mock navigator.geolocation.getCurrentPosition que invoque callback success fuera (-34.6,-58.4). Assert pin intacto y tras cambiar phone, patch exactamente {phone:'3865999888'}. Baseline roto RED; tras solución GREEN; mutar temporalmente añadiendo de nuevo ambos setValue(...null...) => RED; restaurar desde bytes en memoria => GREEN.
**R02:** simular defaultPickupZoneId inactivo fuera de zones activos; assert etiqueta legible y que phone-only no mande zone. Mutar quitando fallback de histórico => RED; restaurar GREEN.
**R03:** con pin inicial validar después de click Quitar ubicación que no aparece mensaje de par de coordenadas y map-value null. Mutar helper setFields con dos setValue secuenciales con shouldValidate:true => RED; restaurar GREEN.

### Harness completo para ejecutar sólo tras implementar tests y arreglos
Guardar el siguiente contenido completo en /tmp/pr375-r2-mut.mjs (afuera del repo) y ejecutar en worktree limpio. Verificar needles únicos: SIN OBJETIVO no es pase.
```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const file = path.resolve('src/features/merchants/components/onboarding-form.tsx');
const src = fs.readFileSync(file,'utf8');
const suite = 'src/features/merchants/components/onboarding-form.test.tsx';
function test(){ const r=spawnSync('pnpm',['exec','vitest','run',suite],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});if(r.error)throw r.error; const lines=((r.stdout||'')+'\n'+(r.stderr||'')).split('\n');console.log(lines.filter(x=>/Test Files|Tests |FAIL|passed|failed/i.test(x)).slice(-12).join('\n'));return r.status??-1;}
const before = "setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);\n          return;";
const after = "setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);\n          setValue('defaultPickupLat', null, { shouldValidate: true });\n          setValue('defaultPickupLng', null, { shouldValidate: true });\n          return;";
if(src.split(before).length!==2){throw Error('R01 SIN OBJETIVO ÚNICO; ajustar needle al fix real. No cuenta como resultado');}
if(test()!==0)throw Error('Baseline no verde');
try { fs.writeFileSync(file,src.replace(before,after)); if(test()===0)throw Error('R01 MUTANTE VERDE; test no cubre conservación'); console.log('R01 MUTANTE ROJO'); }
finally { fs.writeFileSync(file,src); if(fs.readFileSync(file,'utf8')!==src)throw Error('No restaurado'); }
if(test()!==0)throw Error('GREEN final no confirmado');
```
Para R02 y R03 agregar un bloque equivalente con targets precisos de la corrección implementada, tras constatar 1 needle exacto, baseline GREEN, mutación RED, restauración desde memoria, GREEN final. No ejecutar mutaciones sobre Preview, Supabase ni branch remoto. No simular ejecuciones.
Comandos al cierre: pnpm typecheck && pnpm lint && pnpm test; git diff --check; git fetch origin; git merge-tree --write-tree origin/develop HEAD; node docs/revision-pr/analizar.mjs verificacion (por revisión, no agy); GitHub E2E automático último SHA.

---
## Ronda 3 · 2026-10-16
- SHA fallido inicial `837fc14c`: GitHub Actions https://github.com/cadeApp/cadeApp/actions/runs/38871188667, typecheck TS1005 `'}' expected` en `onboarding-form.test.tsx:932`; lint y build FALLAN; unit 1 suite failed, 134 passed, 2382 tests de suites ejecutadas.
- SHA corregido en revisión `17330878f795804c5820be94dc64a764f9fa232c`: falta de llave `});` resuelta con una línea adicional. GitHub Actions https://github.com/cadeApp/cadeApp/actions/runs/38922166022: typecheck, lint y audit success al consultar; unit, build, db-tests **in_progress**, e2e-preview **pending**. No declarar el CI final verde hasta obtener resultados.
- E2E anterior `e8206d77`: run https://github.com/cadeApp/cadeApp/actions/runs/38863810444, success, pero no corresponde a este HEAD.

### Comandos pendientes de ejecución en worktree limpio (no ejecutados por revisión)
```bash
pnpm exec vitest run src/features/merchants/components/onboarding-form.test.tsx
pnpm exec vitest run src/features/merchants/queries.test.ts
pnpm typecheck && pnpm lint && pnpm test
git diff --check
node docs/revision-pr/analizar.mjs verificacion
git fetch origin
git merge-tree --write-tree origin/develop HEAD
git ls-remote origin refs/heads/feat/T-358-edicion-comercio-precarga
```
Repetir pruebas de mutación R01 (GPS fuera no modifica pin), R02 (barrio inactivo etiqueta accesible), R03 (null/null sin error de validación). Ejecutar GREEN original, RED con mutación temporal *de implementación*, GREEN restaurado, sin adulterar assertions, snapshots, mocks, fixtures, timeouts ni CI. No ejecutar contra DB remota.

---
## Ronda 4 — SHA d25721a6631151f9957c8efe07e5d857a2c11b28

### CI y E2E reales, verificados por logs del job
- `CI` https://github.com/cadeApp/cadeApp/actions/runs/38930136340, SHA d25721a6631151f9957c8efe07e5d857a2c11b28: unit 135 suites PASS, 2414 tests PASS; `src/features/merchants/components/onboarding-form.test.tsx` 32 PASS; db-tests final 26 files/2341 tests PASS; typecheck, lint, build, audit, bundle-budget SUCCESS. Se respetaron los `Result: FAIL` intermedios esperados por controles negativos dentro de db-tests; el RESULTADO FINAL fue PASS y el job terminó SUCCESS.
- `E2E` https://github.com/cadeApp/cadeApp/actions/runs/38930252437, mismo SHA: job e2e-preview 79 PASS en 20.4m; el caso `merchant-registration.spec.ts:454` T-358 PASS. Global-settings: 3 PASS.
- `Vercel` y `e2e-preview` statuses SUCCESS.
- `approval-policy` (antes de ronda 4) FAILURE por informe SIN BLOQUEANTES ausente del cuerpo; se corrige mediante edición del body después del informe.
- Esta sesión NO cuenta con clon ni dependencias de Vitest. No se corrió localmente `pnpm` ni `git merge-tree`.

### Controles de fuente negativos propios del revisor

Se ejecutaron controles estáticos de código devuelto por GitHub con predicados JavaScript; todos dieron:
`control=true; mutant_changes_source=true; mutant_red=true; restored_green=true`.
Se verificaron los siguientes 4 mutantes independientemente de la batería del autor:
1. R01: reintroducir `setFields({ defaultPickupLat: null, defaultPickupLng: null }, ...)` justo antes de `return` en rama GPS fuera.
2. R02: eliminar `<SelectItem key={inactiveZoneId} ... disabled>` de opción histórica.
3. R03: sustituir borrado atómico de pin vía `setFields({defaultPickupLat:null,defaultPickupLng:null})` por dos `setValue` aislados.
4. R03-hook: sustituir `const res = resolver(nextCombined)` por `resolver(values)`.

Control extra H08 sobre body: GREEN para ausencia «Draft inicial», evidencia de CI y DoD de revisión; mutante que agrega «Draft inicial» da RED; luego GREEN.

Estos son **controles estáticos de presencia/guardas en el código real**, no tests de la implementación React con mutation runtime. Hay evidencia de ejecución funcional **no mutada** en CI/E2E.

### Harness reproducible para validación estática sin dependencias
Se puede copiar el bloque COMPLETO a `/tmp/pr375-r4-static.mjs`, ejecutándolo desde un checkout del SHA funcional.
```js
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const form = fs.readFileSync(path.join(root, 'src/features/merchants/components/onboarding-form.tsx'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'src/features/merchants/components/form-hooks.ts'), 'utf8');
const tests = fs.readFileSync(path.join(root, 'src/features/merchants/components/onboarding-form.test.tsx'), 'utf8');

function assertMutation(name, baseline, mutation, predicate) {
  if (!predicate(baseline)) throw Error(name + ': baseline RED');
  const mutant = mutation(baseline);
  if (mutant === baseline) throw Error(name + ': SIN OBJETIVO');
  if (predicate(mutant)) throw Error(name + ': MUTANTE VERDE; control insuficiente');
  if (!predicate(baseline)) throw Error(name + ': restauracion RED');
  console.log(name + ': GREEN→RED→GREEN (static)');
}
const checkGPS = s => {
  const start = s.indexOf('if (!isWithinAguilaresBounds(latitude, longitude))');
  const end = s.indexOf('return;', start);
  if (start < 0 || end < 0) return false;
  const branch = s.slice(start, end + 7);
  return branch.includes('setCoordsError(merchantCopy.onboarding.mapOutOfAguilares)') &&
    !/set(Value|Fields)\s*\(\s*['"]defaultPickup|setFields\s*\(\s*\{[^}]*defaultPickup(Lat|Lng)/s.test(branch);
};
assertMutation('R01-GPS', form, s => s.replace(
  'setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);\n          return;',
  'setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);\n          setFields({ defaultPickupLat: null, defaultPickupLng: null }, { shouldValidate: true });\n          return;'
), checkGPS);
const checkZone = s => s.includes('inactiveZoneId') &&
  /if\s*\(\s*inactiveZoneId\s*&&\s*zoneId\s*===\s*inactiveZoneId\s*\)/.test(s) &&
  /<SelectItem[\s\S]{0,220}?key=\{inactiveZoneId\}[\s\S]{0,210}?disabled[\s\S]{0,210}?Barrio anteriormente asignado \(no disponible\)/.test(s);
assertMutation('R02-zona-historica', form, s => s.replace(
  /<SelectItem\s*\n\s*key=\{inactiveZoneId\}[\s\S]*?<\/SelectItem>/, ''
), checkZone);
const checkClear = s => /setFields\s*\(\s*\{\s*defaultPickupLat:\s*null,\s*defaultPickupLng:\s*null\s*\}\s*,\s*\{\s*shouldValidate:\s*true\s*\}\s*\)/s.test(s);
assertMutation('R03-coords', form, s => s.replace(
  /setFields\(\s*\{\s*defaultPickupLat:\s*null,\s*defaultPickupLng:\s*null\s*\},\s*\{\s*shouldValidate:\s*true\s*\}\s*\);/s,
  "setValue('defaultPickupLat', null, { shouldValidate: true });\nsetValue('defaultPickupLng', null, { shouldValidate: true });"
), checkClear);
const checkHook = s => s.includes('const nextCombined = { ...values, ...patch };') &&
  s.includes('const res = resolver(nextCombined)') && s.includes('setValues((prev) => ({ ...prev, ...patch }));');
assertMutation('R03-hook', hook, s => s.replace('const res = resolver(nextCombined);', 'const res = resolver(values);'), checkHook);
if (!['PR375-R01','PR375-R02','PR375-R03'].every(id => tests.includes(id))) throw Error('Falta test esperado');
console.log('Oraculos de R01-R03 presentes.');
```
El harness está planteado para una ejecución futura en un checkout completo. **No afirmar que ese archivo aislado se ejecutó dentro de un worktree de esta sesión**: se ejecutaron sus comprobaciones equivalentes directamente sobre las cadenas de fuente recibidas en GitHub Connector. No modificar código real en disco.
