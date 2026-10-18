# Evidencia — PR #416, ronda 2

**SHA revisado:** `789284d50ca3393f5aec7de6c2be91bfa31d1bbc`. Verificaciones independientes por lectura directa de GitHub, no ejecución local de pnpm o Playwright.

## Comprobación de DoD y control negativo

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const task = fs.readFileSync('docs/tasks/T-372.md','utf8');
const plan = fs.readFileSync('docs/implementation-plan.md','utf8');
const row = plan.split('\n').find(x=>/^\|\s*T-372\s*\|/.test(x));
assert.ok(row);
const expected = row.split('|').map(x=>x.trim())[6];
const match = task.match(/## DoD\n([\s\S]*?)(?:\n## |$)/);
assert.ok(match);
const first = match[1].match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim();
assert.equal(first, expected);
const mutant = task.replace(first, 'dummy');
const mutatedFirst = mutant.match(/## DoD\n([\s\S]*?)(?:\n## |$)/)?.[1]?.match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim();
assert.notEqual(mutatedFirst, expected);
console.log('DoD T-372 GREEN; mutant de igualdad detectado');
```

El equivalente fue ejecutado por el revisor sobre las fuentes descargadas del SHA, con resultados igualdad=TRUE y mutante=FALSE; no se modificó el repositorio.

## Ejecuciones GitHub Actions

- **RED anterior real**: [run 39099606622 / unit 117592990643](https://github.com/cadeApp/cadeApp/actions/runs/39099606622/job/117592990643) — 1 FAIL, `Desincronizadas: T-372`.
- **GREEN SHA revisado**: [run 39100808635 / unit 117596510267](https://github.com/cadeApp/cadeApp/actions/runs/39100808635/job/117596510267) — verify-fichas 7/7 PASS, unit 2765/2765 PASS; resto del CI (db-tests, typecheck, lint, build, audit, bundle-budget) SUCCESS.
- **E2E de código idéntico**: [39098068311](https://github.com/cadeApp/cadeApp/actions/runs/39098068311) — 87 Chromium + 3 global-settings T-306 PASS sobre `b6396784`.
- **Nuevo E2E**: [39100878945](https://github.com/cadeApp/cadeApp/actions/runs/39100878945) — estaba EN PROGRESO al último chequeo, NO dar por verde.
- No se ejecutó `pnpm`, Docker ni Supabase local; la verificación ejecutada independientemente fue solo el oráculo de igualdad textual.
