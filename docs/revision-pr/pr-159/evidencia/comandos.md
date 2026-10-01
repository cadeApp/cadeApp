# Evidencia reproducible — PR #159 / ronda 1

**SHA revisado:** `680511dc625ce3fec4a65e0b7268a3a7a955512e`

## 1. Sincronización y alcance

Consulta equivalente contra GitHub:

```text
base: develop
head: feat/T-321-admin-staging-bootstrap
status: ahead
ahead_by: 3
behind_by: 0
merge_base: 9e232d0e4ef003ca0535b11e5a962b4cf603189a
PR mergeable: true
```

Archivos del diff antes de la revisión:

```text
docs/tasks/log/T-321.md
src/features/admin/queries.test.ts
src/features/admin/queries.ts
supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql
supabase/tests/t321_admin_staging_bootstrap.sql
```

El mismo nombre de migración consultado en `develop` devolvió 404: no había colisión.

## 2. Enumeración completa de embeds de profiles

Barrido sobre `src/features/admin/queries.ts` del SHA revisado:

```text
profiles!couriers_profile_id_fkey      # getApplicantsQueue
profiles!couriers_profile_id_fkey      # getApplicantDetail
profiles!merchants_profile_id_fkey     # getAdminMerchants
profiles!audit_log_actor_id_fkey       # AUDIT_SELECT
```

No quedaron `profiles:profile_id` ni `profiles:actor_id`.

Los nombres se cruzaron contra `src/types/database.types.ts`, donde existen:

```text
couriers_profile_id_fkey
merchants_profile_id_fkey
audit_log_actor_id_fkey
```

## 3. RED real previo de los embeds

Commit anterior a la implementación: `118042c3eaceb0a18ac9380168e389a2e584c024`.

Job unit de CI, resumen reproducido del log:

```text
Test Files  1 failed | 107 passed (108)
Tests       5 failed | 1520 passed (1525)
```

Las cinco fallas eran las cinco aserciones T-321 contra los embeds ambiguos.

## 4. CI del SHA revisado

Run: `36803697869`.

Jobs observados: build, audit, db-tests, lint, typecheck, unit y bundle-budget: todos `success`.

Resumen del job `db-tests`:

```text
Applying migration 20260930224700_t321_admin_staging_bootstrap.sql...
Seeding data from supabase/seed.sql...
...
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
All tests successful.
Files=13, Tests=1612
Result: PASS
```

Esta secuencia es la evidencia de que las aserciones del archivo T-321 se ejecutan después de que `seed.sql` puede reponer esos mismos defaults.

## 5. Batería independiente de mutaciones para PR159-H01

Por decisión del proyecto no se levantó Supabase/Docker local. Para SQL, la ronda deja la mutación como **inspección + CI verde**, con un arnés estático independiente. El arnés no modifica el checkout: muta copias en memoria.

Copiar como `/tmp/pr159-mutations.mjs` y ejecutar desde el root del repo:

```bash
node /tmp/pr159-mutations.mjs .
```

Contenido completo:

```js
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? process.cwd();
const migrationPath = path.join(
  root,
  'supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql'
);
const seedPath = path.join(root, 'supabase/seed.sql');
const testPath = path.join(root, 'supabase/tests/t321_admin_staging_bootstrap.sql');

const migration = fs.readFileSync(migrationPath, 'utf8');
const seed = fs.readFileSync(seedPath, 'utf8');
const test = fs.readFileSync(testPath, 'utf8');

const keys = [
  'min_offer_ars',
  'request_ttl_minutes',
  'pilot_active',
  'pilot_terms_version',
  'subscription_grace_days',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  keys.every((key) => migration.includes("'" + key + "'")),
  'baseline: migration does not contain all 5 defaults'
);
assert(
  /on\s+conflict\s*\(key\)\s*do\s+nothing/i.test(migration),
  'baseline: migration does not contain ON CONFLICT DO NOTHING'
);
assert(
  keys.every((key) => seed.includes("'" + key + "'")),
  'fixture: seed does not contain all 5 defaults'
);

// M01: rompe la garantía principal eliminando el INSERT de la migración.
const m01 = migration.replace(
  /insert into public\.platform_settings[\s\S]*?do nothing;/i,
  '-- MUTATION M01: migration defaults removed'
);
assert(
  keys.some((key) => !m01.includes("'" + key + "'")),
  'M01 failed to break the migration property'
);
assert(
  keys.every((key) => seed.includes("'" + key + "'")),
  'M01: seed does not mask all defaults'
);
console.log(
  'M01 CONTROL_CIEGO: removing the migration insert still leaves the 5 values supplied by seed.sql to the current pgTAP.'
);

// M02: rompe la no-sobrescritura en la migración.
const m02 = migration.replace(
  /on\s+conflict\s*\(key\)\s*do\s+nothing;/i,
  'on conflict (key) do update set value = excluded.value;'
);
assert(/do\s+update/i.test(m02), 'M02 failed to break the migration property');
assert(
  /on\s+conflict\s*\(key\)\s*do\s+nothing/i.test(test),
  'M02: current test does not contain its own DO NOTHING'
);
assert(
  !test.includes('20260930224700_t321_admin_staging_bootstrap.sql'),
  'M02: current pgTAP unexpectedly re-runs the migration file'
);
console.log(
  'M02 CONTROL_CIEGO: changing the migration to DO UPDATE is not exercised by assertion 11, which tests a new DO NOTHING written inside the test.'
);

console.log('BASELINE_ESTRUCTURAL_OK');
```

Salida obtenida copiando el arnés a `/tmp` y ejecutándolo contra una fixture con los tres archivos exactos relevantes del SHA revisado:

```text
M01 CONTROL_CIEGO: removing the migration insert still leaves the 5 values supplied by seed.sql to the current pgTAP.
M02 CONTROL_CIEGO: changing the migration to DO UPDATE is not exercised by assertion 11, which tests a new DO NOTHING written inside the test.
BASELINE_ESTRUCTURAL_OK
```

## 6. Mutaciones que debe matar el arreglo

El arreglo de H01 no se considera completo hasta demostrar estas dos roturas sin editar el archivo real:

- **M01:** sobre una copia en memoria, eliminar el bloque `INSERT INTO public.platform_settings ... ON CONFLICT ... DO NOTHING`. El nuevo control debe fallar.
- **M02:** sobre una copia en memoria, reemplazar el `DO NOTHING` de la migración por `DO UPDATE SET value = excluded.value`. El nuevo control debe fallar.

Y antes del control de fuente, CI debe ejecutar el pgTAP de T-321 sobre una base reconstruida con migraciones pero **sin seed**.

Supabase CLI admite `supabase test db [path]`, por lo que el flujo objetivo del job es:

```bash
pnpm supabase start
pnpm supabase db reset --no-seed
pnpm supabase test db supabase/tests/t321_admin_staging_bootstrap.sql
pnpm supabase db reset
pnpm supabase test db
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
```

El segundo `db reset` restaura el comportamiento local normal con seed antes de la suite completa.

## 7. Decisiones

- **D01=A:** ampliar alcance a `.github/workflows/ci.yml` para aislar el pgTAP sin seed y agregar el control auto-mutado de la migración.
- **D02=A:** evidencia AAL2 real post-merge/post-promoción `develop → staging`; no aplicar manualmente la migración remota.
