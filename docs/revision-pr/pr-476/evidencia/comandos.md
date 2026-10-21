# Evidencia y comandos reproducibles — PR #476 / T-389

**SHA revisado:** `2fe4935d233a0ade030f8adc1072304571e9a5d2`  
**Base:** `214404e0a2baca7ba7e4c87c35ef78c3de3d2109`.

## Comprobaciones efectuadas por el revisor

1. Conector GitHub: `get_pr_info`, `list_pr_changed_filenames`, `fetch_pr_patch`, `fetch_pr_file`, comentarios y threads. Lista exacta: 11 rutas, todas dentro de archivos permitidos de T-389.
2. Referencias remotas: `develop = 214404e0...` y `feat/T-389-trip-report-eta = 2fe4935...` al inspeccionar. GitHub: `mergeable=true` (sin equivalente local de `merge-tree`).
3. Logs de `unit` job 119361579242: `Test Files 155 passed (155)`, `Tests 3158 passed (3158)`; `typecheck/lint/build/audit/bundle-budget` success.
4. `e2e-preview`: run https://github.com/cadeApp/cadeApp/actions/runs/39640417342, job 119362253785: `Run preview E2E gate` comenzó `pnpm exec playwright test --project=chromium --workers=1` y fue **cancelled**; commit status publicado `error`. No se observó un test de T-389 en rojo.
5. `db-tests`: `in_progress` en el último acceso. No declarar verde sin log final.
6. Prueba de acceso a repositorio desde contenedor: `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` -> `fatal: ... Could not resolve host: github.com`. Por ello NO se corrieron tests locales ni mutaciones propias.

## Batería propia propuesta, NO ejecutada (RED→GREEN)

Este harness usa el árbol local a partir del SHA, corre primero GREEN, muta **solo producción**, exige RED y restaura el contenido original **guardado en memoria**, incluso si falla. No hace checkout, push ni modifica tests; no requiere Supabase ni Docker. Está escrito para poder copiarlo entero a `/tmp/review-476-mutations.cjs` desde cualquier clon limpio en el commit auditado.

**Ejecución:** desde la raíz de un worktree limpio del SHA revisado, `node /tmp/review-476-mutations.cjs`. No usar sobre un árbol con trabajo sin commitear. Ningún resultado de este script se considera verificado en esta ronda.

```javascript
'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');

const expectedHead = '2fe4935d233a0ade030f8adc1072304571e9a5d2';
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== expectedHead) throw new Error('HEAD distinto al SHA revisado: ' + head);
const dirty = cp.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('Árbol no limpio; evitar sobreescribir cambios locales');

const cases = [
  {
    id: 'M-revisor-1: slot real no renderizado',
    file: 'src/features/trips/components/trip-courier-view.tsx',
    before: '{incidentAction ? <div>{incidentAction}</div> : null}',
    after: '{incidentAction ? <div /> : null}',
    test: 'src/features/trips/components.test.tsx',
  },
  {
    id: 'M-revisor-2: quitar reserva de barra fija',
    file: 'src/features/trips/components/trip-courier-view.tsx',
    before: 'mx-auto max-w-[390px] space-y-4 p-4 pb-32',
    after: 'mx-auto max-w-[390px] space-y-4 p-4',
    test: 'src/features/trips/components.test.tsx',
  },
  {
    id: 'M-revisor-3: ghost pierde altura mínima',
    file: 'src/features/incidents/components/report-incident-button.tsx',
    before: "variant === 'ghost' && 'min-h-12 text-muted-foreground hover:text-destructive'",
    after: "variant === 'ghost' && 'text-muted-foreground hover:text-destructive'",
    test: 'src/features/incidents/components/report-incident-button.test.tsx',
  },
  {
    id: 'M-revisor-4: ETA cambia pero payload queda desplazado',
    file: 'src/features/offers/components/offer-sheet.tsx',
    before: 'onChange={(e) => setEtaMinutes(Number(e.target.value))}',
    after: 'onChange={(e) => setEtaMinutes(Number(e.target.value) + 1)}',
    test: 'src/features/offers/components/feed-vocabulary.test.tsx',
  },
];
function run(test) {
  const r = cp.spawnSync('pnpm', ['exec', 'vitest', 'run', test], { encoding: 'utf8', timeout: 120000 });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const summary = out.split('\n').filter(line => /Test Files|Tests |Failed Tests|FAIL |PASS /.test(line)).slice(-8);
  console.log(summary.join('\n'));
  if (r.error) throw r.error;
  return r.status === 0;
}
for (const m of cases) {
  console.log('\n### ' + m.id);
  const original = fs.readFileSync(m.file, 'utf8');
  if (original.split(m.before).length !== 2) throw new Error('Objetivo ausente o duplicado: ' + m.id);
  if (!run(m.test)) throw new Error('El control BASE no pasa: ' + m.id);
  let red = false;
  try {
    fs.writeFileSync(m.file, original.replace(m.before, m.after));
    red = !run(m.test);
  } finally {
    fs.writeFileSync(m.file, original);
  }
  if (!red) throw new Error('La MUTACIÓN pasó en verde: ' + m.id);
  if (!run(m.test)) throw new Error('No volvió a verde tras restauración: ' + m.id);
  console.log('GREEN -> RED -> GREEN correcto');
}
const after = cp.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (after) throw new Error('La batería dejó un árbol sucio');
console.log('Batería finalizada con árbol limpio');
```

## Comandos finales para el ejecutor con clon

```bash
git fetch origin
git worktree add /tmp/review-476-sha 2fe4935d233a0ade030f8adc1072304571e9a5d2
cd /tmp/review-476-sha
# Copiar el bloque JavaScript anterior a /tmp/review-476-mutations.cjs
node /tmp/review-476-mutations.cjs
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

**No afirmar GREEN→RED→GREEN hasta correrlos y guardar sus resultados en una ronda nueva.** Un resultado sintáctico o «sin objetivo» nunca prueba la cobertura. Para el E2E, solo vale el log del job real de Preview asociado al SHA.

## Ronda 2 — Evidencia de la revisión remota (2026-10-21)

**HEAD del autor:** `0dd703d81b27eda5ccddf50fd4afda69584bf36f` — único archivo cambiado desde el HEAD de ronda 1: `docs/tasks/log/T-389.md` (+24 líneas, registro append-only). **Sin nuevos comandos locales ni mutaciones independientes ejecutadas.**

1. **Fuente de declaración local del autor:** `docs/tasks/log/T-389.md`, último encabezado. Dice `CI=true`, 2 reintentos, `7 passed / 1 flaky / 1 failed` en `main-flow.spec.ts`, y `Flujo 5` en verde. No hay log completo de Playwright asociado a ese comando; no representarlo como comprobación de la revisión.
2. **Test de T-389:** fuente del `main-flow.spec.ts` en HEAD: `const reportButton = ...`, `cancelBox, reportBox`, `expect(reportBox.y).toBeGreaterThan(cancelBox.y)`, `document.elementFromPoint(...)`, `expect(reportOnTop).toBe(true)`; está dentro de `Flujo 5`. Este control **sí apunta al comportamiento real**; el test se ejecutó según el autor, no por el revisor.
3. **T-360:** bitácora refiere timeout en `e2e/pages/login.page.ts` antes de visitar la vista de viaje, mientras el archivo muestra la espera `expect.poll(...)` hasta salir de `/login`. Esto permite separar el sitio del fallo, no confirmar el motivo.
4. **Workflow oficial del nuevo HEAD:** [39667810822](https://github.com/cadeApp/cadeApp/actions/runs/39667810822), `e2e-preview: cancelled` durante Playwright; status `e2e-preview=error`. Una corrida paralela con job `skipped` y workflow `success` no sirve como prueba.
5. **CI GitHub Actions en HEAD de autor:** `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` `success`. `approval-policy=failure` por informe todavía con bloqueo.
6. **Registro de seguimiento QA:** https://github.com/cadeApp/cadeApp/issues/479.
7. **Documentación:** `hallazgos.jsonl` mantiene `verificado_en_sha: null`, estado `parcial`, ya que no se puede confundir la afirmación de ejecución local con verificación independiente.

### Comandos de inspección reproducibles (si se tiene `gh` autorizado)

```bash
# Solo lectura: no disparar workflows.
gh api repos/cadeApp/cadeApp/compare/6a52d8fd805ddd70dc9c9b92aa9194bb00eaa54e...0dd703d81b27eda5ccddf50fd4afda69584bf36f \
  --jq '.files[] | [.filename, .status, (.changes|tostring)] | @tsv'
gh api repos/cadeApp/cadeApp/commits/0dd703d81b27eda5ccddf50fd4afda69584bf36f/check-runs \
  --jq '.check_runs[] | [.name, .status, (.conclusion // "pending")] | @tsv'
gh api repos/cadeApp/cadeApp/commits/0dd703d81b27eda5ccddf50fd4afda69584bf36f/status \
  --jq '.statuses[] | [.context, .state, .target_url] | @tsv'
gh run view 39667810822 --repo cadeApp/cadeApp
# Si el run ofrece logs, inspeccionar SOLO el tramo pertinente; no pegar secretos ni fixtures en bitácora.
```

**Resultado de ejecución de los comandos reproducibles:** no ejecutados mediante CLI local; el revisor consultó el equivalente de solo lectura mediante conector GitHub. No simular resultados RED, GREEN ni merge-tree.
