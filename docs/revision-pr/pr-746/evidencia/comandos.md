# Evidencia y comandos reproducibles — PR #746 / T-437

SHA revisado: `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152`. Base: `1a231dfa00ad35fd1e51c0079925767d9dc15f5e`.

## Evidencia observada (GitHub)

- [Aprobación 43532734795](https://github.com/cadeApp/cadeApp/actions/runs/43532734795), job `132254179912`: `getByText(...) resolved to 2 elements`; control 1 failed por strict mode; el mutante falla en `toBeDisabled` pero clasifica `CONTROL_NOT_GREEN`.
- [Reactivación 43532735200](https://github.com/cadeApp/cadeApp/actions/runs/43532735200), job `132254180640`: control `1 passed (33.0s)`; mutante `1 failed`, `Expected: disabled`, `Received: enabled`; `RED_CONFIRMED`.
- [Reconsideración 43532737982](https://github.com/cadeApp/cadeApp/actions/runs/43532737982), intento 2, job `132258451468`: control `1 passed (28.8s)`; mutante `1 failed`, `Expected: disabled`, `Received: enabled`; `RED_CONFIRMED`.
- [CI de la PR 43534547830](https://github.com/cadeApp/cadeApp/actions/runs/43534547830): jobs generales mencionados en la ronda. No ejecutan el control de mutación post-merge.

## Arnés estructural propio — completo, ejecutable con Node y Git

Requiere un clon limpio de la PR (o de su commit de revisión, donde los archivos de código no cambian), con el commit base accesible. Se puede guardar el bloque siguiente como `/tmp/pr746-structural.sh` y ejecutar `bash /tmp/pr746-structural.sh /ruta/al/clon`. **No lee `.env*`, no modifica el repo, no se conecta a servicios.**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "${1:-$PWD}"
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = '1a231dfa00ad35fd1e51c0079925767d9dc15f5e';
const source = readFileSync('e2e/specs/courier-onboarding.spec.ts', 'utf8');
const old = execFileSync('git', ['show', base + ':e2e/specs/courier-onboarding.spec.ts'], {encoding:'utf8'});
const title = 'T-437 (CC-052) bypass: con la selfie sin verificar «Aprobar repartidor» está deshabilitado y la RPC lo rechaza';
function block(text) {
  const start = text.indexOf("test('" + title + "'");
  const stop = text.indexOf("test('T-437 (CC-052) subsanación", start);
  assert.ok(start >= 0 && stop > start, 'el test literal no existe');
  return text.slice(start, stop);
}
function control(text) {
  assert.ok(text.includes("const toolbar = page.getByRole('toolbar', { name: ADMIN_COPY.detail.actionsBarLabel })"), 'toolbar ausente');
  assert.ok(text.includes('toolbar.getByText(ADMIN_COPY.detail.requiredDocumentsPending)'), 'motivo fuera de toolbar');
  assert.ok(text.includes("toolbar.getByRole('button', { name: ADMIN_COPY.detail.applicantActions.approve })"), 'botón fuera de toolbar');
  assert.ok(text.includes("'T-437: «Aprobar repartidor» deshabilitado con la selfie sin verificar'"), 'mensaje del matcher cambiado');
  assert.ok(text.includes(').toBeDisabled()'), 'oráculo disabled perdido');
  assert.ok(text.includes("error?.message).toContain('DOCUMENTS_NOT_VERIFIED')"), 'RPC guard perdida');
  assert.ok(text.includes('expect(count).toBe(0)'), 'auditoría no verificada');
}
const now = block(source);
assert.throws(() => control(block(old)), /toolbar ausente/, 'base debió ser negativa');
control(now);
const changes = [
  ['selector_motivo_global', now.replace('toolbar.getByText(ADMIN_COPY.detail.requiredDocumentsPending)', 'page.getByText(ADMIN_COPY.detail.requiredDocumentsPending)')],
  ['selector_boton_global', now.replace("toolbar.getByRole('button', { name: ADMIN_COPY.detail.applicantActions.approve })", "page.getByRole('button', { name: ADMIN_COPY.detail.applicantActions.approve })")],
  ['sin_disabled', now.replace(').toBeDisabled();', ').toBeEnabled();')],
];
for (const [name, changed] of changes) {
  assert.notEqual(changed, now, `${name}: mutación sin objetivo`);
  assert.throws(() => control(changed), undefined, `${name}: el control no entró en rojo`);
  console.log(`RED estructural: ${name}`);
}
for (const path of ['e2e/mutations/manifest.json', 'e2e/mutations/t437-ui-approve-guard.patch']) {
  const current = readFileSync(path, 'utf8');
  const original = execFileSync('git', ['show', base + ':' + path], {encoding:'utf8'});
  assert.equal(current, original, `${path} cambió`);
}
console.log('PASS estructural: selectores, matcher, RPC/auditoría, manifest y patch');
JS
```

**Resultado de inspección equivalente en esta ronda con archivos obtenidos por el conector GitHub:** HEAD 6/6 propiedades presentes; base sin toolbar acotado; tres perturbaciones de texto detectadas; manifest y patch idénticos. **No afirmamos haber ejecutado este shell en un clon:** la sesión no tiene acceso de red a GitHub para clonarlo. Tampoco interpretamos este arnés como una prueba Playwright ni como RED funcional.

## Prueba funcional obligatoria después del merge

El workflow `.github/workflows/e2e-mutation.yml` escucha únicamente `repository_dispatch` de tipo `e2e.mutation.requested`, y `client_payload` de forma exacta:

```json
{ "target": "develop", "mutation": "t437-ui-approve-guard" }
```

Debe correrse **solo cuando `develop` contenga el merge** de esta PR (la ejecución apunta al HEAD de develop, no al SHA `3da9a12e` de la rama). No se disparó desde esta revisión: las reglas operativas prohíben disparos manuales de workflows.

Resultado exigido en el job: control `1 passed`, patch aplicado y mutante `1 failed` por `toBeDisabled`, con matcher `T-437: «Aprobar repartidor» deshabilitado con la selfie sin verificar`, clasificación `RED_CONFIRMED`. Si aparece `CONTROL_NOT_GREEN`, timeout, error de build o de red, no cuenta como RED. Guardar run, SHA, clasificador y las líneas `1 passed / 1 failed` en la bitácora.

## Comandos opcionales con clon limpio, sin secretos

```bash
git fetch origin
git rev-parse origin/develop
git log -1 --format='%H' feat/T-437-e2e-reason-locator
git diff 1a231dfa00ad35fd1e51c0079925767d9dc15f5e..3da9a12ebd9780d2a0a3cf64fdf76d4af854d152 --name-only
git diff 1a231dfa00ad35fd1e51c0079925767d9dc15f5e..3da9a12ebd9780d2a0a3cf64fdf76d4af854d152 -- e2e/specs/courier-onboarding.spec.ts docs/tasks/log/T-437.md
node docs/revision-pr/analizar.mjs verificacion
```

No se corrieron `pnpm typecheck`, `pnpm lint`, `pnpm test`, Playwright ni `test:db` localmente. GitHub Actions sobre `3da9a12e` se consultó por jobs y logs; se diferencia de ejecución propia.
