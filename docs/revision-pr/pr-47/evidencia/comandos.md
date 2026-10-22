# Comandos reproducibles — PR #47

Cada bloque reproduce un hallazgo. Todos se corrieron contra el repo en el SHA indicado, con el árbol limpio, y **borran lo que crean**.

> Los probes se crean y se borran en el mismo bloque. Si interrumpís uno a la mitad, revisá `git status` antes de seguir: un `src/app/*probe*` olvidado rompe todos los builds siguientes.

---

## H01 · `publicEnv` en el navegador

```bash
mkdir -p src/app/envprobe
cat > src/app/envprobe/probe.tsx <<'EOF'
'use client';
import { publicEnv } from '@/lib/env.public';
export function Probe() { return <div data-probe={publicEnv.NEXT_PUBLIC_APP_URL}>probe</div>; }
EOF
cat > src/app/envprobe/page.tsx <<'EOF'
import { Probe } from './probe';
export default function P() { return <Probe />; }
EOF
NEXT_PUBLIC_APP_URL=https://probe-marker.example.com npx next build
grep -rl "probe-marker" .next/static/chunks/
rm -rf src/app/envprobe
```

- **En `f71d858` (roto):** el `grep` no devuelve nada. Con `next start` y la página abierta, la consola muestra `Error: ❌ Error en variables de entorno públicas (cliente)` y `Minified React error #423`.
- **En `d026834` (arreglado):** devuelve `.next/static/chunks/app/envprobe/page-*.js`.

La carpeta **no** puede empezar con `_`: en el App Router eso la vuelve privada y nunca se enruta.

---

## H02, H06, H07 · Reglas del plugin

```bash
mkdir -p tools/lint-fixtures/_p
cat > tools/lint-fixtures/_p/a-comment.tsx <<'EOF'
// Encabezado de licencia
'use client';
import { serverEnv } from '@/server/env';
export function C() { return <div>{serverEnv.NODE_ENV}</div>; }
EOF
cat > tools/lint-fixtures/_p/b-reexport.tsx <<'EOF'
'use client';
export * from '@/server/env';
EOF
cat > tools/lint-fixtures/_p/e-next-server.tsx <<'EOF'
'use client';
import type { NextRequest } from 'next/server';
export type T = NextRequest;
EOF
cat > tools/lint-fixtures/_p/f-dynamic.tsx <<'EOF'
'use client';
export async function load() { return await import('@/server/env'); }
EOF
npx eslint tools/lint-fixtures/_p --ext .ts,.tsx --format unix
rm -rf tools/lint-fixtures/_p
```

| Fixture | `f71d858` | `d026834` | Debe |
|---|---|---|---|
| `a-comment` (H02) | sin error | error | reportar |
| `b-reexport` (H06) | sin error | error | reportar |
| `f-dynamic` (H06) | sin error | error | reportar |
| `e-next-server` (H07) | error | sin error | **no** reportar |

---

## H03 · Escala tipográfica

```bash
printf '<div class="text-xs text-sm"></div>' > /tmp/probe-xs.html
npx tailwindcss -i src/app/globals.css -o /tmp/tw.css --content /tmp/probe-xs.html
grep -c "font-size: 14px" /tmp/tw.css   # raíz: debe ser 0
grep -A2 "^\.text-xs" /tmp/tw.css       # debe ser 0.875rem
```

- **`f71d858`:** `html{font-size:14px}` + `.text-xs{0.75rem}` → 10,5px reales.
- **`d026834`:** 0 coincidencias de raíz, `.text-xs{0.875rem}` → 14px sobre raíz 16px.

---

## H04 · Frontera `server-only` real

Carpeta **enrutable** y lint desactivado, para aislar el mecanismo del paso de ESLint:

```bash
mkdir -p src/app/boundary-probe
cat > src/app/boundary-probe/probe.tsx <<'EOF'
'use client';
import { serverEnv } from '@/server/env';
export function Probe() { return <div>{serverEnv.NODE_ENV}</div>; }
EOF
cat > src/app/boundary-probe/page.tsx <<'EOF'
import { Probe } from './probe';
export default function Page() { return <Probe />; }
EOF
npx next build --no-lint; echo "EXIT=$?"
rm -rf src/app/boundary-probe
```

Salida esperada: `exit 1` y

```
x You're importing a component that needs server-only.
 ,-[src/server/env.ts:1:1]
```

Con `src/app/__boundary_probe__` (guion bajo, como en el test actual) el build muestra `✓ Compiled successfully` y solo falla en ESLint: el mecanismo nunca se toca.

---

## H05, H08 · Paquetes y entry-point

```bash
mkdir -p tools/lint-fixtures/_p
printf "import get from 'lodash/get';\nimport dayjs from 'dayjs';\nexport const x = [get, dayjs];\n" > tools/lint-fixtures/_p/d-subpath.ts
printf "import { exampleItemSchema } from '@/features/_template/schemas';\nexport const s = exampleItemSchema;\n" > tools/lint-fixtures/_p/c-deep.ts
npx eslint tools/lint-fixtures/_p --ext .ts --format unix
rm -rf tools/lint-fixtures/_p
```

- **`f71d858`:** ninguno reporta.
- **`d026834`:** `lodash/get` reporta por `patterns`; el import profundo de `schemas` reporta `boundaries/entry-point`. `dayjs` sigue sin reportar por ESLint — lo cubre `tools/verify-approved-packages.test.ts`.

---

## H10 · Alcance del lint

```bash
cp middleware.ts /tmp/mw.bak
printf "import axios from 'axios';\nexport const config = { matcher: ['/'] };\nexport function middleware() { return axios; }\n" > middleware.ts
npx next lint --dir src --file middleware.ts --max-warnings 0
cp /tmp/mw.bak middleware.ts
```

- **`f71d858`** (script `next lint` a secas): `✔ No ESLint warnings or errors`.
- **`d026834`:** reporta el import de `axios`.

`ESLINT_DEFAULT_DIRS` está en `node_modules/next/dist/lib/constants.js`: `["app","pages","components","lib","src"]`. La raíz queda fuera salvo que se pase `--file`.

---

## H11 · Server Action desde cliente

```bash
mkdir -p src/app/actionprobe
cat > src/app/actionprobe/probe.tsx <<'EOF'
'use client';
import { createExampleAction } from '@/features/_template';
export function F() {
  async function onSubmit(fd: FormData) { await createExampleAction({ name: String(fd.get('n')) }); }
  return <form action={onSubmit}><input name="n" /><button>ok</button></form>;
}
EOF
cat > src/app/actionprobe/page.tsx <<'EOF'
import { F } from './probe';
export default function P() { return <F />; }
EOF
npx eslint src/app/actionprobe --ext .tsx --format unix
npx next build --no-lint
rm -rf src/app/actionprobe
```

En `d026834`: lint sin errores y la ruta `/actionprobe` compila (13.4 kB).

---

## R01 · Regresión de la denylist en features

Es el único caso que necesita **comparar dos configuraciones**, porque una regresión no se distingue de un hueco preexistente mirando solo el estado actual:

```bash
mkdir -p src/features/_template/components
printf "import axios from 'axios';\nexport const x = axios;\n" > src/features/_template/components/zz.tsx

cp .eslintrc.json /tmp/eslintrc-new.json
git show f71d858:.eslintrc.json > .eslintrc.json
echo "--- ANTES (f71d858) ---"; npx eslint src/features/_template/components/zz.tsx --format unix

cp /tmp/eslintrc-new.json .eslintrc.json
echo "--- DESPUES (d026834) ---"; npx eslint src/features/_template/components/zz.tsx --format unix

rm -f src/features/_template/components/zz.tsx
git status --porcelain   # debe quedar limpio
```

- **Antes:** `'axios' import is restricted from being used.` → 1 problem.
- **Después:** sin salida.

### Residual de H09 (mismo bloque)

```bash
printf "import { serverEnv } from '@/server/env';\nexport const k = serverEnv.NODE_ENV;\n" > src/features/_template/zz.ts
npx eslint src/features/_template/zz.ts --format unix   # sin salida = hueco
rm -f src/features/_template/zz.ts
```

---

## Batería completa

```bash
rm -rf .next   # los artefactos de los probes anteriores ensucian el typecheck
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

En `d026834`: typecheck `exit 0`, lint limpio, 23/23 tests en 6 archivos, build con 87,2 kB de First Load JS en `/`.

Si `tsc` se queja de un `.next/types/app/<algo>probe/page.ts`, es basura de un probe borrado: `rm -rf .next` y repetir.
