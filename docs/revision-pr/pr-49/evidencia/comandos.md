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
