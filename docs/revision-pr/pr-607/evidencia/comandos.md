# Evidencia reproducible — PR607 R01

**SHA bajo revisión:** `e5ca27ad40400283993752ac93d833912753ce95`. **Contexto real de esta revisión:** consulta GitHub conectada y comparación `develop...head`, sin checkout ejecutable: `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` respondió `Could not resolve host: github.com`. `pnpm` no está disponible en este contenedor. En consecuencia **no se atribuye aquí ningún verde o rojo Vitest**.

## Comprobaciones de lectura realizadas

- `develop...` = 1 commit adelante y 0 atrás; 16 archivos, +1101/-115.
- Ficha del DoD leída desde `develop`, contrastada con la nota adicional del head.
- Revisados completos los parches de código, tests y E2E; `docs/tasks/log/T-404.md`; comentarios del PR (sin review humano al revisar).
- `queries.ts` aplica `.limit(50)` para auditorías; `buildApplicantHistory` aplica `.slice(-50)` después de agregar dos hitos. H01 resulta por inspección.
- `applicant-history.tsx` usa `buildAuditHref({targetType:'courier'})`; `getAuditLog` usa `.eq('target_type', 'courier')`. H02 resulta por inspección.

## Preparación para reproducir (sin ejecutar en esta sesión)

```bash
git fetch origin
git status --short
git worktree add /tmp/pr607-r01-wt e5ca27ad40400283993752ac93d833912753ce95
cd /tmp/pr607-r01-wt
pnpm install --frozen-lockfile
pnpm exec vitest run src/features/admin/queries.test.ts src/features/admin/components/applicant-history.test.tsx src/features/admin/components/audit-log-table.test.tsx src/features/admin/schemas.test.ts > /tmp/pr607-base.log 2>&1
grep -E '(Test Files|Tests|FAIL|PASS)' /tmp/pr607-base.log | tail -20
# Los comandos no se ejecutaron desde este contenedor: NO son evidencia de PASS.
```

### Harness completo para mutaciones independientes en /tmp

Crear el archivo siguiente fuera del repo, por ejemplo `/tmp/pr607-r01-harness.mjs`. **No se ha ejecutado aquí**. Diseñado para mostrar la ceguera de los controles actuales sin modificar los tests; trabaja con el SHA previo al arreglo y restaura contenido original mediante `finally`, no con git checkout. Se ejecuta sobre un worktree *desechable*, sin servicios remotos. El harness registra resultados reales en `/tmp/pr607-harness-*.log`. No confundir un rojo por Error de setup con detección de la propiedad.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(process.argv[2] ?? process.cwd());
const files = [
  'src/features/admin/queries.test.ts',
  'src/features/admin/components/applicant-history.test.tsx',
  'src/features/admin/components/audit-log-table.test.tsx',
  'src/features/admin/schemas.test.ts',
];
const command = ['exec', 'vitest', 'run', ...files];
function run(label) {
  const p = spawnSync('pnpm', command, {
    cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  });
  const output = String(p.stdout ?? '') + String(p.stderr ?? '');
  const lines = output.split('\n').filter(s => /Test Files|Tests |FAIL|Error|No test files/.test(s));
  writeFileSync(join('/tmp', `pr607-harness-${label}.log`), output, 'utf8');
  console.log(label, 'exit=', p.status, 'summaries=', lines.slice(-12).join(' | '));
  if (p.error) throw p.error;
  assert.notEqual(p.status, null, `proceso inconcluso en ${label}`);
  return p.status;
}
function mutate(name, path, search, replacement) {
  const file = join(root, path);
  const original = readFileSync(file, 'utf8');
  const count = original.split(search).length - 1;
  assert.equal(count, 1, `objetivo ${name} ambiguo/no existe: ${count}`);
  let code;
  try {
    writeFileSync(file, original.replace(search, replacement), 'utf8');
    code = run(name);
  } finally {
    writeFileSync(file, original, 'utf8');
    assert.equal(readFileSync(file, 'utf8'), original);
  }
  return code;
}
assert.equal(run('baseline'), 0, 'control original no da verde: no interpretar mutaciones');
const h01 = mutate(
  'H01-sin-slice',
  'src/features/admin/queries.ts',
  'return events.slice(-APPLICANT_HISTORY_LIMIT);',
  'return events;'
);
// Sobre HEAD original, ausencia de test de >50 hace esperable GREEN: demuestra
// falta de cobertura, NO que la nueva implementación sea correcta.
console.log('H01 mutant result:', h01 === 0 ? 'BLIND SPOT (GREEN)' : 'RED: investigar la aserción causal');
const h02 = mutate(
  'H02-link-a-documentos',
  'src/features/admin/components/applicant-history.tsx',
  "buildAuditHref({ targetType: 'courier' })",
  "buildAuditHref({ targetType: 'courier_document' })"
);
// Este rojo, si sucede, solo valida que el test fija el URL erróneo; no valida
// el nuevo ?courier=uuid. Un GREEN tampoco equivale a cobertura válida.
console.log('H02 mutant result:', h02 === 0 ? 'GREEN: test no distingue entidad' : 'RED: comprobar causa');
assert.equal(run('restored'), 0, 'el control no volvió a verde tras restaurar');
```

**Correr:**

```bash
node /tmp/pr607-r01-harness.mjs /tmp/pr607-r01-wt
# NO ejecutar sobre un checkout con cambios no guardados.
```

**Contrapruebas necesarias para el próximo SHA:** test que **ya falla en este HEAD** con 50 auditRows + 2 hitos; y test que sigue la ruta de «Ver todo» hasta el conjunto courier+documentos. Tras corregir, mutar el nuevo `return` de historial para reintroducir `.slice(-50)`; quitar rama de documentos del OR; quitar `courier` de `buildAuditHref`; quitar `courier` del link siguiente. Cada mutación debe producir RED causal y restaurarse; el harness anterior **no puede dar por validada una implementación futura** de forma automática.

## Verificación de la carpeta y CI

```bash
node docs/revision-pr/analizar.mjs verificacion
# Tras arreglo y sin bloqueantes, inspeccionar CI del SHA exacto y sus logs
# (unit summary Vitest, e2e-preview y db-tests si procede).
```

**En esta sesión:** `analizar.mjs`, TypeScript/lint/Vitest y E2E **NO EJECUTADOS**. No se inicia Supabase, Docker, Vercel ni workflows.

---

## R02 — 2026-11-04 — SHA `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`

**Método realmente ejecutado:** inspección de diff y archivos en GitHub, consulta de CI por SHA y lectura de logs de jobs completados. No hay `git clone` ni `pnpm` local: `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` respondió `Could not resolve host: github.com`, `pnpm` no está disponible. **Ninguna mutación del autor ni independiente se ejecutó aquí**: no adjudicar a la revisión sus RED declarados en bitácora.

**Diff entre commits:** `7cc21d3901eeeffecbe80747a8e7ac58aa1f5ffc..1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`: ahead 1, behind 0; 14 archivos, `docs/revision-pr/**` sin cambios. En `develop..1d4fcc2`: ahead 3, behind 0; PR mergeable=true. Los cambios de código de la R02 están en los archivos permitidos tras ampliar la ficha.

**Inspección técnica:**
- `src/features/admin/queries.ts:buildApplicantHistory`: nuevo `return events` sin `slice(-50)`, empates estable por hito/id; `getApplicantAuditRows` todavía aplica límite 50 **antes** de sumar hitos. Tests con 0/49/50 filas en `queries.test.ts`, evento `submitted_at` condicional y empates.
- `queries.ts:applicantAuditFilter`: filtro `and(target_type.eq.courier,target_id.eq.UUID),and(target_type.eq.courier_document,or(after->>courier_id.eq.UUID,before->>courier_id.eq.UUID,target_id.in.(IDs)))`, compartido entre detalle y auditoría. `getAuditLog` añade `query.or(...)` antes de `.limit(pageSize + 1)`, con RLS de sesión y propagación de errores de consulta de IDs. `schemas.ts` valida UUID; `buildAuditHref` y formulario lo conservan.
- `docs/tasks/T-404.md` y PR recogen D01-C/issue #609, D02-C/D03-C; la bitácora agrega nueva entrada. El E2E agregado navega desde historial a auditoría y verifica **solo** decisión real tipo `courier`; falta E2E documentales/página 2 (observación de cobertura, no fracaso probado).
- `supabase/config.toml` declara `max_rows=1000`; lectura de todos los IDs de `courier_documents` sin keyset podría truncar lista con cardinalidad >1000. Esto es riesgo de escala, no defecto reproducido en la muestra actual.

**Comprobación de CI del SHA exacto:**
- [CI run 41947713873](https://github.com/cadeApp/cadeApp/actions/runs/41947713873), `head_sha=1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`: `typecheck` SUCCESS; `lint` SUCCESS; `build` SUCCESS; `audit` SUCCESS; `bundle-budget` SUCCESS con warning; `unit` SUCCESS (job 126983938716, línea de Vitest: `Test Files 193 passed (193)`; `Tests 3568 passed (3568)`). `db-tests` seguía in_progress al último sondeo.
- `bundle-budget` (job 126984541606) imprime `/admin/applicants/[id] | 267 kB | Supera el límite` y `/admin/audit | 267 kB | Supera el límite` frente a 180 kB. Son los mismos números del run 41945987698 (SHA 7cc21d39) y del run 41943217874 (e5ca27ad). **Advertencia previa, sin aumento medible en R02.**
- `approval-policy` (runs 41947711800 y 41947745115) falla diciendo `Falta el informe completo de revisar-pr sin bloqueantes.`. Es el gate de revisión todavía sin informe de R02, no una falla del código ni de la suite.
- [e2e-preview run 41947878934](https://github.com/cadeApp/cadeApp/actions/runs/41947878934): workflow se dispara en `develop` (head del workflow = base `7d07fdf8`), pero `resolve-preview` SUCCESS matchea PR #607 por SHA, y el job `e2e-preview` hace checkout de `needs.resolve.outputs.sha`; `e2e-preview` sigue in_progress. Commit status `e2e-preview=pending` en el SHA bajo examen. **No afirmar E2E verde por inferencia.**

**Qué falta para concluir aceptación:** leer log Playwright final y los resúmenes de `db-tests` si CI los publica, confirmar SHA/status `e2e-preview=success` y re-verificar que no se introduzcan bloques. En este entorno no se disparó manualmente ningún workflow, ni Docker/Supabase, ni cambios remotos fuera de la carpeta exclusiva de revisión.

**Batería de mutaciones propia propuesta (NO EJECUTADA):**
- P1: en `buildApplicantHistory`, cambiar temporalmente `return events;` por `return events.slice(-50);` sobre un worktree desechable en `/tmp`. El test 50+2 debe rojo causal.
- P2: en `applicantAuditFilter`, sustituir solo `target_type.eq.courier_document` por `target_type.eq.merchant`; tests del filtro deben rojo causal; restaurar.
- P3: en `getAuditLog`, simular `courier_documents` con ≥2 IDs reales en mock y mutar lectura a `.limit(1)`; el control actual no demuestra que detectaría ese defecto: no afirmar RED sin ejecutarlo.
- P4: quitar `if (filters.courierId) params.set('courier', filters.courierId)` de `buildAuditHref`; los tests de paginación deben rojo causal.
- P5: quitar `<input type="hidden" name="courier" ... />` del formulario; el test de persistencia debe rojo.
En todos: baseline GREEN, mutación temporal con guardias de coincidencia exacta, RED y restaurar desde memoria, baseline GREEN final; logs bajo `/tmp`. El harness completo de R01 sigue en la sección anterior, pero no se presenta como ejecutado en R02.
