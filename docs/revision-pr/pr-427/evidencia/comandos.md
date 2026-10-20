# Evidencia reproducible — PR #427

```powershell
git diff --stat origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
git diff origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
git diff --check origin/develop...6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46
pnpm typecheck
pnpm lint
node --test .github/workflows/verify-workflows.test.mjs
pnpm vitest run src/server/supabase/clients.test.ts
gh pr checks 427
```

El diff funcional inspeccionado contiene una adición y una eliminación en `.github/workflows/e2e-staging.yml`: sólo `timeout-minutes: 20` → `45`.

## Ronda 2 — revisión independiente (2026-10-19)

**SHA revisado:** `6fbd2de3542e991ed6eef4fb49c956e19d5464d1`; base `develop@1e69477dae1e50cd67c307c9a0f987366f90c98e`.

- Diff GitHub: `GET /repos/cadeApp/cadeApp/pulls/427/files`; únicamente `.github/workflows/e2e-staging.yml` y `.github/workflows/verify-workflows.test.mjs` son cambios funcionales.
- Ficha original de T-374 leída desde `develop`; autoriza el cambio. Revisados `docs/tasks/log/T-374.md`, PR #427 y comentarios.
- CI del SHA: [39305084513](https://github.com/cadeApp/cadeApp/actions/runs/39305084513) **success**, `unit` incluye workflows 79/79 y ADR 6/6; pgTAP `Files=31, Tests=2868, Result: PASS`; los logs contienen mutaciones RED deliberadas de otros frentes, que no son un fallo del estado final.
- [E2E Preview 39305230026](https://github.com/cadeApp/cadeApp/actions/runs/39305230026): intento 1 cancelado, 85 passed, 4 flaky, 2 failed y timeout ~45m; intento 2 `in_progress` durante la inspección, no se contó como PASS.
- `approval-policy` rojo al inspeccionar por falta del informe en el cuerpo; pendiente su actualización.

### Sonda de mutaciones **del revisor** — independiente de la del autor

Ejecutada sobre el contenido de los dos archivos GitHub correspondientes al SHA anterior. No modificó ramas o archivos remotos ni representó una corrida de Playwright o del `node --test` completo. Resultados propios:

| Mutación | Resultado del control |
|---|---|
| M0 Original: `timeout-minutes: 45` | Detecta exactamente el 45 del job `e2e` |
| M1 `45→44` | No coincide: RED lógico |
| M2 `45→46` | No coincide: RED lógico |
| M3 `e2e:20` + `otro job:45` | No coincide dentro del job `e2e`: RED lógico |
| M4 `--workers=1→--workers=2` | Se detecta la pérdida de serialización |
| M5 agregar `continue-on-error: true` | Se detecta la desactivación del gate |

**Harness completo reproducible desde un checkout de ese SHA**, sin dependencias externas ni cambios en disco:

```bash
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yaml = readFileSync('.github/workflows/e2e-staging.yml', 'utf8');
const tests = readFileSync('.github/workflows/verify-workflows.test.mjs', 'utf8');
function job(yaml, name) {
  const normalized = yaml.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, 'job no encontrado');
  const next = normalized.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? normalized.slice(start) : normalized.slice(start, start + next + 1);
}
const testTimeout = (x) => /^\s+timeout-minutes: 45$/m.test(job(x, 'e2e'));
const testWorkers = (x) => /--workers=1/.test(job(x, 'e2e'));
const testContinue = (x) => /continue-on-error/.test(job(x, 'e2e'));
assert.match(tests, /\^\\s\+timeout-minutes: 45\$/);
assert.equal(testTimeout(yaml), true, 'M0 GREEN');
assert.equal(testTimeout(yaml.replace('timeout-minutes: 45', 'timeout-minutes: 44')), false, 'M1 RED');
assert.equal(testTimeout(yaml.replace('timeout-minutes: 45', 'timeout-minutes: 46')), false, 'M2 RED');
assert.equal(testTimeout(yaml.replace('timeout-minutes: 45', 'timeout-minutes: 20') +
  '\n  fake_other_job:\n    timeout-minutes: 45\n'), false, 'M3 RED');
assert.equal(testWorkers(yaml), true, 'workers original');
assert.equal(testWorkers(yaml.replace('--workers=1', '--workers=2')), false, 'M4 RED');
assert.equal(testContinue(yaml), false, 'sin continue original');
assert.equal(testContinue(yaml.replace('timeout-minutes: 45',
  'timeout-minutes: 45\n    continue-on-error: true')), true, 'M5 RED');
console.log('M0 GREEN; mutantes M1–M5 detectados');
NODE
```

**Límite:** esta sonda comprueba las propiedades estructurales de la fuente y complementa al CI real. No demuestra por sí sola el resultado de E2E Preview ni reproduce el harness GREEN→RED→GREEN completo del autor.
