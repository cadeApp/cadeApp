# Evidencia reproducible — PR #542, SHA `204402e2aa8075d5fc405e62ce121af0c89030be`

## Comprobado mediante GitHub (sin ejecución local)

- Run `39882160536`, job unit `120181801369`: `Test Files 177 passed (177)`, `Tests 3361 passed (3361)`.
- En mismo run: typecheck/lint/build/audit/bundle-budget: success; db-tests seguía en progreso.
- En `b57f57f`, run `39877476741`, job db-tests `120166492176`: `cc040_announcements.sql ... ok`, `rls_enabled.sql ... ok`, `Files=39, Tests=3201, Result: PASS`, comparación `database.types.ts` exit 0.
- La PR #543 está cerrada sin mergear, bajo rótulo REVIEW ONLY / NEVER MERGE.
- `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` ejecutado aquí → `Could not resolve host: github.com`; sin clon ni worktree, **no ejecuté mutaciones propias**, `git merge-tree`, E2E ni DB local. No se inventan salidas.

## H05 · pgTAP: ejemplos concretos a incorporar

```sql
select is(pg_temp.err(pg_temp.call(pg_temp.u(2), 'aal1',
  'select public.admin_list_announcements(null, null, 20)')),
  'UNAUTHORIZED_ACTOR', 'merchant no lista anuncios');
select is(pg_temp.err(pg_temp.call(pg_temp.u(1), 'aal1',
  'select public.admin_list_announcements(null, null, 20)')),
  'AAL2_REQUIRED', 'admin aal1 no lista anuncios');
select is(pg_temp.err(pg_temp.call(null, 'aal2',
  'select public.admin_list_announcements(null, null, 20)')),
  'UNAUTHENTICATED', 'sin sesión no lista anuncios');
```

Repetir los tres perfiles para las cuatro RPC admin con argumentos válidos; para `get_my_announcement`, `dismiss_announcement`, `set_promotions_opt_in` cubrir no sujeto, admin/actor equivocado y consentimiento inactivo pertinente. Ejecutar la **mutación de guard** en PR temporal aislada `REVIEW ONLY / NEVER MERGE`: suprimir exclusivamente `perform app_private.assert_admin_aal2();` dentro de `public.admin_list_announcements` y confirmar RED del caso nuevo. Restaurar por completo para GREEN. No sirve RED por ausencia de tablas ni por SQL inválido.

## H06 · Batería propia: harness de mutación para ejecutar después del arreglo

Guardar literalmente como `/tmp/pr542-mut-h06.mjs` y ejecutar desde worktree limpio, con dependencias. **No ejecutado por este revisor**; el control BASE debe ser verde, la mutación roja y luego verde restaurado.

```js
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const path = 'src/server/push/sender.ts';
const original = fs.readFileSync(path, 'utf8');
const needle = 'const PUSH_BATCH_SIZE = 10;';
if (original.split(needle).length !== 2) throw Error('objetivo de mutación ausente o ambiguo');
const check = () => spawnSync('pnpm',
  ['exec', 'vitest', 'run', 'src/server/push/announcements.test.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32' }).status;
if (check() !== 0) throw Error('BASE debe ser GREEN');
try {
  fs.writeFileSync(path, original.replace(needle, 'const PUSH_BATCH_SIZE = 11;'));
  if (check() === 0) throw Error('CONTROL CIEGO: mutación no capturada');
  console.log('RED: límite 11 rechazado');
} finally {
  fs.writeFileSync(path, original);
}
if (check() !== 0) throw Error('restauración no GREEN');
console.log('GREEN: árbol restaurado');
```

El test debe fallar por `maxInFlight`, **no** por fallo de imports, mocks o `TypeError`. Script restaurable por `finally` en memoria, nunca `git checkout`.

## Comandos de reproducción

```bash
git fetch origin
git status --short
git diff origin/develop...HEAD --name-only
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck && pnpm lint && pnpm test:coverage
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-414-announcements
```

DB: leer log de `db-tests` en CI, exigir `Files=`, `Tests=`, `Result:`, `cc040_announcements.sql`, `rls_enabled.sql`, tipos generados y comparación `git diff --exit-code`. **No levantar Supabase ni Docker local**.
