# Comandos reproducibles — PR #49

Todo contra `3ba9be6`, árbol limpio.

## H01 · El cliente browser no es alcanzable desde cliente

```bash
mkdir -p src/app/zzprobe
cat > src/app/zzprobe/probe.tsx <<'PROBE'
'use client';
import { createClient } from '@/server/supabase/browser';
export function C(){ const c = createClient(); return <div>{String(!!c)}</div>; }
PROBE
npx eslint src/app/zzprobe/probe.tsx --format unix
rm -rf src/app/zzprobe
```

Reporta `cadeapp/client-no-server`. El cliente pensado para el navegador no se puede importar desde el navegador.

## H02 · Estado de `server-only` en la capa

```bash
for f in src/server/*.ts src/server/supabase/*.ts; do
  printf "  %-40s %s\n" "$f" "$(head -1 "$f" | grep -q server-only && echo SI || echo NO)"
done
```

`env.ts` y `admin.ts` → SI. `server.ts` y `browser.ts` → NO.

Y no hay control que lo exija:

```bash
grep -rn "server-only" .eslintrc.json tools/eslint-plugin-cadeapp/index.js   # sin resultados
```

## H03 · Script citado que no existe

```bash
grep -n "test:db" docs/onboarding.md
node -e "console.log(Object.keys(require('./package.json').scripts).join(', '))"
```

El onboarding invoca `pnpm test:db`; los scripts son `dev, build, start, lint, typecheck, test, test:watch, test:coverage, db:types`.

## DoD · No hay claves en el repo

```bash
git diff origin/develop...HEAD \
  | grep -nE "eyJ[A-Za-z0-9_-]{20,}|sbp_|sb_secret|SUPABASE_SERVICE_ROLE_KEY=.|password *= *[\"'][^\"']"
```

Única coincidencia: la palabra «service_role» dentro de un comentario de `admin.ts`. Sin claves.

## A01 · Archivos fuera de alcance

```bash
git diff --name-only origin/develop...HEAD \
  | grep -vE "^(src/server/supabase/|package\.json$|\.env\.example$|docs/onboarding\.md$)"
```

Devuelve `docs/tasks/T-002.md`, `docs/tasks/log/T-002.md` y `supabase/config.toml`.

## Batería completa

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test
```

`typecheck` exit 0 · `lint` limpio · `test` 61/61 en 8 archivos.

---

# Ronda 3 — `17a0be4`

## Batería del DoD

```bash
pnpm typecheck   # exit 0
pnpm lint        # ✔ No ESLint warnings or errors
pnpm test        # Test Files 8 passed (8) · Tests 65 passed (65)
```

`lint` corre `next lint --dir src --file middleware.ts --max-warnings 0`: el alcance son `src/**` y `middleware.ts`, no la raíz.

## H07 · El CLI declarado no se instala ni existe

```bash
pnpm install --frozen-lockfile --lockfile-only
```

```
 ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
 pnpm-lock.yaml is not up to date with package.json

   Failure reason:
   specifiers in the lockfile don't match specifiers in package.json:
 * 1 dependencies were added: supabase@2.116.0
 * 28 dependencies are mismatched:
   - @supabase/ssr (lockfile: ^0.5.2, manifest: 0.5.2)
   ...
```

exit **1**.

```bash
grep -n "^  supabase:" pnpm-lock.yaml   # (sin coincidencias)
ls -d node_modules/supabase             # No such file or directory
pnpm supabase --version
#  ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "supabase" not found
```

### Separar lo heredado de lo propio

Reproducción aislada con el `package.json` y el `pnpm-lock.yaml` de `origin/develop`, en un directorio temporal:

```bash
mkdir -p $TMP/lockdev
git show origin/develop:package.json   > $TMP/lockdev/package.json
git show origin/develop:pnpm-lock.yaml > $TMP/lockdev/pnpm-lock.yaml
cd $TMP/lockdev && pnpm install --frozen-lockfile --lockfile-only
```

exit **1**, con los 28 desalineados y **sin** la línea de `supabase@2.116.0`. Conclusión: los 28 vienen de T-000 (mergeado en la #47, se me pasó); el motivo 29 lo agrega esta PR.

## H08 · `db:types` trunca los tipos commiteados

```bash
ls -la src/types/database.types.ts   # 405 bytes
pnpm db:types
```

```
> supabase gen types typescript --project-id cadeapp-staging > src/types/database.types.ts
"supabase" no se reconoce como un comando interno o externo
 ELIFECYCLE  Command failed with exit code 1
```

```bash
ls -la src/types/database.types.ts   # 0 bytes
git status --porcelain               #  M src/types/database.types.ts
git checkout -- src/types/database.types.ts   # restaurado, árbol limpio
```

El comando falló y el archivo se perdió igual: `>` trunca antes de ejecutar.

## H06 · No hay CI y T-003 no se compromete al drift

```bash
ls .github/workflows                 # No such file or directory
grep -rn "drift" docs/*.md docs/tasks/*.md
```

Tres coincidencias, las tres prometiendo la validación:

```
docs/implementation-plan.md:276   (fila T-002)
docs/onboarding.md:23             en presente, sobre un ci.yml inexistente
docs/tasks/T-002.md:31            con el [x] puesto
```

El DoD de T-003 (`docs/implementation-plan.md:277`) dice «Un PR con error de tipos queda bloqueado» — eso es `tsc`, no drift de `database.types.ts`.

## H10 · La vinculación remota no está en ningún lado

```bash
grep -rn "supabase link\|project-ref\|project_ref" docs/ package.json supabase/ .env.example
# (NINGUNA aparición)

find supabase -type f
# supabase/AGENTS.md
# supabase/config.toml
```

## H04 · `config.toml` sí entró a la ficha

```bash
grep -c "supabase/config.toml" docs/tasks/T-002.md                  # 1
grep -n "^| T-002 " docs/implementation-plan.md | grep -c "config.toml"  # 1
```

En la ronda 2 el mismo `grep` sobre la celda de la ficha daba **0**, con el hallazgo marcado `arreglado-verificado`.

## A01 · Alcance, contrastado contra la ficha

Script que filtra el diff contra los once patrones de «Archivos permitidos»:

```
BASE: 9f03018
archivos cambiados: 16
  OK  .eslintrc.json                                         OK  src/server/supabase/clients.test.ts
  OK  docs/implementation-plan.md                             OK  src/server/supabase/server.ts
  OK  docs/onboarding.md                                      OK  supabase/config.toml
  OK  docs/tasks/T-002.md                                     OK  tools/eslint-plugin-cadeapp/index.js
  OK  docs/tasks/log/T-002.md                                 OK  tools/lint-fixtures/client-browser-supabase-consumer.tsx
  OK  package.json                                            OK  tools/lint-fixtures/server-with-server-only.ts
  OK  src/lib/supabase/browser.ts                             OK  tools/lint-fixtures/server-without-server-only.ts
  OK  src/server/supabase/admin.ts                            OK  tools/verify-scaffold.test.ts

FUERA DE ALCANCE: 0 (ninguno)
```

## H09 · Documentación del CLI consultada

Referencia oficial del CLI de Supabase:

| Comando | Flag | Qué dice |
|---|---|---|
| `gen types` | `--project-id <string>` | *Generate types from a project ID* |
| `gen types` | `--linked` | *Generate types from the linked project* |
| `link` | `--project-ref <string>` | *Project ref of the Supabase project* |
| `stop` | `--project-id <string>` | *Local project ID to stop* |
| `init` | — | *«A `supabase/config.toml` file is created… This configuration is specific to each local project»* |
| `status` | — | *«Requires the local development stack to be started by running `supabase start`»* |

La última fila es lo que sostiene H03 y H11: `pnpm supabase status`, que el onboarding sigue citando, necesita el stack local.
