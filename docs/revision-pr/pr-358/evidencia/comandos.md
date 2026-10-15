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