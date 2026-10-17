# Evidencia y comandos — PR #364 / Ronda 1

**SHA original:** `9be93c5bbd7450059e8104c47f87d7ea077f2785`. Fuente: fetch_file de GitHub sobre SHA/branch; inspección SQL, dominio, fake, pgTAP y contratos en develop. **No se clonó el repo** (GitHub DNS no resuelve en el contenedor), no se ejecutó PostgreSQL local ni remoto; resultados de BD observados exclusivamente en CI del HEAD original.

## CI del HEAD examinado
- [run 38684238884](https://github.com/cadeApp/cadeApp/actions/runs/38684238884): 7 jobs `audit,unit,typecheck,lint,build,db-tests,bundle-budget` PASS.
- Log db-tests: `cc025_courier_document_replacement.sql .. ok`; **Files=23, Tests=2231, Result=PASS** y `[db:types] Tipos generados exitosamente`.
- Log unit: **Test Files 131 passed; Tests 2179 passed**. El body del PR declara 2181: actualizar sólo después de nueva ejecución.
- `compare_commits develop...cc/CC-025...`: ahead 4, behind 12, diverged; `get_pr_info.mergeable=false`. No corrimos `git merge-tree`, así que no afirmamos origen concreto del bloqueo.

## Harness de lectura estática, independiente del autor

Copiar esta sección en `/tmp/pr364-audit.cjs` y ejecutar desde la raíz de un checkout de la rama HEAD original (sin modificarlo). El harness **no es test funcional PostgreSQL**, sino un detector reproducible de los patrones SQL exactos. La batería de esta revisión se corrió previamente sobre el contenido REAL recibido vía GitHub como checks JS en memoria: **10/10 condiciones observadas**, mutación del guard Storage -> detector RED. Para conseguir rojo funcional sigue pendiente pgTAP de la próxima ronda.

```bash
cat >/tmp/pr364-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const sql = read('supabase/migrations/20261015020000_cc025_courier_document_replacement.sql');
const tests = read('supabase/tests/cc025_courier_document_replacement.sql');
const cc = read('docs/contracts/CC-025.md');
const rpc = read('src/domain/rpc-contracts.ts');
const action = read('src/features/courier-onboarding/actions.ts');
const oldRls = read('supabase/migrations/20260922051650_rls_v1.sql');
const storageGuard = /if exists\s*\(select 1 from storage\.objects where bucket_id = 'courier-docs'\)/i;
const check = (name, truthy) => { assert.ok(truthy, 'No observado: '+name); console.log('OBSERVADO '+name); };
check('H01 guard omite verificar bucket vacío',storageGuard.test(sql));
check('H02 lock courier antes de doc',/Lock ordenado: 1\. couriers[\s\S]*?for update;[\s\S]*?Lock ordenado: 2\. courier_documents vigente/.test(sql));
check('H02 admin update courier después de for update doc',/-- PR358-H02:[\s\S]*?if v_doc_status[\s\S]*?update public\.couriers/.test(sql));
check('H03 admin FOR ALL policy en esquema anterior',/create policy courier_documents_write_admin[\s\S]*?for all to authenticated/.test(oldRls));
check('H03 no reemplaza política admin en nueva migración',!sql.includes('drop policy if exists courier_documents_write_admin'));
check('H04 sin nuevo filtro SELECT self por is_current',!sql.includes('drop policy if exists courier_documents_select_self'));
check('H04 matriz contractual dice que no ve histórico',cc.includes('Documento histórico')&&cc.includes('No (reemplazado)'));
check('H05 action hace UPSERT sin onConflict',/\.from\('courier_documents'\)\s*\.upsert\(documentEntries as never\)/.test(action));
check('H06 backfill usa uploaded_at+30',/ranked\.rn > 1 and cd\.purge_after is null then cd\.uploaded_at \+ interval '30 days'/.test(sql));
check('H07 input incluye key pero SQL no la lee',/idempotencyKey: uuidSchema\.optional\(\)/.test(rpc)&&!sql.includes('idempotencyKey'));
check('prueba concurrente de 2 conexiones NO aparece en pgTAP',!/(dblink|pg_advisory_lock|pg_sleep|concurr|parallel|wait_event|lock_timeout)/i.test(tests));
console.log('GREEN detector independiente (sintáctico).');
const changed=sql.replace("if exists (select 1 from storage.objects where bucket_id = 'courier-docs') then",'-- guard removed temporarily');
assert.notEqual(changed,sql,'Mutación debe alcanzar la línea real');
assert.equal(storageGuard.test(changed),false,'La mutación debe ser detectada');
console.log('RED detector con mutación del guard EN MEMORIA; no es RED de DB.');
NODE
node /tmp/pr364-audit.cjs
```

**Criterios para ejecutar auténticos RED→GREEN tras los fixes:**
- H01 SQL sin ningún `storage.objects`: el test bucket vacío con doc rejected debe fallar en control mutado, verde en arreglo.
- H02 con dos sesiones y guardia de deadlock: control mutado con orden opuesto debe fallar, sin cambiar fixtures.
- H03 UPDATE directo bajo admin AAL1: control mutado abriendo grant/policy debe detectar cambio real persistido.
- H04 policy sin `is_current`: SELECT histórico debe aparecer y causar rojo.
- H05 UPSERT viejo tras primer envío: segundo intento debe causar unique error o fail en aserción y arreglo verde.
- H06 backfill `uploaded_at+30`: fecha de purga queda vencida y aserción roja.
- H07 ignorar key: replay y audit conteos deben delatar duplicado o rechazo mal clasificado.
- En DB, **NO levantar Docker ni Supabase local** según política. Job CI db-tests del SHA publicado y su salida real; sin simular logs ni declarar rojo no corrido.

**Checks finales que debe dejar el autor en CI para nueva ronda:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `db-tests` Files/Tests/Result; `node docs/revision-pr/analizar.mjs verificacion`; merge-tree comparado contra develop.

## Ronda 5 — 2026-10-16
GitHub inspect: migración C SQL 84-104, 158-162; PgTAP C 201-215, 425-460; Storage RLS v1 491-499; workflow CI 38986094196, unit 137/2484, pgTAP 27/2406, mutaciones autor B0 y C. E2E error BLOCKED. Mutaciones R06/R07 propuestas en evidencia/ronda-5.md, no ejecutadas por revisor. Tampoco analizar.mjs (sin clon local), no inventar salida.


## Ronda 6 — 2026-10-17 (revisor solo GitHub)
- `get_pr_info #364` HEAD `f6168c03fedaa34d843c4192f46c6af1aae7b680`; compare desde commit independiente R5 `fede5696` (9 commits; merges de develop) y against develop ahead35 behind0.
- `fetch_file` migración C líneas 62–70, 142–155; pgTAP C casos R07 y R06; rls_matrix líneas 540–555; runner cc025_concurrency.mjs R06/R07.
- `fetch_commit_workflow_runs` / logs Actions CI 38993728305: unit 137/2515, DB 27/2420 PASS, R06 LIKE RED/restaurado GREEN, R07 GRANT+policy RED/restaurado 42501/0 filas GREEN. Es ejecución del autor, NO revisor. E2E 38993803372 BLOCKED.
- No se ejecutó Docker/Supabase/psql, E2E ni `node docs/revision-pr/analizar.mjs verificacion` en esta sesión (sin clon local). No hay mutación independiente, `verificado_en_sha=null`.


## Ronda 7 — 2026-10-17: inspección independiente de workflow remoto (no SQL propio)
- API GitHub PR #364 HEAD `4b7117a425bb3aad9de58f8c961fd35a8c04165c`, base develop `256ae179`, `compare` anterior a R7: ahead 6 desde revisor R6, archivo SQL C sin cambios y pr-364/** intacta; compare develop ahead 39 behind 0.
- API GitHub staging HEAD `fb7db3f035251a78e5a9e32f5e3465735a36ba4f`, PR #392 merged, migrate-staging #39006887225 job 117321063407 aplicó cuatro SQL y sin drift, deploy-staging #39006925376 jobs 117321173186 (same SHA/health) y 117321445165 (82/82 E2E staging). `fetch_file` staging writer confirma RPC B0. C no existe en staging (404).
- API GitHub CI SHA `4b7117a425bb3aad9de58f8c961fd35a8c04165c` run #39011025442 SUCCESS: unit 137/2515, db-tests 27/2420, R06 LIKE RED/GREEN, R07 GRANT+policy RED/GREEN, backfill RED/GREEN, db:types sin drift. E2E-preview error BLOCKED / REQUIRES DEVELOP MIGRATION.
- Revisor **no** ejecutó DB/Docker/Supabase/Playwright local ni mutaciones propias, `node docs/revision-pr/analizar.mjs verificacion` NO ejecutado (no hay clon). No atribuir como pruebas propias CI del autor. Fuente externa staging fue verificada por inspección independiente de los jobs y sus logs, anclada a SHA `fb7db3f035251a78e5a9e32f5e3465735a36ba4f`.
