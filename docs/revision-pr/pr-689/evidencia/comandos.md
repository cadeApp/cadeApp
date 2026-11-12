# Evidencia reproducible — PR #689 / T-430 · Ronda 1

SHA inspeccionado: `7ce8a7f15b28f8624d025efb5f17949c982b858e`. HEAD de código: `93d4fa33` (el commit posterior solo toca bitácora).

## A. Estado, alcance y logs (solo lectura)

```bash
git fetch origin
git rev-parse origin/feat/T-430-sec06-draft-only
git rev-parse origin/develop
git diff origin/develop...origin/feat/T-430-sec06-draft-only --stat
git diff origin/develop...origin/feat/T-430-sec06-draft-only -- docs/tasks/T-430.md
git merge-tree --write-tree origin/develop origin/feat/T-430-sec06-draft-only
git log --oneline -- docs/revision-pr/pr-689/
git diff --check origin/develop...origin/feat/T-430-sec06-draft-only
# El CI después de commitear esta revisión contiene documentación nueva:
node docs/revision-pr/analizar.mjs verificacion
```

El revisor no ejecutó estos comandos Git localmente por falta de acceso DNS a GitHub en el contenedor. Se comprobó por la API del PR: head `7ce8a7f15b28f8624d025efb5f17949c982b858e`, base `c823fae1`, `ahead_by=18`, `behind_by=0`, mergeable=true y diez rutas cambiadas.

Logs de CI consultados a través del conector GitHub y comparados con sus SHAs:

- RED sin migración: https://github.com/cadeApp/cadeApp/actions/runs/43139076669 (`93db713d`), db-tests falla por múltiples controles CC-048.
- GREEN: https://github.com/cadeApp/cadeApp/actions/runs/43141703429 (`93d4fa33`). Job db-tests `Files=45, Tests=3797, Result: PASS`; integración CC-048 ocho escenarios OK. `git diff --exit-code -- src/types/database.types.ts` figura en el mismo job. Resto de jobs success.
- #690 sin USING draft: https://github.com/cadeApp/cadeApp/actions/runs/43141096829; bypass por columnas RED.
- #691 sin lock de padre: https://github.com/cadeApp/cadeApp/actions/runs/43141101157; escenario 8A RED.
- #692 sin trigger: https://github.com/cadeApp/cadeApp/actions/runs/43141105058; pgTAP RED.
- #695 sin trigger (llegar hasta 9C quitando temporalmente tests previos): https://github.com/cadeApp/cadeApp/actions/runs/43142454194; integración 9C RED por contacto insertado indebidamente.
- #693 id inexistente en caso 18: https://github.com/cadeApp/cadeApp/actions/runs/43141110457; `rls_matrix` 21-23 RED.
- #694 sin set_updated_at: https://github.com/cadeApp/cadeApp/actions/runs/43141114874; `rls_matrix` 23 y `structure` 41 RED.
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/43142836603. El log de `resolve-pull-request` dice `PR interna #689 contra develop` y `BLOCKED / REQUIRES DEVELOP MIGRATION`; no se ejecuta el E2E. No se afirma E2E verde.

Estos runs son **evidencia del autor cotejada por la revisión**; no son mutaciones nuevas del revisor ni pruebas DB ejecutadas en su entorno. Ningún comando ejecutó Supabase/Docker remoto o local.

## B. Batería propia de mutaciones estáticas (harness completo)

Esta batería verifica invariantes textuales **en su policy/trigger objetivo**, sin confundir condiciones de otra policy del mismo archivo (P08/P06). No simula un INSERT ni afirma resultado de PostgreSQL. Se ejecutó sobre el contenido exacto de la migración obtenido del SHA `7ce8a7f15b28f8624d025efb5f17949c982b858e`: `GREEN control original`, `RED` en las 7 mutaciones previstas. En particular, quitar el estado del WITH CHECK de INSERT es detectado aquí; si pgTAP existente detectaría ese cambio es una **hipótesis pendiente** de la nueva prueba D02-A.

Para ejecutarla desde la raíz del repo, copiá solo el siguiente bloque (su contenido completo) a `/tmp/pr689-estatico.mjs`, y ejecutá `node /tmp/pr689-estatico.mjs`. No modifica archivos.

```bash
cat > /tmp/pr689-estatico.mjs <<'NODE'
#!/usr/bin/env node
// Control ESTÁTICO independiente de CC-048. Ejecutar desde la raíz del repo.
// No reemplaza a pgTAP ni a pruebas de carrera de PostgreSQL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = 'supabase/migrations/20261111120000_cc048_merchant_draft_only.sql';
const source = readFileSync(path, 'utf8');

function section(sql, kind, name) {
  const pattern = kind === 'policy'
    ? new RegExp('create\\s+policy\\s+' + name + '\\b[\\s\\S]*?;', 'i')
    : new RegExp('create\\s+trigger\\s+' + name + '\\b[\\s\\S]*?;', 'i');
  const match = sql.match(pattern);
  assert.ok(match, 'missing ' + kind + ' ' + name);
  return match[0];
}

function check(sql) {
  const dr = section(sql, 'policy', 'delivery_requests_update_merchant');
  const ins = section(sql, 'policy', 'contacts_insert_merchant');
  const upd = section(sql, 'policy', 'contacts_update_merchant');
  const trigger = section(sql, 'trigger', 'trg_lock_draft_contacts');
  assert.match(dr, /using\s*\(\s*merchant_id\s*=\s*auth\.uid\(\)\s+and\s+status\s*=\s*'draft'\s*\)/i);
  assert.ok(/with\s+check\s*\(\s*exists\s*\(/i.test(ins) &&
    /r\.merchant_id\s*=\s*auth\.uid\(\)\s+and\s+r\.status\s*=\s*'draft'/i.test(ins),
    'contacts insert WITH CHECK draft');
  assert.match(upd, /r\.merchant_id\s*=\s*auth\.uid\(\)\s+and\s+r\.status\s*=\s*'draft'\s+for\s+update\s+of\s+r/i);
  assert.ok(/with\s+check\s*\(\s*exists\s*\(/i.test(upd) &&
    (upd.match(/r\.status\s*=\s*'draft'/gi) || []).length === 2,
    'contacts update WITH CHECK draft');
  assert.match(trigger, /before\s+insert\s+on\s+public\.delivery_request_contacts/i);
  assert.doesNotMatch(trigger, /\bbefore\s+update\b/i);
  const grant = sql.match(/grant\s+update\s*\(([\s\S]*?)\)\s+on\s+public\.delivery_request_contacts\s+to\s+authenticated/i)?.[1];
  assert.ok(grant && !/\brequest_id\b/i.test(grant), 'request_id no UPDATE grant');
  assert.match(sql, /revoke\s+insert,\s*update,\s*delete,\s*truncate,\s*references,\s*trigger\s+on\s+public\.delivery_request_contacts\s+from\s+anon,\s*authenticated/i);
}

function mutatePolicy(sql, name, from, to) {
  const original = section(sql, 'policy', name);
  assert.ok(original.includes(from), 'sin objetivo en ' + name + ': ' + from);
  return sql.replace(original, original.replace(from, to));
}
function mutation(name, transform) {
  const changed = transform(source);
  assert.notEqual(changed, source, 'mutación sin objetivo: ' + name);
  assert.throws(() => check(changed), undefined, name + ' sobrevivió');
  console.log('RED  ' + name);
}

check(source);
console.log('GREEN  control original');
mutation('requests UPDATE sin draft', (s) => mutatePolicy(s, 'delivery_requests_update_merchant', " and status = 'draft'", ''));
mutation('contacts INSERT policy sin draft', (s) => mutatePolicy(s, 'contacts_insert_merchant', " and r.status = 'draft'", ''));
mutation('contacts UPDATE sin for update', (s) => mutatePolicy(s, 'contacts_update_merchant', '    for update of r\n', ''));
mutation('contacts UPDATE usando fila sin draft', (s) => mutatePolicy(s, 'contacts_update_merchant',
  " and r.status = 'draft'\n    for update of r", '\n    for update of r'));
mutation('trigger de contactos ausente', (s) => s.replace(/create trigger trg_lock_draft_contacts[\s\S]*?;/i, ''));
mutation('grant UPDATE request_id indebido', (s) => s.replace(/grant\s+update\s*\(/i, 'grant update (request_id, '));
mutation('TRUNCATE sin revoke', (s) => s.replace(
  'revoke insert, update, delete, truncate, references, trigger on public.delivery_request_contacts',
  'revoke insert, update, delete, references, trigger on public.delivery_request_contacts'));
console.log('7/7 mutaciones estáticas detectadas; no se ejecutó PostgreSQL');
NODE
node /tmp/pr689-estatico.mjs
```

Salida esperada en el SHA revisado (control estructural, no db-test):

```text
GREEN  control original
RED  requests UPDATE sin draft
RED  contacts INSERT policy sin draft
RED  contacts UPDATE sin for update
RED  contacts UPDATE usando fila sin draft
RED  trigger de contactos ausente
RED  grant UPDATE request_id indebido
RED  TRUNCATE sin revoke
7/7 mutaciones estáticas detectadas; no se ejecutó PostgreSQL
```

## C. Protocolo de prueba faltante D02-A (para agy)

Modificar solo `supabase/tests/cc048_merchant_draft_only.sql` y la bitácora `docs/tasks/log/T-430.md` en rama real:

1. Crear helper `pg_temp.probe_insert_policy_only(uuid)` ejecutado como propietario, con bloque PL/pgSQL interno `BEGIN ... EXCEPTION` para representar un **savepoint implícito**: deshabilitar **solo** `trg_lock_draft_contacts`, ejecutar `pg_temp.run(pg_temp.merchant(), INSERT ...)`, conservar `jsonb` en variable PL/pgSQL y forzar `RAISE EXCEPTION 'CC048_ROLLBACK_PROBE' USING ERRCODE = 'P0010'`; capturar únicamente `P0010` fuera del bloque interno. El rollback de esa subtransacción restaura tanto el trigger como el INSERT de prueba; el resultado almacenado en variable PL/pgSQL sobrevive. Evitar hacer `is()` dentro del bloque que se revierte, pues el conteo TAP podría revertirse.
2. **Después del rollback interno**, agregar pruebas `is(probe(req_published_nc())->>'code', '42501')`, `is(probe(req_matched_nc())->>'code', '42501')`, `is(probe(req_foreign_draft())->>'code', '42501')` y `is(tgenabled, 'O')` para confirmar trigger restaurado. Ajustar `plan(107)` al número real de nuevas aserciones; sugerido 111 con esas cuatro. No usan contactos preexistentes: `request_id` es PK.
3. En rama aislada de mutación `review/T-430-insert-with-check`, con PR titulada **REVIEW ONLY / NEVER MERGE**, eliminar únicamente `and r.status = 'draft'` de `contacts_insert_merchant WITH CHECK` (no tocar trigger ni otros predicados). Los casos nuevos de publicada y matched tienen que FALLAR en rojo mostrando `00000` en lugar de `42501` (o evidencia equivalente de que el INSERT pasó). Si se ponen verdes, parar y analizar el instrumento; no adulterar expectativas.
4. Cerrar la PR de mutación sin mergearla. Volver a rama real con SQL de producción intacto, CI db-tests GREEN y aserciones originales intactas. Dejar en bitácora SHA y URLs de RED/GREEN, conteos y pruebas `hecho / pruebas / falta`. No autoverificar hallazgos.
5. La revisión independiente vuelve a ejecutar/comprobar esa evidencia en SHA nuevo. El E2E del SHA de migración sigue `BLOCKED` hasta aplicación a Develop; no exigir E2E GREEN inexistente.

Comandos finales de la rama real (sin levantar Docker local):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run tools
git diff --check
git diff --name-only origin/develop...HEAD
git status --short
git add supabase/tests/cc048_merchant_draft_only.sql docs/tasks/log/T-430.md
git commit -m "test(db): aislar WITH CHECK del insert de contactos [T-430]"
git push origin feat/T-430-sec06-draft-only
git ls-remote origin refs/heads/feat/T-430-sec06-draft-only
```

El test DB corre **solo en CI**, sin ejecutar `pnpm test:db` local. No disparar workflows manualmente. No hacer rebase, amend ni force-push.

## D. Ronda 2 — cierre independiente de PR689-H01 (2026-11-12)

**Heads y diffs (conector GitHub):**

- PR #689 head `3912c5fc4a8bfca3b8d7373b2749fa6985425e25`, base `develop@c823fae1`, mergeable=true, abierta y sin merge. `3912c5fc` solo edita `docs/tasks/log/T-430.md`.
- Diff `47cd4655...3912c5fc`: `supabase/tests/cc048_merchant_draft_only.sql` +36/-1 (`plan(107)` → `plan(111)`, tests 108-111) y `docs/tasks/log/T-430.md` +17; dos commits, sin behind.
- El blob exacto del test es `5c00a3ef27c9c8706a0e41e46bacfb99969c89d7` en `e9aa8848` y `3912c5fc`. El primer SHA es el `verificado_en_sha`.
- Mutación #696 [PR](https://github.com/cadeApp/cadeApp/pull/696) `review/T-430-insert-with-check`: **cerrada sin merge**. Commit `7d93e30c` sobre padre `e9aa8848` (sin otros cambios de implementación/test); único patch:

```diff
--- a/supabase/migrations/20261111120000_cc048_merchant_draft_only.sql
+++ b/supabase/migrations/20261111120000_cc048_merchant_draft_only.sql
@@ contacts_insert_merchant WITH CHECK
- where r.id = delivery_request_contacts.request_id and r.merchant_id = auth.uid() and r.status = 'draft'
+ where r.id = delivery_request_contacts.request_id and r.merchant_id = auth.uid()
```

**GREEN SQL en CI** [run 43150132171](https://github.com/cadeApp/cadeApp/actions/runs/43150132171), evento `pull_request`, head `e9aa8848`, conclusión `success`, db-tests job **130957189954** `success`. Extractos del log, cotejados independientemente:

```text
.../supabase/tests/cc048_merchant_draft_only.sql ............ ok
All tests successful.
Files=45, Tests=3801
Result: PASS
[CC-048] TODOS LOS ESCENARIOS DE ESCRITURA DIRECTA COMPLETADOS EXITOSAMENTE (8/8).
```

Los otros seis jobs de este run `unit`, `audit`, `build`, `lint`, `typecheck`, `bundle-budget` tienen `conclusion=success`. `db-tests` contiene regresiones controladas de otros escenarios y transient `Rate exceeded` al descargar imágenes; se recuperó y terminó success. **No afirmar que esas líneas fueran fallas de la implementación.**

**RED SQL en CI** [run 43150138719](https://github.com/cadeApp/cadeApp/actions/runs/43150138719), head `7d93e30c`, evento `pull_request`, conclusión `failure`, solo job `db-tests` **130957112735** `failure`. Extracto del log:

```text
# Failed test 108: "CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud published"
#         have: 00000
#         want: 42501
# Failed test 109: "CC-048: sin el trigger, contacts_insert_merchant rechaza el primer contacto sobre una solicitud matched"
#         have: 00000
#         want: 42501
# Looks like you failed 2 tests of 111
Failed 2/111 subtests
Failed tests: 108-109
Files=45, Tests=3801
Result: FAIL
```

**Control propio independiente (sin DB):** se ejecutó sobre el texto del test del SHA, en memoria, un validador que comprueba plan, fixture, `ALTER TABLE ... DISABLE TRIGGER`, `RAISE EXCEPTION/EXCEPTION WHEN SQLSTATE 'U0048'`, resultados insertados fuera del rollback, actor autenticado `pg_temp.merchant()`, cuatro `is()` fuera, (42501) por estado/propiedad y `tgenabled='O'`; baseline GREEN, **8/8 mutaciones estructurales RED** en la ejecución de análisis. Para que el control sea repetible desde checkout Git, se incorporó el harness completo [probe-ronda-2.mjs](probe-ronda-2.mjs), extendido con una novena mutación que altera una prueba anterior y exige su conservación exacta. La novena mutación es **reproducible con ese script**, no se adjudica a la ejecución en memoria.

```bash
# Desde un checkout de la rama de PR #689, tras git fetch/pull:
node docs/revision-pr/pr-689/evidencia/probe-ronda-2.mjs
node docs/revision-pr/analizar.mjs verificacion
git diff --check 47cd46552319f5865b3d901c11189671b389f77e..3912c5fc4a8bfca3b8d7373b2749fa6985425e25
git diff --name-only 47cd46552319f5865b3d901c11189671b389f77e..3912c5fc4a8bfca3b8d7373b2749fa6985425e25
```

**No ejecutados por la revisión:** DB local/Supabase/Docker, workflows propios, E2E `e2e-preview` (gate de migración a Develop bloquea antes de ejecutar E2E), test suite local y merge. Se verificaron **logs CI reales**, no se extrapola a pruebas inexistentes ni se atribuye la mutación #696 al revisor. El diff de esta carpeta es solo documental, sin obligación de pedir nuevo GREEN.
