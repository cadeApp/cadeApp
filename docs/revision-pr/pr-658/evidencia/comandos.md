# Evidencia y comandos — PR #658 / Ronda 1

## SHA y procedencia

- Versión funcional: `3a396ee1258b39c6c6e111f157399fccdb8ae42f`.
- Head de código + bitácora: `1f0cbc4d3678aa158f92f7822558ae46e0499751`. `3a396ee1...1f0cbc4d` es **un único commit**, solo `docs/tasks/log/T-408.md`.
- Base `develop`: `fd86f9b2a25b39607e2719e76ad1821f84f44eef`.
- No hubo clon Git accesible con red desde el contenedor de revisión. Fuente inspeccionada por conector GitHub y SHA explícito. No se ejecutaron `git fetch`/`git merge-tree` ni `pnpm` locales. La API GitHub reportó `mergeable=true`, señal menor que un merge-tree independiente.

## RED del autor — run 42438514865, SHA 908fa32d

URL: https://github.com/cadeApp/cadeApp/actions/runs/42438514865

- `db-tests`: `cc047_admin_hardening.sql` **Failed 48/66**; `Files=44, Tests=3648, Result: FAIL`.
- Fallaron `1–12, 17–29, 38, 42–54, 57–65`.
- Los casos `13–16` de `delivery_request_drops` y `delivery_request_drop_contacts` quedaron verdes SIN migración; T-340 impone su trigger de propiedad y estado. No se deben presentar como prueba de eliminación de policy.

## GREEN del autor — run 42439999763, SHA 3a396ee1

URL: https://github.com/cadeApp/cadeApp/actions/runs/42439999763

- `db-tests`: `Files=44, Tests=3651, Result: PASS`, incluida la suite CC-047 de 67 pruebas, concurrencias y chequeo de drift de tipos `git diff --exit-code -- src/types/database.types.ts`.
- `unit` Vitest: `Test Files 199 passed (199)`, `Tests 3755 passed (3755)`.
- Se observaron fallos intermedios RED intencionales de suites ajenas durante mutaciones automáticas del CI; no atribuirlos a CC-047. Resultado final del job: success.
- `typecheck`, `lint`, `build`, `audit` y `bundle-budget`: success del mismo run.

## Mutaciones del autor — PR #659, run 42440751262, SHA 0d881d08

URL: https://github.com/cadeApp/cadeApp/actions/runs/42440751262

- `cc047` Failed **18/67**, índices `1–2, 25–29, 38, 49, 52–54, 59–61, 64–66`.
- `rpc_admin` Failed **1/111** (caso 50).
- M1 sin MFA de `is_admin`, M2 restaura `profiles_update_admin`, M3 grant de TRUNCATE, M4 trigger `security definer`, M5 sin assert `aal2` de corrección, M6 reescribe `merchants.notes`. **Evidencia del autor, no nuestra batería.**
- Fueron seis mutaciones simultáneas. El efecto de M2 sobre D1 es cascada por alteración del rol, no prueba independiente de D1. No se mutó `FOR UPDATE` ni un borrado pre-fixture.

## Batería propia ESTÁTICA, completa, sin alterar el árbol Git

Se ejecutó el mismo algoritmo en memoria sobre el contenido de la migración obtenido por GitHub para `3a396ee1`: baseline 0 infracciones y las cuatro mutaciones siguientes detectadas. Se comprobó además la sintaxis del harness copiado a `/tmp/cc047-review-658.mjs` y su funcionamiento en una fixture sintética copiada a `/tmp` (4/4 RED estáticos). **El script no sustituye al pgTAP:** no consulta el catálogo PostgreSQL ni demuestra locks concurrentes. Por eso `verificado_en_sha` de los hallazgos continúa `null`.

Este es el script COMPLETO copiable y ejecutable (solo lectura del archivo fuente, mutaciones en memoria; puede correr desde `/tmp` pasando ruta absoluta al SQL):

```bash
cat > /tmp/cc047-review-658.mjs <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';

const file = process.argv[2] || 'supabase/migrations/20261108020000_cc047_admin_hardening.sql';
const original = fs.readFileSync(file, 'utf8');

function inspect(src) {
  const clean = src.replace(/--[^\n]*/g, '');
  const violations = [];

  // M-R1: el fichero de migración no reintroduce policies admin no-SELECT.
  // Esto es lectura de FUENTE, no sustituye al catálogo pg_policies.
  for (const m of clean.matchAll(/create\s+policy\s+(\w+)\s+on\s+public\.(\w+)([\s\S]*?);/gi)) {
    if (/app_private\.is_admin\s*\(/i.test(m[3]) && !/\bfor\s+select\b/i.test(m[3])) {
      violations.push('public.' + m[2] + ': ' + m[1] + ' permite escritura admin');
    }
  }

  // M-R2: el lock previo a leer el valor de auditoría existe en ambas RPC D1.
  for (const fn of ['admin_correct_courier_display_name', 'admin_revoke_courier_consent']) {
    const pattern = new RegExp('create or replace function public\\.' + fn + '\\([\\s\\S]*?\\$\\$;', 'i');
    const match = clean.match(pattern);
    if (!match || !/\bfor\s+update\s*;/i.test(match[0])) {
      violations.push(fn + ' sin SELECT FOR UPDATE');
    }
  }

  // M-R3: ni la RPC ni el rollout pueden modificar merchants.notes.
  for (const m of clean.matchAll(/\bupdate\s+public\.merchants\s+set\s+([\s\S]*?)\s+where\b/gi)) {
    if (/\bnotes\s*=/i.test(m[1])) violations.push('UPDATE sobre merchants.notes');
  }

  // M-R4: la policy admin del bucket se elimina.
  if (!/drop policy if exists courier_docs_admin on storage\.objects\s*;/i.test(clean)) {
    violations.push('falta DROP de courier_docs_admin');
  }
  return violations;
}

const mutations = [
  [
    'M-R1 restaurar drops_write_admin',
    s => s.replace(
      'drop policy if exists drops_write_admin on public.delivery_request_drops;',
      'drop policy if exists drops_write_admin on public.delivery_request_drops;\n' +
      'create policy drops_write_admin on public.delivery_request_drops for all to authenticated ' +
      'using (app_private.is_admin()) with check (app_private.is_admin());'
    ),
  ],
  [
    'M-R2 quitar FOR UPDATE en revocacion D1',
    s => s.replace(
      /(create or replace function public\.admin_revoke_courier_consent[\s\S]*?)for update;/i,
      '$1for share;'
    ),
  ],
  [
    'M-R3 insertar backfill destructivo',
    s => s + '\nupdate public.merchants set notes = null where notes is not null;',
  ],
  [
    'M-R4 conservar policy courier_docs_admin',
    s => s.replace(
      'drop policy if exists courier_docs_admin on storage.objects;',
      '/* DROP retirado en mutacion */'
    ),
  ],
];

assert.deepEqual(inspect(original), [], 'Control BASE debe estar GREEN');
console.log('BASE GREEN: ninguna violacion de los 4 controles estaticos');
for (const [label, mutate] of mutations) {
  const altered = mutate(original);
  assert.notEqual(altered, original, 'MUTACION NO APLICADA: ' + label);
  const failures = inspect(altered);
  assert.ok(failures.length > 0, 'MUTACION ESCAPO CONTROL: ' + label);
  console.log(label + ' => RED: ' + failures.join('; '));
}
console.log('4/4 mutaciones estaticas detectadas; no prueba pgTAP/RLS real');
JS

node --check /tmp/cc047-review-658.mjs
node /tmp/cc047-review-658.mjs \
  "$(pwd)/supabase/migrations/20261108020000_cc047_admin_hardening.sql"
```

**Salida al analizar el SHA original (versión del control ejecutada en memoria):**

```text
original: ok=true, adminWritePolicies=[], missingD1Locks=[], merchantNotesWrites=0, storagePolicyDropped=true
restored-drops-admin: ok=false, adminWritePolicies=["drops_write_admin"]
removed-revoke-lock: ok=false, missingD1Locks=["admin_revoke_courier_consent"]
backfill-note-erase: ok=false, merchantNotesWrites=1
restored-storage-admin: ok=false, storagePolicyDropped=false
```

**Salida del harness copiado a `/tmp` y corrido con fixture sintética equivalente:**

```text
BASE GREEN: ninguna violacion de los 4 controles estaticos
M-R1 restaurar drops_write_admin => RED: public.delivery_request_drops: drops_write_admin permite escritura admin
M-R2 quitar FOR UPDATE en revocacion D1 => RED: admin_revoke_courier_consent sin SELECT FOR UPDATE
M-R3 insertar backfill destructivo => RED: UPDATE sobre merchants.notes
M-R4 conservar policy courier_docs_admin => RED: falta DROP de courier_docs_admin
4/4 mutaciones estaticas detectadas; no prueba pgTAP/RLS real
```

**Alcance y debilidad del harness:** M-R1 solo examina policies **creadas en esta migración** y M-R2 verifica presencia textual del lock, no si se toma sobre la fila correcta. Por eso H02 requiere `pg_policies` sobre el catálogo completo postmigración, y H04 requiere carrera real admin/admin y auditoría. M-R3 es una alerta estática de limpieza, no detecta todos los SQL dinámicos posibles: mantener inspección humana del archivo completo.

## SQL de catálogo propuesto para H02 (lo debe instalar el agy como pgTAP)

```sql
select is(
  (select count(*)::bigint
   from pg_policies
   where schemaname = 'public'
     and cmd <> 'SELECT'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
         ~* 'app_private[.]is_admin[[:space:]]*[(]'),
  0::bigint,
  'SEC-01: ninguna policy no-SELECT publica usa is_admin'
);
```

Con `pg_policies` no se depende del nombre de la policy ni de que el trigger T-340 permita afectar filas. **Antes de adoptarlo**, confirmar que el catalogo actual tiene cero coincidencias y que una nueva policy `FOR ALL` con `is_admin()` cambia el resultado a rojo. Si surgen policies legítimas por otros contratos, no ocultarlas modificando el regex: reportar el conflicto.

## Verificación final sugerida al autor, en su workspace

```bash
git pull
git status --short
node --check supabase/tests/integration/cc031_profile_concurrency.mjs
pnpm typecheck
pnpm lint
pnpm test
# pgTAP y concurrencias en db-tests de CI. NO levantar Docker/Supabase local.
git diff --check
git diff --name-only origin/develop...HEAD
git ls-remote origin feat/T-408-admin-hardening
```

No crear tests falsos ni adulterar aserciones para pasar en verde. Las mutaciones de base solo en PR aislada `REVIEW ONLY / NEVER MERGE`, cerrada sin merge; conservar la rama de tarea correcta. Nunca ejecutar operaciones remotas sobre Supabase ni revelar notas de comercios, tokens o claves. No disparar CI manualmente solo para cambiar bitácora.

## Gate operativo humano pendiente

- Pre-promoción de **cada** ambiente: Lautaro073 consulta de candidatos `CC-047 `6`, registro sin texto de notas, resolución de cada candidato; cero casos pendientes antes de promover.
- `migrate-develop` tras merge aplica esquema y verifica drift. `e2e-preview` de PR no aplica migración remota por seguridad. El runbook `docs/runbooks/e2e-preview.md:153` indica que no hay E2E post-merge automático en Develop; validar E2E de staging antes de promover a producción.


---

# Ronda 2 — evidencia reproducible y mutaciones INDEPENDIENTES

## Procedencia de los SHAs

- Código correcto `511940aaa6df0bde2075d7b6bd07bf0a47e5f50c`; su padre es el commit de revisión R1 `5f61c7fa`.
- Head de bitácora `e8a002a808a22fc95c310489f70db32f64afbf53`, hijo de `511940aa`, sólo modifica `docs/tasks/log/T-408.md`.
- `develop`: `fd86f9b2a25b39607e2719e76ad1821f84f44eef`. API de PR: mergeable; no se pudo ejecutar `git merge-tree` local.
- Diff específico R1→R2: sólo 3 archivos de código (`migracion`, `cc047_admin_hardening.sql`, `integration/cc031_profile_concurrency.mjs`) y bitácora. Carpeta de revisión intacta desde el commit R1; autor no escribió aquí.

## CI oficial (se inspeccionó EL LOG, no solo el badge)

- [Run 42443782479](https://github.com/cadeApp/cadeApp/actions/runs/42443782479) `head_sha=511940aa...`, `event=pull_request`, `conclusion=success`.
- Job `db-tests` 128618332778: `cc047_admin_hardening.sql ... ok`, `Files=44, Tests=3676, Result: PASS`; escenas `D: before.display_name = CC047 Uno` y `E: before.consent_status = reconsent_required`; types drift `git diff --exit-code -- src/types/database.types.ts` sin diffs.
- Job `unit` 128618332649: `Test Files 199 passed (199)` y `Tests 3755 passed (3755)`. Lint, typecheck, audit, build y bundle completaron success.
- Rojos de `cc026`, `cc030` y mutaciones internas de `cc031` en el job GREEN son controles RED deliberados con GREEN restaurado, no fallas finales.

## Mutaciones DEL AUTOR, revisadas por SHA/diff/log

| PR / Run | SHA mutado | Cambio exclusivo | Evidencia |
|---|---|---|---|
| [#660](https://github.com/cadeApp/cadeApp/pull/660) · [42443811683 intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42443811683) | `2cdf82d` | Migración: vuelve `drops_write_admin`, lee rate_limits con `is_admin`, vuelve `courier_docs_admin`, debilita `profiles_update_self`, vuelve a escribir `merchants.notes` | `cc047 Failed 11/92` y `rpc_admin Failed 1/111`. Mutaciones agrupadas; cada índice identifica el oracle, no implica independencia |
| [#661](https://github.com/cadeApp/cadeApp/pull/661) · [42443817780](https://github.com/cadeApp/cadeApp/actions/runs/42443817780) | `bc1bfb0` | Solo elimina `FOR UPDATE` de nombre | `cc047 pgTAP PASS`; D RED por `before.display_name` distinto de Uno |
| [#662](https://github.com/cadeApp/cadeApp/pull/662) · [42443823780 intento 2](https://github.com/cadeApp/cadeApp/actions/runs/42443823780) | `bd8bada` | Solo elimina `FOR UPDATE` de consentimiento | `cc047 pgTAP PASS`; D GREEN y E RED por `before.consent_status` incorrecto |

Las tres PR están cerradas, sin merge. No se modificaron tests en esas mutaciones: el diff contra `511940aa` contiene solo la migración. No se considera batería de mutaciones del revisor.

## Batería del REVISOR: seis controles estáticos + seis mutaciones adversariales

El código siguiente es el harness completo (Node, solo lectura de tres archivos; todas las mutaciones alteran strings en memoria). La lógica fue ejecutada sobre los contenidos del SHA `511940aa` recuperados por GitHub. En este entorno sin clon local no se pudo correr exactamente el comando `node` contra esos archivos; las mismas condiciones y mutaciones se ejecutaron en el runtime JS del conector. Esto **no** ejecuta PostgreSQL ni reemplaza las mutaciones aisladas del autor.

```bash
cat > /tmp/cc047-review-r2.mjs <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const base = {
  migration: read('supabase/migrations/20261108020000_cc047_admin_hardening.sql'),
  sql: read('supabase/tests/cc047_admin_hardening.sql'),
  js: read('supabase/tests/integration/cc031_profile_concurrency.mjs'),
};
const checks = {
  H01: x => /create policy rate_limits_select_admin on public.rate_limits\s+for select to authenticated\s+using\s*\(false\)/i.test(x.migration)
      && /pg_temp\.count_as\(pg_temp\.admin\(\), 'aal2', \$q\$select 1 from public\.rate_limits/.test(x.sql)
      && /select public\.submit_offer/.test(x.sql),
  H02: x => /from pg_policies\s+where schemaname = 'public' and cmd <> 'SELECT'/.test(x.sql)
      && /coalesce\(qual, ''\)[\s\S]{1,100}app_private\[.\]is_admin/.test(x.sql),
  H03: x => ['insert into storage.objects', 'update storage.objects', 'delete from storage.objects']
      .every(s => x.sql.includes(s)) && /admin aal2 no (sube|renombra|borra) objetos/.test(x.sql),
  H04: x => /adminAdminRace/.test(x.js) && /assert\.equal\(lastBefore, expectedBefore/.test(x.js)
      && /scenarioD\(courierId, adminId\)/.test(x.js)
      && /scenarioE\(courierId, adminId\)/.test(x.js)
      && [...x.migration.matchAll(/\bfor update\s*;/gi)].length >= 2,
  H05: x => /from \(values \('aal1'\), \('aal2'\)\) a\(aal\)\s+cross join \(values \('role', 'merchant', 'admin'\), \('consent_status'/.test(x.sql)
      && /D3 aal1: la cuenta admin edita su teléfono/.test(x.sql)
      && /D3 aal2: la cuenta admin edita su teléfono/.test(x.sql)
      && /register_push_subscription/.test(x.sql),
  H06: x => ['SEC-11 igual', 'SEC-11 distinta', 'SEC-11 reescrita']
      .every(s => x.sql.includes(s))
      && /last_admin_note/.test(x.sql) && /cc047_candidatos/.test(x.sql)
      && !/\bupdate\s+public\.merchants\s+set\s+[\s\S]*?\bnotes\s*=/i.test(
        (x.migration.match(/-- 6\. admin_set_subscription[\s\S]*?-- 7\. Correcciones administrativas/) || [])[0] || ''),
};
for (const [name, test] of Object.entries(checks)) {
  assert.ok(test(base), name + ': baseline debe dar GREEN');
}
console.log('R2 BASE GREEN: H01-H06 6/6');

const mutations = [
  ['H01', x => ({ ...x, sql: x.sql.replace(
    "pg_temp.count_as(pg_temp.admin(), 'aal2', $q$select 1 from public.rate_limits",
    "pg_temp.count_as(pg_temp.admin(), 'aal1', $q$select 1 from public.rate_limits") })],
  ['H02', x => ({ ...x, sql: x.sql.replace(
    "schemaname = 'public' and cmd <> 'SELECT'",
    "schemaname = 'public' and cmd = 'SELECT'") })],
  ['H03', x => ({ ...x, sql: x.sql.replace(
    'delete from storage.objects where bucket_id',
    'select 1 from storage.objects where bucket_id') })],
  ['H04', x => ({ ...x, js: x.js.replace(
    'assert.equal(lastBefore, expectedBefore',
    'assert.equal(expectedBefore, expectedBefore') })],
  ['H05', x => ({ ...x, sql: x.sql.replace(
    "from (values ('aal1'), ('aal2')) a(aal)\ncross join (values ('role'",
    "from (values ('aal1')) a(aal)\ncross join (values ('role'") })],
  ['H06', x => ({ ...x, migration: x.migration.replace(
    'paid_until = p_paid_until\n  where profile_id',
    'paid_until = p_paid_until,\n    notes = p_notes\n  where profile_id') })],
];
for (const [name, mutate] of mutations) {
  const changed = mutate(base);
  assert.notDeepEqual(changed, base, name + ': mutacion no aplicada');
  assert.equal(checks[name](changed), false, name + ': mutacion escapo del ORACLE ESTATICO');
  console.log(name + ': RED ESTATICO');
}
console.log('6/6 mutaciones independientes detectadas. No es pgTAP.');
JS
node --check /tmp/cc047-review-r2.mjs
node /tmp/cc047-review-r2.mjs
```

**Salida obtenida al ejecutar la lógica en memoria sobre las tres fuentes de `511940aa`:**

```text
baseline: H01=true, H02=true, H03=true, H04=true, H05=true, H06=true
mut1_erase_aal2: H01=false; otros true
mut2_weaken_catalog: H02=false; otros true
mut3_drop_storage_delete: H03=false; otros true
mut4_weaken_js: H04=false; otros true
mut5_drop_aal2_d3: H05=false; otros true
mut6_backfill: H06=false; otros true
```

El harness comprueba **presencia textual de guardas y oráculos**, no prueba que la base implemente RLS; para esa propiedad se cruzó el log `db-tests` y las mutaciones runtime del autor. Tampoco detecta SQL dinámico no textual en backfill; inspección manual completa de la migración sigue siendo necesaria.

## H07: una mutación INDEPENDIENTE que no está cubierta (ANÁLISIS, no se ejecutó CI)

```sql
create policy rate_limits_insert_any on public.rate_limits
  for insert to authenticated with check (true);
```

Control estático ejecutado contra el `SHA 511940aa` (mutación en memoria, sin tocar repo):
- Baseline: la migración tiene `FOR SELECT ... USING(false)` y **cero** policies no-SELECT sobre `rate_limits`.
- Mutante: mantiene `USING(false)` para SELECT y crea **una** policy `FOR INSERT` sin `is_admin()`.
- El test de catálogo actual `pg_policies...cmd <> 'SELECT' AND (qual || with_check) ~* is_admin` no coincide con esta policy.
- Las dos consultas D01 `count_as(admin,'aal1'|'aal2', subject='cc047')` siguen ejerciendo solo SELECT y no pueden observar ese INSERT permisivo.
- La suite tiene un `INSERT INTO public.rate_limits` en el fixture **superusuario**, pero ningún `pg_temp.run(... INSERT INTO public.rate_limits ...)` como cliente. `SEC-01` solo prueba DELETE directo.
- Por inspección, las aserciones actuales **no prueban la propiedad que rompe esta mutación**. No escribir «CI del mutante quedó GREEN»: no se ejecutó una mutación PostgreSQL de este caso.

**Prueba RED/ GREEN pendiente:** pgTAP `count(*) FROM pg_policies WHERE schemaname='public' AND tablename='rate_limits' AND cmd <> 'SELECT'` esperado 0, más intento explícito de INSERT por `authenticated` con estado superusuario; mutar policy y reportar índice rojo exacto. Si la instalación no otorga INSERT a `authenticated`, el catálogo debe dar RED de todos modos y el autor debe anotarlo, sin fabricar permisos artificiales para declarar un bypass explotable.

## No ejecutado y gates

No se corrió PostgreSQL local, Docker, Supabase remoto, `git merge-tree` ni `pnpm` en el entorno del revisor. No se leyó `.env` ni ningún secreto. La verificación dinámica es la ejecución oficial de CI sobre `511940aa`, que se corroboró leyendo los logs.

Acción humana pendiente: en cada ambiente, consulta `CC-047 `6` de candidatos de notas; resolver sin registrar textos. Luego del merge, migración Develop + tipos y E2E admin `aal2` en staging. `e2e-preview` bloqueado por migración hasta entonces, conforme runbook.
