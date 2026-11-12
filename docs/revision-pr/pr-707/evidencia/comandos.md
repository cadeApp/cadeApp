# Evidencia y comandos reproducibles — PR #707, Ronda 1

## Fuente y límite de la comprobación

**Head:** `cdd964438d8f4ed726fa0f2eeaad3ee28621b1bf`, base `395fdce5f034e2d7c630c2d9f0272ee018477f3a`. Revisión documental; el entorno del revisor no pudo resolver `github.com` mediante Git y no dispone de checkout completo. **No se ejecutó Vitest, CI, Supabase, Vercel ni GitHub secrets.** Solo se leyeron archivos versionados con el conector GitHub.

La prueba independiente en V8 que sí se ejecutó leyó directamente los documentos/workflows de ese SHA, comprobó el wiring (4/4), encontró 3 requisitos ausentes para D3 (GH environment develop, precedencia y verificación independiente), construyó la corrección **en memoria** y reintrodujo la omisión de develop. Resultado observado:
- Control de wiring: cuatro workflows en el environment declarado y referencias a `secrets.CRON_SECRET` presentes.
- Documento original: **RED**, tres obligaciones D3 ausentes.
- Corrección documental simulada sin escribir: **GREEN**, 3/3 presentes.
- Mutación (quitar el ámbito `develop` de esa corrección): **RED**.

El script portable siguiente amplía ese control a H01–H04. No se afirma haberlo ejecutado en el checkout original: requiere que quien lo reproduzca tenga el repositorio y ejecute los comandos indicados.

## Harness íntegro (sin alterar tests ni producción)

Desde un checkout limpio **del SHA original** (ejemplo: worktree nuevo), copiar este bloque a `/tmp/pr707-doc-audit.mjs` y ejecutar `node /tmp/pr707-doc-audit.mjs --demonstrate`. Una vez corregida la ficha, ejecutar `node /tmp/pr707-doc-audit.mjs --validate`. Puede ejecutarse desde `/tmp` con `REPO_ROOT=/ruta/al/checkout`. Todo se transforma en memoria, **ningún archivo se escribe ni se restaura con git checkout**.

```js
// pr707-doc-audit.mjs — Node 22, sin dependencias, sin tocar archivos ni secretos.
// Uso desde un checkout del SHA auditado: node /tmp/pr707-doc-audit.mjs --demonstrate
// Uso del autor tras arreglar la ficha: node /tmp/pr707-doc-audit.mjs --validate
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.env.REPO_ROOT || process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const doc = read('docs/tasks/T-433.md');
const files = {
  preview: read('.github/workflows/e2e-preview.yml'),
  mutation: read('.github/workflows/e2e-mutation.yml'),
  staging: read('.github/workflows/e2e-staging.yml'),
  health: read('.github/workflows/health-cron.yml'),
  cc040: read('docs/contracts/CC-040.md'),
  t203: read('docs/tasks/log/T-203.md'),
};
const cronUsage = /CRON_SECRET:\s*\$\{\{\s*secrets\.CRON_SECRET\s*\}\}/;
assert.match(files.preview, /environment:\s*develop/);
assert.match(files.preview, cronUsage);
assert.match(files.mutation, /environment:\s*develop/);
assert.match(files.mutation, cronUsage);
assert.match(files.staging, /environment:\s*staging/);
assert.match(files.staging, cronUsage);
assert.match(files.health, /environment:\s*staging/);
assert.match(files.health, /environment:\s*production/);
assert.match(files.health, cronUsage);
assert.ok(!files.cc040.includes('/api/push/send'), 'CC-040 no documenta esa ruta');
assert.ok(files.t203.includes('src/app/api/push/send/route.ts'), 'T-203 registra la ruta');
console.log('BASE CONTROL: wiring 4 workflows y origen de la ruta: GREEN');
const D3 = s => (s.match(/\*\*D3-A[\s\S]*?(?=\n## Archivos permitidos)/) || [''])[0];
const D1 = s => (s.match(/\*\*D1-A[\s\S]*?(?=\n- \*\*D2-A)/) || [''])[0];
function checks(s) {
 const d3 = D3(s), d1 = D1(s);
 return {
  H01: /environment\s+`develop`/i.test(d3) &&
       /precedencia|prevalec|prioridad/i.test(d3) &&
       /verifica.{0,75}(?:GitHub|secret efectivo)/i.test(d3),
  H02: !/frontera documentada en CC-040/i.test(d1) && /T-203/.test(d1),
  H03: /32 bytes aleatorios criptográficamente seguros/i.test(d3),
  H04: !/hace fallar\s+\*\*todas\*\*\s+las\s+rutas de servidor/i.test(d3)
 };
}
function report(s, label, expectedFails) {
 const fails = Object.entries(checks(s)).filter(([, v]) => !v).map(([k]) => k).sort();
 console.log(label + ': ' + (fails.length ? 'RED ' + fails.join(',') : 'GREEN (H01-H04)'));
 if (expectedFails) assert.deepEqual(fails, expectedFails.slice().sort(), label);
 return fails;
}
if (process.argv.includes('--validate')) {
 if (report(doc, 'VALIDACION').length) process.exitCode = 1;
} else if (process.argv.includes('--demonstrate')) {
 // Estos reemplazos se aplican SOLO a strings en memoria. El checkout nunca se modifica.
 assert.ok(doc.includes('    - el del repo (e2e-preview, e2e-mutation);'));
 assert.ok(doc.includes('una frontera documentada en CC-040'));
 assert.ok(doc.includes('hace fallar **todas** las\n    rutas de servidor de ese ambiente'));
 const fixed = doc
  .replace('  - Si rota el valor, también actualiza los secrets de GitHub que lo repiten:',
    '  - Antes de cada promoción verifica por separado el secret efectivo de GitHub Actions; el secret del environment tiene precedencia sobre el del repositorio. Si rota el valor, sincroniza todos:')
  .replace('    - el del repo (e2e-preview, e2e-mutation);',
    '    - secret efectivo del environment `develop` para e2e-preview y e2e-mutation, si está configurado; si no, del repositorio;')
  .replace('una frontera documentada en CC-040',
    'una ruta preexistente creada en T-203, cuya eliminación ampliaría el alcance de SEC-08')
  .replace('hace fallar **todas** las\n    rutas de servidor de ese ambiente, no solo los crons.',
    'hace fallar las rutas y funciones que acceden a `serverEnv` en ese ambiente, no solo los crons.')
  .replace('  - El agente no lee ni escribe secretos.',
    '  - Para toda rotación, generar valores únicos por ambiente usando al menos 32 bytes aleatorios criptográficamente seguros, sin publicar sus valores.\n  - El agente no lee ni escribe secretos.');
 report(doc, 'ORIGINAL SHA', ['H01', 'H02', 'H03', 'H04']);
 report(fixed, 'CORRECCION SOLO EN MEMORIA', []);
 const mutants = [
  ['H01', fixed.replace('environment `develop`', 'ámbito genérico')],
  ['H02', fixed.replace('una ruta preexistente creada en T-203, cuya eliminación ampliaría el alcance de SEC-08', 'una frontera documentada en CC-040')],
  ['H03', fixed.replace('  - Para toda rotación, generar valores únicos por ambiente usando al menos 32 bytes aleatorios criptográficamente seguros, sin publicar sus valores.\n', '')],
  ['H04', fixed.replace('hace fallar las rutas y funciones que acceden a `serverEnv` en ese ambiente, no solo los crons.', 'hace fallar **todas** las rutas de servidor en ese ambiente')]
 ];
 for (const [id, mutated] of mutants) report(mutated, 'MUTACION ' + id, [id]);
 console.log('RESULTADO: red de original / green candidata / 4 mutaciones RED, árbol sin cambios');
} else {
 console.error('Elegir --demonstrate (SHA original) o --validate (después del arreglo).');
 process.exitCode = 2;
}

```

### Controles a observar

| Etapa | Resultado esperado |
|---|---|
| Wiring actual de workflows + CC-040/T-203 | GREEN |
| `--demonstrate` sobre el SHA `cdd9644` | Original RED H01,H02,H03,H04; candidata GREEN; mutaciones H01,H02,H03,H04 cada una RED |
| `--validate` sobre la ficha corregida | GREEN para H01–H04 |
| Mutación retirada y fuente sin modificar | El control vuelve a GREEN, sin cambios en el árbol |

La demostración es textual, no valida secrets efectivos ni un resultado HTTP. El objetivo es evitar que una nota de despliegue incorrecta vuelva a superar revisión sin que se detecte.

## Checks del autor y CI

El cuerpo de la PR comunica `pnpm exec vitest run tools` → 123 passed. **Ese resultado no fue reproducido por esta revisión**. El autor deberá correrlo en el checkout y registrar la línea resumen, junto con el harness; no alterar tests para ponerlos verdes. Mientras exista H01, el protocolo pospone el examen de CI global; no se exige otro CI GREEN solo por actualizar bitácora.

**Verificación manual futura (responsable Lautaro073):** antes del merge de implementación y de cada promoción, registrar en #666 la doble verificación Vercel/secret efectivo de GitHub correspondiente, sin revelar valores; para staging/producción validar el éxito del health-cron con el secret sincronizado. La PR documental no requiere acceso actual a secrets.
