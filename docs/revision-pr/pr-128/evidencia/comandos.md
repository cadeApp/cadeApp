# Evidencia reproducible — PR #128

## Ronda 3

SHA revisado: `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`  
Base: `develop@ffded647be7445b33092ccc76d26e78430ec87dd`.

### Sincronización

GitHub compare:

```
status: ahead
ahead_by: 6
behind_by: 0
merge_base: ffded647be7445b33092ccc76d26e78430ec87dd
```

El merge de develop quedó en `885ecb0`; el commit funcional final es `f0c613a`.

### Harness independiente

El siguiente script se copió a `/tmp/pr128-r3-compact.mjs` y se ejecutó contra una copia exacta de `.github/workflows/deploy.yml` del SHA revisado guardada como `/tmp/pr128-deploy.yml`.

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(process.argv[2], 'utf8');

function job(yaml, name) {
  const normalized = yaml.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1);
  const next = normalized.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}

function step(body, name) {
  const normalized = body.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n      - name: ${name}\n`);
  assert.notEqual(start, -1);
  const next = normalized.slice(start + 1).search(/\n {6}- /);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}

function shellCommands(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const runIndex = lines.findIndex((line) => /^\s*run: \|\s*$/.test(line));
  assert.notEqual(runIndex, -1);
  const runIndent = (lines[runIndex] ?? '').search(/\S/);
  const commands = [];
  let pending = '';

  for (const raw of lines.slice(runIndex + 1)) {
    if (raw.trim() !== '' && raw.search(/\S/) <= runIndent) break;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.endsWith('\\')) {
      pending += `${line.slice(0, -1).trimEnd()} `;
      continue;
    }

    commands.push(pending + line);
    pending = '';
  }

  if (pending) commands.push(pending.trimEnd());
  return commands;
}

function check(yaml) {
  for (const name of ['staging', 'production']) {
    const body = job(yaml, name);
    const commands = shellCommands(step(body, `Build and deploy to Vercel (${name})`));

    const pull = commands.findIndex((command) =>
      command.startsWith('pnpm dlx vercel@61.0.0 pull --yes --environment=production')
    );
    const build = commands.findIndex((command) =>
      command.startsWith('pnpm dlx vercel@61.0.0 build --prod')
    );
    const deploy = commands.findIndex((command) =>
      /^url="\$\(pnpm dlx vercel@61\.0\.0 deploy --prebuilt --prod .*\)"$/.test(command)
    );

    assert.notEqual(pull, -1);
    assert.notEqual(build, -1);
    assert.notEqual(deploy, -1);
    assert.ok(pull < build && build < deploy);

    const healthCommands = shellCommands(step(body, 'Health check'));
    assert.equal(healthCommands.length, 1);

    const health = healthCommands[0] ?? '';
    assert.ok(health.startsWith('curl --fail '));

    for (const flag of ['--retry 6', '--retry-delay 10', '--retry-all-errors']) {
      assert.ok(health.includes(` ${flag} `));
    }

    assert.ok(health.endsWith(' "$APP_URL/api/health"'));
  }
}

function run(label, yaml) {
  try {
    check(yaml);
    console.log(`${label}: GREEN`);
  } catch {
    console.log(`${label}: RED`);
  }
}

run('baseline', source);

run(
  'author-comment-pull',
  source.replace(
    '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"',
    '          # pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"'
  )
);

run(
  'author-negate-health',
  source.replace('          curl --fail --silent', '          ! curl --fail --silent')
);

run(
  'author-echo-build',
  source.replace(
    '          pnpm dlx vercel@61.0.0 build --prod --token="$VERCEL_TOKEN"',
    '          echo "pnpm dlx vercel@61.0.0 build --prod --token=$VERCEL_TOKEN"'
  )
);

run(
  'own-swap-pull-build',
  source.replace(
    '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"\n' +
      '          pnpm dlx vercel@61.0.0 build --prod --token="$VERCEL_TOKEN"',
    '          pnpm dlx vercel@61.0.0 build --prod --token="$VERCEL_TOKEN"\n' +
      '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"'
  )
);

run(
  'own-remove-deploy',
  source.replace(
    '          url="$(pnpm dlx vercel@61.0.0 deploy --prebuilt --prod --token="$VERCEL_TOKEN")"\n',
    ''
  )
);

run(
  'own-health-or-true',
  source.replace(
    '            --max-time 15 "$APP_URL/api/health"',
    '            --max-time 15 "$APP_URL/api/health" || true'
  )
);

run(
  'scope-pull-or-true',
  source.replace(
    '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN"',
    '          pnpm dlx vercel@61.0.0 pull --yes --environment=production --token="$VERCEL_TOKEN" || true'
  )
);
```

Comando:

```bash
node /tmp/pr128-r3-compact.mjs /tmp/pr128-deploy.yml
```

Salida:

```
baseline: GREEN
author-comment-pull: RED
author-negate-health: RED
author-echo-build: RED
own-swap-pull-build: RED
own-remove-deploy: RED
own-health-or-true: RED
scope-pull-or-true: GREEN
```

El último caso se registró como ampliación fuera del DoD de H02: el comando sí existe y se ejecuta en el orden requerido; lo que cambia es la propagación explícita de errores de `pull`, un invariante que no originó el hallazgo. No se utiliza para mantener H02 abierto.

### Reproducción de la evidencia del autor

La bitácora declara RED para comentario de pull, negación de health y echo build. Las tres salen RED también en el harness independiente.

### CI exacto

Run CI #606 sobre `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`.

Resumen extraído del job `unit`:

```
Test Files 103 passed (103)
Tests      1381 passed (1381)
# pass 27
# fail 0
# pass 6
# fail 0
```

Job `db-tests`:

```
Files=12, Tests=1601
Result: PASS
[db:types] Ejecutando: pnpm supabase gen types typescript --schema public --local
[db:types] Tipos generados exitosamente ...
```

El mismo step del workflow contiene después:

```bash
git diff --exit-code -- src/types/database.types.ts
```

y el job terminó `success`.

Jobs finales:

```
lint          success
unit          success
typecheck     success
build         success
audit         success
db-tests      success
bundle-budget success
```

### Bundle budget

El job es advisory y el log fue leído, no solo su color. Entre las rutas sobre 180 kB aparecen varias rutas admin a 236 kB y `/design-system` a 185 kB. T-315 solo cambia workflows/tests/docs y no modifica producto ni bundle, por lo que esos valores no se atribuyen a esta PR.
