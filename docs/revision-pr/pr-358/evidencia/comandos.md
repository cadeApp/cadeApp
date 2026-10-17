# Evidencia y comandos completos — PR #358 / Ronda 1

**SHA revisado:** `d0cf083dbb42beacc1f0bba4e4d5a4b1fce78408` (Draft documental) · **Base:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`. Lecturas remotas GitHub de rutas en develop, diff de PR, comentarios y ficha. **No se corrieron suites pnpm, tests DB ni E2E; no hay clon de Git en este contenedor.** Los 7 predicados de la lectura estática resultaron OBSERVADO en la sesión (no son GREEN funcional).

## Comprobación estática reproducible desde un checkout de develop

Este harness usa solo Node builtin y no escribe en el repositorio. Guardalo completo y ejecutalo desde la raíz del checkout; copiarlo a /tmp funciona porque usa process.cwd(), no __dirname:

```bash
cat >/tmp/pr358-inspect.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rls = read('supabase/migrations/20260922051650_rls_v1.sql');
const schema = read('supabase/migrations/20260922031435_schema_v1.sql');
const adminRpc = read('supabase/migrations/20260924013700_rpc_admin_v1.sql');
const profile = read('src/app/(courier)/courier/profile/page.tsx');
const adminQuery = read('src/features/admin/queries.ts');
const policy = rls.match(/create policy courier_documents_insert_self[\s\S]*?;/i)?.[0];
const table = schema.match(/create table public\.courier_documents\s*\([\s\S]*?\n\);/i)?.[0];
assert.ok(policy, 'Existe policy de INSERT');
assert.ok(table, 'Existe tabla courier_documents');
assert.match(policy, /courier_id\s*=\s*auth\.uid\(\)/);
assert.match(policy, /status\s*=\s*'submitted'/);
assert.doesNotMatch(policy, /\brejected\b|is_current|current_document|latest_document/i);
assert.doesNotMatch(table, /\bis_current\b|superseded|current_document/i);
assert.doesNotMatch(table, /unique\s*\(\s*courier_id\s*,\s*kind\s*\)/i);
assert.match(profile, /select\('kind, status'\)\.eq\('courier_id', user\.id\)/);
assert.match(profile, /docs\.find\(/);
assert.match(adminQuery, /\.order\('uploaded_at',\s*\{\s*ascending:\s*true\s*\}\)/);
assert.match(adminRpc, /jsonb_build_object\('status', v_target_status, 'reason', p_reason/);
console.log('PASS 7 observaciones estaticas: INSERT sin guardia rejected, version sin current, lectores ambiguos, motivo en audit.');
// SENSIBILIDAD DEL INSTRUMENTO, SOLO EN MEMORIA: NO es prueba RED de funcionalidad.
// Si apareciera una guarda literal rejected, este detector del contrato viejo debe fallar.
const mutado = policy.replace("and status = 'submitted'", "and status = 'submitted' and previous_status = 'rejected'");
assert.notEqual(mutado, policy, 'mutacion objetivo existe');
assert.throws(() => assert.doesNotMatch(mutado, /\brejected\b/));
console.log('PASS sensibilidad: mutacion sintetica detectada en memoria; sin modificaciones de archivos.');
NODE
node /tmp/pr358-inspect.cjs
```

**Registro de esta revisión vía GitHub:** siete predicados estáticos observados; mutación de cadena en memoria detectada. **No afirmar que el harness anterior fue ejecutado en un clon:** no se dispuso de clon. La prueba de sensibilidad confirma solo el patrón del detector; no un bug de ejecución ni una suite RED→GREEN del CC.

## Confirmaciones de evidencia fuente
- `courier_documents_insert_self`: `courier_id=auth.uid()`, `status='submitted'` y fechas de purga nulas; no `rejected`.
- `courier_documents`: PK id, UNIQUE storage_path, sin indicador de versión vigente.
- `CourierProfilePage`: `select('kind,status')` sin orden y `docs.find()`.
- `getApplicantDetail`: todas las versiones en orden ascendente por fecha.
- `admin_verify_document`: `jsonb_build_object(..., 'reason', p_reason, ...)` en audit_log.
- `runSweep`: `purge_after <= now` y `purged_at is null` -> remove Storage -> update con auditoría.

## Pruebas exigidas al finalizar la implementación (NO ejecutadas)
**SQL / db-tests (CC #363):** actor ajeno, path falso, autopromoción a verified, insert directo de documento aprobado, carrera de dos reemplazos, idempotencia y audit consistente; admin no revisa version vieja; retención/purga; no filtrar razón interna. Mutar checks en memoria/worktree y probar rojo genuino; CI corre `pnpm test:db` (revisar logs Files/Tests/Result y tipos) sin levantar Supabase/Docker local.

**Código:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, con mutaciones a guardia de status, selección de versión, secreto reason y retry de red. Registrar salidas exactas y SHA.

**E2E:** `e2e/specs/courier-onboarding.spec.ts` y `e2e/specs/uploads-a11y.spec.ts` en Vercel Preview+Supabase Develop: rechazo de licencia -> mensaje -> nueva carga submitted -> admin revisa; DNI frente rechazado + dorso verified intacto. Guardar run/SHA. Si inaccesible, dejar pendiente sin inventar aprobación.

**Merge-tree / scope** (hacer solo cuando la rama tenga CC mergeado):
```bash
git fetch origin
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
```

Nunca ejecutar comandos SQL contra Supabase remoto ni crear archivos .env con claves.
## Ronda 3 — comandos y evidencia (2026-10-17)

**HEAD probado mediante consultas GitHub y lectura de código:** `af4838a6cda959288651f54c2b93e3c75aa33441`; función última `a158c29c80cd81a225c7525be87d3fed67a5a7b9`; develop `711a2f7054d77fd664d3ec09b3bbdd24efb88476`.
**Herramientas realmente usadas:** `mcp__GitHub__get_pr_info`, `mcp__GitHub__fetch` sobre REST `/pulls/358`, `/pulls/358/commits`, `/pulls/358/files`, `/commits/{HEAD}/status`, `/commits/{HEAD}/check-runs`, `/branches/develop`, `/actions/runs?head_sha=...`; `mcp__GitHub__compare_commits(develop,HEAD)` y `compare_commits(641984db,HEAD)`; `mcp__GitHub__fetch_file` en fuentes; `fetch_workflow_run_jobs(39040606398)`; `fetch_workflow_job_logs(117419231897)`.
**Salidas verificadas:** `e2e-preview` run `39040606398` job `117419231897`: checkout explícito `af4838a6`, `Verify Supabase Develop target` SUCCESS, `Health check` SUCCESS, `Running 83 tests using 1 worker`, `83 passed (23.9m)`, `Running 3 tests using 1 worker`, `3 passed (1.0m)`; commit status `e2e-preview: success`; approval-policy success. `pulls/358` mergeable false, `mergeable_state: dirty`, base SHA `293c3a2`; compare develop→HEAD: 58 behind,18 ahead. `compare(641984db,HEAD)` 10 commits de fixes/test/docs y solo seis archivos de código/bitácora.
**Fuente y controles:** `document-replacement-card.tsx` mantiene intento mediante `PendingAttempt` pero rama `idemp-` no UUID. `status-view.tsx` conserva `initialRejectedKindsRef` y título fijo. `e2e/specs/courier-onboarding.spec.ts:915-930` invoca `admin_verify_document` con AAL2, `:969-1041` inspecciona vista admin; `:1043-1076` comprueba SQL. E2E sobre Develop no equivale a ejecución de mutación independiente de revisión.
**Nueva dependencia:** [issue #399](https://github.com/cadeApp/cadeApp/issues/399) creado tras autorización A y registrada en #363; evita inventar un T-xxx sin ficha/board.

### Instrucciones reproducibles para agy (NO ejecutadas por el revisor)
1. `git fetch origin && git switch feat/T-356-recarga-documentos-rechazados && git pull --ff-only origin feat/T-356-recarga-documentos-rechazados && git merge origin/develop` (ficha desde develop, mantener revisiones previas).
2. `pnpm vitest run src/features/courier-onboarding/components.test.tsx src/features/courier-onboarding/actions.test.ts` y suites implicadas; añadir tests para key no disponible y título mixto/terminado; hacer control GREEN; mutación exacta en código de producción para RED; restaurar GREEN sin editar test.
3. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `node --test tools/verify-fichas.test.ts` según script del repo; `git merge-tree --write-tree origin/develop HEAD`; `git diff --name-only origin/develop...HEAD`; validar `node docs/revision-pr/analizar.mjs verificacion`.
4. GitHub Actions CI posterior al nuevo SHA y **E2E Preview Vercel contra Supabase Develop** para nuevo SHA; capturar logs exactos. No usar resultado `approval-policy` o job skipped como sustituto de pruebas.

**No ejecutado por revisor:** no clon Git local, no Vitest/SQL/Playwright propios y no mutaciones RED→GREEN propias. Los comandos enumerados arriba son pasos recomendados para la siguiente iteración, NO resultados observados.

## Ronda 4 — PR #358 / HEAD 157b492dc708a70795cca4cee0c87ba87b57c356

**Inspección de GitHub:** `pulls/358`, `pulls/358/commits`, `pulls/358/files`, `compare_commits(develop, HEAD)` = ahead 21/behind 0, `mergeable=true` al consultar; latest code commit 157b492d y merge ca23a92e. `fetch_file` de `document-replacement-card.tsx`, `status-view.tsx`, `upload-manager.ts`, `image-compression.ts`, `document-upload-card.tsx`, `upload-resilience.test.ts`, contrato SQL, tests y bitácora. No hubo cambios funcionales por revisor.

**CI remota realmente leída:** job `117439236185` run `39047554976`: 139 files / 2614 tests PASS; job `117439236316` run `39047554976`: Files=27, Tests=2420, Result=PASS; typecheck, lint, build, audit, bundle successful. `approval-policy` run `39047551950` success.
**E2E:** run `39047622636`, job `117439466932`, `in_progress` y commit status `pending` al comprobar; todavía sin resultado. No sustituir por 83/83 de run `39040606398` en SHA anterior.

### Contraprueba de compatibilidad (modelo de paridad, ejecutada con Node v22.16.0)
Este script usa copia literal del algoritmo observado en `upload-manager.ts` y la regex observada en SQL. Como no hay clone conectado y `git ls-remote https://github.com/...` falló con «Could not resolve host», **NO** se presenta como test ejecutado sobre código fuente real ni como mutación propia del repo.

```bash
cat > /tmp/pr358_r4_extension_probe.cjs <<'NODE'
'use strict';
const assert = require('node:assert/strict');
// Reproducción de paridad del algoritmo en upload-manager.ts:71-88, NO importa el módulo TS real.
// La regla SQL procede de 20261016210000_cc025_courier_document_replacement.sql.
function getDocumentExtension(file) {
  const parts = file.name.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.trim().toLowerCase();
    if (ext) return ext;
  }
  switch (file.type) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'application/pdf': return 'pdf';
    case 'image/jpeg':
    default: return 'jpg';
  }
}
const storageSuffixAccepted = /^[0-9]+[.](png|jpe?g|webp|pdf)$/i;
const cases = [
 ['foto.jpg', 'image/jpeg', true],
 ['foto.jpeg', 'image/jpeg', true],
 ['foto.jfif', 'image/jpeg', false],
 ['foto.jpe', 'image/jpeg', false],
 ['foto.tiff', 'image/jpeg', false],
 ['foto.png', 'image/jpeg', true],
 ['sin-extension', 'image/jpeg', true],
 ['poliza.pdf', 'application/pdf', true]
];
for (const [name,type,expected] of cases) {
  const ext = getDocumentExtension({name,type});
  const accepted = storageSuffixAccepted.test('1792250000000.'+ext);
  assert.equal(accepted,expected,`${name}: mismatch`);
  console.log(`${name} [${type}] -> ${ext} -> ${accepted?'RPC ACCEPTS SUFFIX':'RPC REJECTS SUFFIX'}`);
}
console.log(`PASS: ${cases.length} path/SQL compatibility probes. Parity model only.`);
NODE
node /tmp/pr358_r4_extension_probe.cjs
```

**Salida observada:**
```text
foto.jpg [image/jpeg] -> jpg -> RPC ACCEPTS SUFFIX
foto.jpeg [image/jpeg] -> jpeg -> RPC ACCEPTS SUFFIX
foto.jfif [image/jpeg] -> jfif -> RPC REJECTS SUFFIX
foto.jpe [image/jpeg] -> jpe -> RPC REJECTS SUFFIX
foto.tiff [image/jpeg] -> tiff -> RPC REJECTS SUFFIX
foto.png [image/jpeg] -> png -> RPC ACCEPTS SUFFIX
sin-extension [image/jpeg] -> jpg -> RPC ACCEPTS SUFFIX
poliza.pdf [application/pdf] -> pdf -> RPC ACCEPTS SUFFIX
PASS: 8 path/SQL compatibility probes. Parity model only.
```

**Falsadores a ejecutar por agy:** prueba real de `getDocumentExtension` y `buildCourierStoragePath` en `upload-resilience.test.ts`: JPEG .jfif/.jpe/.tiff → jpg, JPEG desde PNG comprimida → jpg, raw image/png → png, webp → webp, pdf → pdf; MIME desconocido aborta antes de `.upload` y antes de acción. Prueba `uploadCourierDocument` con fake Storage comprueba ruta, MIME y upsert:false. Prueba componente mock que respete path realmente producido; no mockear path fijo para ocultar error. Mutación de producción que prioriza `file.name` debe dar RED por aserción de extensión; restauración da GREEN sin modificar test.

**No ejecutado:** `pnpm vitest`, mutaciones del módulo real, E2E propio, Docker/Supabase. Al corregir, agy debe adjuntar comandos y líneas `Tests` RED/GREEN reproducibles en `docs/tasks/log/T-356.md` y correr CI/E2E en el nuevo SHA.

## Ronda 5 independiente — 2026-10-17

**HEAD EXACTO:** `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`. GitHub PR #358 Draft, mergeable=true, compare develop 0 behind/24 ahead, base `711a2f7054d77fd664d3ec09b3bbdd24efb88476`. PR diff R4→R5: 4 archivos (upload-manager, upload-resilience.test, E2E spec, bitácora). No cambios en docs/revision-pr atribuibles al autor.

### Resultado realmente ejecutado por esta revisión
- Herramienta `mcp__GitHub__fetch_file` leyó fuente exacta de `upload-manager.ts` sobre `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`; se extrajo el **cuerpo literal** de `getDocumentExtension(file: File)` y `buildCourierStoragePath(...)` y se ejecutaron como JS en un isolate V8, sin reemplazar la lógica real.
- Casos: foto.jfif/JPEG, foto.jpe/JPEG, foto.tiff/JPEG, foto.png/JPEG, foto.PNG/PNG, foto.webp/WebP, poliza.pdf/PDF, sin-extension/JPEG, doc.jpg/octest-stream y doc.jpg/MIME vacío: **10/10 GREEN**.
- Verificación del path por función real extraída: `courier/71b6db92-2cfd-437f-b69f-93b8b84acd4e/license_1700000000000.jpg`.
- Mutación aislada insertando prioridad por extensión de `file.name` sobre switch MIME: **7 resultados incorrectos RED**. Fallaron JFIF, JPE, TIFF, PNG renombrado, sin-extension, y los dos tipos MIME inválidos (se admitían incorrectamente). Restauración: **10/10 GREEN**.
- **Alcance:** función real extraída y compilada como JS puro, no suite TS importada ni llamada remota Storage/DB. Tests ejecutados por CI del autor sirven de apoyo a integración, pero no se atribuyen al revisor.

### Harness COMPLETO reproducible en el checkout exacto desde raíz

```bash
cat > /tmp/pr358_r5_independiente.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('src/features/courier-onboarding/upload-manager.ts', 'utf8');
function bodyOf(signature) {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, 'SIN OBJETIVO: no existe símbolo ' + signature);
  const open = src.indexOf('{', start + signature.length);
  assert.ok(open >= 0, 'SIN OBJETIVO: símbolo sin cuerpo');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open+1, i);
    }
  }
  throw new Error('SIN OBJETIVO: cuerpo incompleto');
}
const impl = bodyOf('export function getDocumentExtension(file: File): string');
assert.ok(impl.includes('switch (file.type)'), 'SIN OBJETIVO: no existe switch MIME');
const restored = new Function('file', impl);
const buildBody = bodyOf('export function buildCourierStoragePath(');
const build = new Function('getDocumentExtension',
  `return (courierId, kind, file, timestamp) => {${buildBody}}`)(restored);
const cases = [
  ['foto.jfif','image/jpeg','jpg'],['foto.jpe','image/jpeg','jpg'],
  ['foto.tiff','image/jpeg','jpg'],['foto.png','image/jpeg','jpg'],
  ['foto.PNG','image/png','png'],['foto.webp','image/webp','webp'],
  ['poliza.pdf','application/pdf','pdf'],['sin-extension','image/jpeg','jpg'],
  ['doc.jpg','application/octet-stream','THROW'],['doc.jpg','','THROW']
];
function run(fn) {
  return cases.map(([name,type,want]) => {
    let got;
    try { got = fn({name,type}); } catch { got = 'THROW'; }
    return {name,type,want,got,pass:want===got};
  });
}
const initial = run(restored);
assert.equal(initial.filter(x=>x.pass).length,10,'GREEN previo falso');
const expectedPath='courier/71b6db92-2cfd-437f-b69f-93b8b84acd4e/license_1700000000000.jpg';
assert.equal(build('71b6db92-2cfd-437f-b69f-93b8b84acd4e','license',
  {name:'foto.jfif',type:'image/jpeg'},1700000000000),expectedPath);
console.log('GREEN original: 10/10; build path canónico: PASS');
const marker='  switch (file.type) {';
assert.equal(impl.split(marker).length,2,'SIN OBJETIVO: mutación ambigua');
const mutated=impl.replace(marker,
  "  const ext = file.name.split('.').pop().trim().toLowerCase(); if (ext) return ext;\n"+marker);
const mutant = new Function('file', mutated);
const red = run(mutant);
const failed = red.filter(x=>!x.pass);
assert.equal(failed.length,7,'Mutación RED no sensible: '+JSON.stringify(red));
console.log('RED mutación in-memory: 7 fallos específicos',
  failed.map(x=>x.name+'('+x.type+'): '+x.got+' != '+x.want).join(' | '));
assert.equal(run(restored).filter(x=>x.pass).length,10,'No restauró');
console.log('GREEN restaurado: 10/10');
NODE
node /tmp/pr358_r5_independiente.cjs
```

Este harness fue redactado para ejecutar desde un checkout; en la sesión se ejecutó su equivalente contra el cuerpo fuente devuelto por GitHub en V8 (misma tabla de entradas y mutación). **No afirmar que el script de /tmp fue ejecutado por esta sesión en un clone local**.

### GitHub CI/E2E real
- CI https://github.com/cadeApp/cadeApp/actions/runs/39052207646 SHA `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`: unit job `117452900462`, log `Test Files 139 passed (139)`, `Tests 2618 passed (2618)`; db-tests job `117452900441`, último log final `Files=27, Tests=2420, Result: PASS`, typecheck/lint/build/audit/bundle all pass.
- approval-policy https://github.com/cadeApp/cadeApp/actions/runs/39052205218 success (formato, no autoría/independencia).
- E2E **PREVIO** SHA 21732e6 https://github.com/cadeApp/cadeApp/actions/runs/39049776421: **85/86 PASS, 1 FAIL** al esperar `.png` tras cambio canónico. El autor corrigió única aserción a `.jpg`, sin quitar oráculo SQL.
- E2E **HEAD** SHA `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`, https://github.com/cadeApp/cadeApp/actions/runs/39052264162, job `117453108213`: `Verify Supabase Develop target` SUCCESS; `Health check` SUCCESS; `Run preview E2E gate` **in_progress al consultar**. No autorizar merge ni anunciar tests E2E verdes hasta obtener log final y status real.

### No ejecutado
- `pnpm test` local del checkout, `node docs/revision-pr/analizar.mjs verificacion`, `git merge-tree` local, Docker/DB local/remota o Playwright por el revisor. La compatibilidad y checks de CI se leyeron directamente en GitHub.
