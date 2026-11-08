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
