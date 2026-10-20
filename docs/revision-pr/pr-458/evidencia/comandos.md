# Evidencia y comandos · PR #458 / T-380 · Ronda 1

## Entorno / trazabilidad

- SHA inspeccionado: `961d6ea6555f42193fec806d2d216adbee2c6893`.
- Base: `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`.
- `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` en el contenedor de revisión: `fatal: ... Could not resolve host: github.com`. No hay clon en el contenedor.
- Conector GitHub: leído diff, fichas, contrato, bitácora, contenido de test y logs CI.
- **No se corrieron mutaciones propias de Vitest.** La evidencia runtime corresponde a GitHub Actions y está etiquetada como tal. No se afirma que un harness no ejecutado haya pasado.

## Fuente de CI ajena

- CI `39436669439`, SHA `11f626b52362692f3e6734784158d98f6b9ac0ff`: `unit` → `151 passed (151)` archivos y `2964 passed (2964)` tests.
- `db-tests` → `Files=33, Tests=2959, Result: PASS`; hubo FAIL controlados para pruebas de mutación de otras tareas, restaurados antes del resultado final.
- `e2e-preview` `39436812843`: `admin-courier-reinstate.spec.ts:80:7` → PASS `(44.8s)`; global `92 passed` y `6 passed`.
- `bundle-budget` → success con advertencias de rutas que superan 180 kB; `/admin/applicants/[id] = 248 kB`. No hay contraste cuantitativo contra base, por eso no se atribuye a esta PR.
- La diferencia `11f626b5..961d6ea` modifica solo `docs/tasks/log/T-380.md`.

## H01: control estructural reproducible, sin mutar el árbol

Copiá el siguiente script **completo** a `/tmp/pr458-h01-check.cjs` desde un checkout limpio del SHA a revisar. El script se ejecuta desde la raíz del repo, lee el test real y falla si hay un temporizador arbitrario en el caso de doble envío. Es un control **estático**, no sustituye el test runtime de mutación.

```bash
cat > /tmp/pr458-h01-check.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const filename = path.join(process.cwd(), 'src/features/admin/components/applicant-detail-view.test.tsx');
const source = fs.readFileSync(filename, 'utf8');
const start = source.indexOf("it('dos envíos seguidos del formulario");
const end = source.indexOf("it('idempotent: true", start);
if (start < 0 || end <= start) {
  console.error('FAIL: no se encontró el caso de doble envío esperado');
  process.exitCode = 1;
} else {
  const block = source.slice(start, end);
  if (/\bsetTimeout\s*\(/.test(block) || /\bwaitForTimeout\s*\(/.test(block)) {
    console.error('FAIL: test de doble envío contiene sleep fijo');
    process.exitCode = 1;
  } else {
    console.log('PASS: test de doble envío sin sleep fijo (solo control estático)');
  }
}
NODE
node /tmp/pr458-h01-check.cjs
```

**Resultado esperado en SHA revisado:** FAIL por `setTimeout(resolve, 50)`. Este script fue preparado a partir de la inspección; **no se ejecutó** en este entorno. Luego de reemplazar el sleep, debe pasar.

### Prueba funcional indispensable para el autor

```bash
pnpm exec vitest run src/features/admin/components/applicant-detail-view.test.tsx
pnpm exec vitest run src/features/admin/actions.test.ts
```

Para el RED de H01, aplicar una mutación **temporal** que retire únicamente la condición `decisionInFlight.current` de `onDecisionSubmit` en `applicant-detail-view.tsx` manteniendo los mocks, y comprobar que el test falla **porque la acción se llamó dos veces**. Restaurar contenido original de memoria mediante el harness temporal; no usar `git checkout`, ni falsear aserciones. Guardar salida real de Vitest en bitácora y confirmar GREEN con archivos originales.

## H02: reproducción pendiente del autor

No se dispone del scratchpad citado en la bitácora para M1–M8. Para cada mutación falta el diff/reemplazo exacto, comando, salida `Test Files` y `Tests` en RED/GREEN. Es un bloqueante de evidencia, **no** se han inventado ni replicado resultados. Los comandos se conservan en `/tmp` y su salida se pega en `docs/tasks/log/T-380.md`. Solo se considera válida la propiedad realmente rota; un RED por error de import, mock o harness no verifica el invariante.

## Chequeo final por el autor

```bash
pnpm typecheck && pnpm lint && pnpm test
git diff --check
git status --short
git ls-remote origin feat/T-380-admin-reinstate-courier
```

No exigir nueva ejecución de CI exclusivamente por editar `docs/tasks/log/T-380.md`; si cambia la prueba de H01, ejecutar las comprobaciones reales de esa modificación.
