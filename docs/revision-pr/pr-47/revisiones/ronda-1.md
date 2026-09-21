# Informe de revisión — PR #47 / T-000

**PR:** https://github.com/cadeApp/cadeApp/pull/47
**Head SHA revisado:** `f71d8582471991b6101c1035cb73702ae446ca85`
**Base:** `develop` @ `42fd11fbf2a10ee53aa4fb99f3b813639973912a`
**Fecha de revisión:** 2026-09-20
**Alcance:** 40 archivos, +6620 líneas (excluido `pnpm-lock.yaml` del análisis línea por línea)

---

## Cómo leer este informe

Cada hallazgo trae **Diagnóstico** (qué está mal), **Evidencia** (cómo se comprobó, no es inferencia) y **Arreglo** (código concreto). Los hallazgos marcados `[VERIFICADO]` se reprodujeron ejecutando comandos contra este head SHA exacto; los marcados `[ANÁLISIS]` se derivaron leyendo el código y las reglas del repo sin ejecución dedicada.

Los checks de la descripción del PR (`typecheck`, `lint`, `test`, `build` verdes) son **ciertos** — los volví a correr. El problema es que tres de los controles que la ficha T-000 define como su razón de ser pasan en verde sin ejercer lo que dicen ejercer (hallazgos 2, 4, 5, 6, 8, 10). Ver la sección *Por qué los checks verdes no alcanzan*.

**Antes de arreglar nada, leé la sección `NO TOCAR`**: hay cuatro cosas que parecen defectos y no lo son. Ya las verifiqué.

---

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| 1 | 🔴 Crítico | `src/lib/env.public.ts:39` | `publicEnv` siempre lanza en el navegador | Bug |
| 2 | 🟠 Alto | `tools/eslint-plugin-cadeapp/index.js:16` | Un comentario antes de `'use client'` desactiva la regla | Bug |
| 3 | 🟠 Alto | `src/app/globals.css:13` | `font-size:14px` invierte la cláusula Anti-12px | Bug |
| 4 | 🟠 Alto | `tools/verify-scaffold.test.ts:44` | El test de `server-only` es tautológico | Test |
| 5 | 🟠 Alto | `.eslintrc.json:107` | Denylist de paquetes donde el DoD pide allowlist | Bug |
| 6 | 🟡 Medio | `tools/eslint-plugin-cadeapp/index.js:34` | La regla ignora `export * from` e `import()` | Bug |
| 7 | 🟡 Medio | `tools/eslint-plugin-cadeapp/index.js:44` | `includes('/server')` bloquea `next/server` | Bug |
| 8 | 🟡 Medio | `.eslintrc.json:100` | `entry-point` no cubre `schemas.ts`, `copy.ts`, `query-keys.ts` | Bug |
| 9 | 🟡 Medio | `.eslintrc.json:79` | `boundaries` permite `feature`→`server` desde cualquier archivo | Bug |
| 10 | 🟡 Medio | `.eslintrc.json:11` + `package.json:14` | `middleware.ts` nunca se lintea | Bug |
| 11 | 🟡 Medio | `src/features/_template/server.ts:4` | Las Server Actions del template son inalcanzables | Bug |
| 12 | 🟡 Medio | `src/features/_template/hooks/use-example.ts:9` | `queryKey` fijo ignora `initialData` | Bug |
| 13 | 🟡 Medio | `src/app/layout.tsx:23` | `maximumScale:1` bloquea el zoom de pellizco | A11y |
| 14 | 🔵 Decisión | `middleware.ts:3` | La ficha pide `middleware.ts` vacío | Alcance |
| 15 | 🔵 Decisión | `package.json:19` | Rangos caret donde el plan pide versiones exactas | Convención |

**Orden sugerido de trabajo:** 1 → 3 → 13 (bugs de producto) → 2, 6, 7 (el plugin, de una sola pasada) → 5, 8, 9, 10 (config de ESLint, de una sola pasada) → 4 (test) → 11, 12 (template) → 14, 15 (consultar a Lautaro073 primero).

---

## 1. 🔴 `publicEnv` lanza siempre en el navegador

**Archivo:** `src/lib/env.public.ts:37-42`
**Estado:** `[VERIFICADO]` — reproducido en runtime, no inferido

### Diagnóstico

```ts
export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = createPublicEnv(process.env);   // ← acá
  }
  return cachedPublicEnv;
}
```

Next.js no expone `process.env` al bundle de cliente. Lo que hace es una sustitución textual (webpack `DefinePlugin`) de **expresiones literales** `process.env.NEXT_PUBLIC_X` por su valor. Confirmado en el código instalado, `node_modules/next/dist/build/webpack/plugins/define-env-plugin.js:34-44`:

```js
function getNextPublicEnvironmentVariables() {
    const defineEnv = {};
    for (const key in process.env) {
        if (key.startsWith("NEXT_PUBLIC_")) {
            const value = process.env[key];
            if (value != null) {
                defineEnv[`process.env.${key}`] = value;   // ← sólo claves completas
            }
        }
    }
    return defineEnv;
}
```

No existe ninguna definición del identificador `process.env` a secas. Como `env.public.ts` nunca escribe `process.env.NEXT_PUBLIC_APP_URL` como expresión literal —pasa el objeto entero por referencia— **no se inlinea ni un solo valor**. En el navegador el shim de `process.env` llega vacío, Zod falla y `createPublicEnv` lanza.

### Evidencia

Creé una ruta de prueba `src/app/envprobe/` con un Client Component que lee `publicEnv.NEXT_PUBLIC_APP_URL`, y compilé con la variable correctamente definida:

```
NEXT_PUBLIC_APP_URL=https://probe-marker.example.com npx next build
✓ Compiled successfully
└ ƒ /envprobe    14.4 kB    102 kB
```

El build pasa. Pero:

```
grep -rl "probe-marker" .next/static/chunks/     → (vacío: el valor NO viaja al cliente)
grep -rl "NEXT_PUBLIC_APP_URL es obligatoria" .next/static/chunks/
  → .next/static/chunks/app/envprobe/page-bcbadd70f29bb0e0.js
```

Es decir: el **mensaje de error** sí se envía al cliente, el **valor** no. El chunk minificado contiene el schema Zod entero y la llamada al Proxy:

```js
let t=o.Ry({NEXT_PUBLIC_APP_URL:o.Z_({required_error:"NEXT_PUBLIC_APP_URL es obligatoria"})...
...function l(){return(0,n.jsx)("div",{"data-probe":P.NEXT_PUBLIC_APP_URL,children:"probe"})}
```

Levanté el build con `next start -p 3457` y abrí `/envprobe` en un navegador real. La respuesta HTTP es 200 (el SSR funciona, porque en el servidor `process.env` sí existe), pero la consola del navegador muestra:

```
Error: ❌ Error en variables de entorno públicas (cliente):
  - NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL es obligatoria
  ...Revisá .env.local o configurá las variables en el entorno de despliegue.
Uncaught Error: Minified React error #423    ← fallo de hidratación
```

Con la variable **correctamente configurada**, todo componente cliente que lea `publicEnv` revienta y tira abajo la hidratación de React.

### Por qué el build está verde igual

Hoy **nada** consume `getPublicEnv()`. El único consumidor es `src/server/env.test.ts:3`, que llama a `createPublicEnv(objetoLiteral)` pasando un objeto de prueba explícito — nunca ejerce el camino de `process.env`. El módulo explota recién cuando T-002 (clientes Supabase) o T-009 (auth) lo consuman desde cliente.

### Arreglo

Construir un objeto literal para que `DefinePlugin` pueda sustituir cada acceso. **Cada clave tiene que escribirse como `process.env.NEXT_PUBLIC_X` literal** — no vale un bucle, ni destructuring, ni indexado dinámico.

```ts
// src/lib/env.public.ts
let cachedPublicEnv: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    // IMPORTANTE: cada acceso debe ser una expresión literal `process.env.NEXT_PUBLIC_*`
    // para que el DefinePlugin de Next lo sustituya en el bundle de cliente.
    // NO reemplazar por un bucle ni por destructuring: rompe el inlineado.
    cachedPublicEnv = createPublicEnv({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      NEXT_PUBLIC_ENABLE_MOCK_MAPS: process.env.NEXT_PUBLIC_ENABLE_MOCK_MAPS,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
  return cachedPublicEnv;
}
```

Cada vez que se agregue una variable a `publicEnvSchema` hay que agregarla también acá. Para que eso no se olvide en silencio, conviene un test que compare las claves del schema con las del objeto:

```ts
// src/lib/env.public.test.ts
import { describe, expect, it } from 'vitest';
import { publicEnvSchema, getPublicEnv } from './env.public';

it('getPublicEnv mapea todas las claves del schema', () => {
  const claves = Object.keys(publicEnvSchema.shape);
  const fuente = getPublicEnv.toString();
  for (const clave of claves) {
    expect(fuente, `falta process.env.${clave} en getPublicEnv`).toContain(`process.env.${clave}`);
  }
});
```

### Cómo verificar el arreglo

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
grep -rl "probe-marker" .next/static/chunks/   # DEBE devolver al menos un archivo
rm -rf src/app/envprobe
```

Si el `grep` no devuelve nada, el arreglo no funcionó.

### Nota adicional (mismo archivo, menor)

El `Proxy` de `src/lib/env.public.ts:44` y el de `src/server/env.ts:48` sólo implementan la trampa `get`. Eso significa que `Object.keys(publicEnv)` devuelve `[]`, `{...publicEnv}` da `{}` y `JSON.stringify(publicEnv)` da `{}`. Si algún día se loguea o serializa el objeto de env, va a aparecer vacío sin ningún error. Si se quiere cerrar, agregar trampas `ownKeys` y `getOwnPropertyDescriptor`; si no, documentar que sólo se accede por propiedad.

---

## 2. 🟠 Un comentario antes de `'use client'` desactiva la regla de frontera

**Archivo:** `tools/eslint-plugin-cadeapp/index.js:12-33`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```js
const hasDirective =
  node.directives &&                                     // ← no existe en espree
  node.directives.some(...);

const text = sourceCode ? sourceCode.getText() : '';
const leadingCommentOrStatement = text.trimStart();      // ← el nombre delata el bug

if (
  hasDirective ||
  leadingCommentOrStatement.startsWith("'use client'") ||
  leadingCommentOrStatement.startsWith('"use client"')
) {
  isClient = true;
}
```

Dos problemas encadenados:

1. `node.directives` es una extensión del AST de **Babel**. ESLint usa ESTree/espree, donde `Program` no tiene propiedad `directives` — las directivas viven en `node.body` como `ExpressionStatement` con la marca `.directive`. Entonces `hasDirective` es siempre `undefined` (falsy) y la detección real nunca corre.
2. El fallback es textual: `text.trimStart().startsWith("'use client'")`. Sólo funciona si la directiva es lo primerísimo del archivo. **Cualquier comentario previo la rompe** — la variable se llama `leadingCommentOrStatement` pero justamente no contempla el comentario.

Esta regla es el **único** control que implementa el DoD (b) de T-000. `boundaries/element-types` no cubre el caso: el elemento `feature` tiene permitido importar `server` (ver hallazgo 9) y los fixtures son de tipo `fixture`, también con `server` permitido.

### Evidencia

Fixture con comentario antes de la directiva:

```tsx
// Encabezado de licencia antes de la directiva
'use client';

import { serverEnv } from '@/server/env';

export function C() { return <div>{serverEnv.NODE_ENV}</div>; }
```

```
npx eslint tools/lint-fixtures/_probe --ext .ts,.tsx
→ (ningún error)
```

El **mismo archivo sin el comentario inicial** sí se reporta:

```
f-no-comment.tsx:2:1: Violación de frontera arquitectónica: ... [Error/cadeapp/client-no-server]
1 problem
```

El contraste aísla la causa: el comentario es el disparador.

### Arreglo

Recorrer el prólogo de directivas en el AST. Los comentarios no aparecen en `node.body`, así que este enfoque es inmune a ellos:

```js
// tools/eslint-plugin-cadeapp/index.js
function tieneDirectivaUseClient(programNode) {
  for (const stmt of programNode.body) {
    // El prólogo de directivas termina en el primer nodo que no es un literal de cadena
    if (stmt.type !== 'ExpressionStatement') break;
    const expr = stmt.expression;
    if (expr.type !== 'Literal' || typeof expr.value !== 'string') break;
    if (expr.value === 'use client') return true;
  }
  return false;
}
```

Y en `create(context)`:

```js
create(context) {
  let isClient = false;
  return {
    Program(node) {
      isClient = tieneDirectivaUseClient(node);
    },
    // ...
  };
}
```

Se puede borrar por completo el fallback textual y la lectura de `getSourceCode()`.

### Fixture obligatorio

El principio 8 del plan («toda prueba nueva se demuestra fallando al romper la regla que prueba») exige un fixture commiteado para este caso. Agregar `tools/lint-fixtures/client-with-comment-importing-server.tsx` con el contenido de la evidencia de arriba, y un test en `tools/verify-scaffold.test.ts` que asserte `cadeapp/client-no-server`.

---

## 3. 🟠 `font-size:14px` invierte la cláusula Anti-12px

**Archivo:** `src/app/globals.css:10-15`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```css
html {
  /* Cláusula Anti-12px (D16): piso tipográfico de lectura a 14px (text-sm) */
  font-size: 14px;
}
```

El comentario dice lo contrario de lo que hace el código. Tailwind define su escala tipográfica en `rem`, que son relativos a la raíz. Bajar la raíz a 14px **reescala toda la escala hacia abajo**:

| Clase | Valor Tailwind | Con raíz 16px (default) | Con raíz 14px (este PR) |
|---|---|---|---|
| `text-xs` | `0.75rem` | 12px | **10,5px** |
| `text-sm` | `0.875rem` | 14px | **12,25px** |
| `text-base` | `1rem` | 16px | 14px |

O sea: `text-sm`, que la cláusula D16 define como el piso de 14px, termina en 12,25px. Y `text-xs` cae a 10,5px.

### Evidencia

Compilé Tailwind contra este mismo `globals.css`:

```
npx tailwindcss -i src/app/globals.css -o /tmp/tw-out.css --content probe.html
```

Salida generada:

```css
html { font-size: 14px; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-xs { font-size: 0.75rem;  line-height: 1rem; }
```

0.875 × 14 = **12,25px**. 0.75 × 14 = **10,5px**.

El propio scaffold ya renderiza texto por debajo del piso:

- `src/app/page.tsx:12` → `<p className="text-muted-foreground text-sm">` = 12,25px
- `src/app/page.tsx:15` → `<div className="... text-xs ...">` = **10,5px**
- `src/features/_template/components/example-card.tsx:13` → `text-xs` = **10,5px**

Efecto secundario adicional: fijar la raíz en `px` anula la preferencia de tamaño de fuente del navegador del usuario. Es un fallo de WCAG 1.4.4 (Resize Text) por sí solo, y se agrava con el hallazgo 13 (`maximumScale: 1`), que además impide el zoom de pellizco. Entre los dos, una persona con baja visión no tiene ninguna vía para agrandar el texto.

### Arreglo

Dejar la raíz en el default del navegador y fijar el piso con la escala, no con la raíz.

```css
/* src/app/globals.css */
@layer base {
  * {
    @apply border-border;
  }
  html {
    /* NO fijar font-size acá: rompe la escala rem y la preferencia del usuario */
    -webkit-tap-highlight-color: transparent;
  }
  body {
    /* Cláusula Anti-12px (D16): piso tipográfico de lectura a 14px */
    @apply bg-background text-foreground text-sm;
    font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
    min-height: 100dvh;
    overflow-x: hidden;
  }
}
```

Y para que el piso no se pueda romper por accidente con `text-xs`, redefinir esa parada de la escala en `tailwind.config.ts`:

```ts
// tailwind.config.ts → theme.extend
fontSize: {
  // Cláusula Anti-12px (D16): ninguna parada de la escala baja de 14px.
  xs: ['0.875rem', { lineHeight: '1.25rem' }],
  sm: ['0.875rem', { lineHeight: '1.25rem' }],
},
```

Con esto `text-xs` deja de ser un agujero, pero lo correcto es además **reemplazar los dos usos existentes** de `text-xs` por `text-sm` en `src/app/page.tsx:15` y `src/features/_template/components/example-card.tsx:13`, para que el template canónico no enseñe el patrón equivocado.

### Cómo verificar

```bash
npx tailwindcss -i src/app/globals.css -o /tmp/tw.css --content src/app/page.tsx
grep -A2 "^html" /tmp/tw.css     # NO debe contener font-size
grep -A2 "\.text-sm" /tmp/tw.css # 0.875rem sobre raíz 16px = 14px ✓
```

---

## 4. 🟠 El test de `server-only` no prueba nada del proyecto

**Archivos:** `tools/verify-scaffold.test.ts:44-51` y `vitest.config.ts:17-21`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```ts
it('DoD: Importar un módulo con server-only desde cliente rompe en tiempo de ejecución/build', async () => {
  expect(() => {
    const serverOnlyPath = path.resolve('node_modules/server-only/index.js');
    require(serverOnlyPath);
  }).toThrowError(/This module cannot be imported from a Client Component module/);
});
```

El test carga el archivo del paquete de terceros y comprueba que lanza. El contenido completo de `node_modules/server-only/index.js` es:

```js
throw new Error(
  "This module cannot be imported from a Client Component module. " +
    "It should only be used from a Server Component."
);
```

Es una aserción tautológica: pasa por construcción. **Pasaría igual si se borrara todo `src/server/`**, si ningún archivo del proyecto tuviera `import 'server-only'`, o si las fronteras no existieran. No verifica nada del código bajo revisión.

Peor aún, hay una razón por la que el test tuvo que esquivar la resolución normal usando una ruta absoluta:

```ts
// vitest.config.ts:17-21
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
  },
},
```

El alias apunta `server-only` a `empty.js` (un archivo vacío) **para toda la suite**. Es necesario para que `src/server/env.test.ts` pueda importar `./env`, pero como efecto colateral **ningún test puede detectar jamás una violación real de la frontera cliente→server-only**. El alias las neutraliza todas en silencio.

Resultado: el DoD de T-000 «Importar un archivo `server-only` desde cliente rompe el build» queda **sin verificar**, y el principio 8 del plan («toda prueba nueva se demuestra fallando al romper la regla que prueba») no se cumple acá — no hay forma de romper la regla y ver este test en rojo.

### Arreglo

Reemplazar la aserción tautológica por una que ejerza el build real. Crea una ruta temporal con un Client Component que importe un módulo server-only del proyecto, corre `next build` y asserta que falla.

```ts
// tools/verify-scaffold.test.ts
import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

it(
  'DoD: un Client Component que importa un módulo server-only rompe el build',
  async () => {
    const dir = path.resolve('src/app/__boundary_probe__');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'probe.tsx'),
      `'use client';\nimport { serverEnv } from '@/server/env';\nexport function P() { return <div>{serverEnv.NODE_ENV}</div>; }\n`
    );
    await fs.writeFile(
      path.join(dir, 'page.tsx'),
      `import { P } from './probe';\nexport default function Page() { return <P />; }\n`
    );

    try {
      await expect(
        execFileAsync('npx', ['next', 'build'], { shell: true })
      ).rejects.toThrow(/server-only|Server Component/i);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
  { timeout: 300_000 }
);
```

Notas de implementación:

- El `finally` es obligatorio: si la ruta de prueba queda en el árbol, rompe todos los builds siguientes.
- El test es lento (~1-3 min). Si molesta en el loop local, moverlo a un archivo aparte (`tools/verify-build-boundaries.test.ts`) con su propio script `pnpm test:boundaries`, y dejar que T-003 lo corra en CI. Lo importante es que **exista y pueda fallar**.
- Alternativa más barata si el build completo se hace inviable: acotar el alias de `server-only` en `vitest.config.ts` a los archivos de test que lo necesitan (vía `test.alias` por proyecto) en vez de aplicarlo globalmente, y cubrir el caso con un fixture de ESLint. Es una verificación más débil pero al menos no es circular.

---

## 5. 🟠 Denylist de paquetes donde el DoD pide allowlist

**Archivo:** `.eslintrc.json:107-135`
**Estado:** `[VERIFICADO]`

### Diagnóstico

El DoD (c) de T-000 exige que el lint falle ante «un paquete fuera de la lista aprobada». La implementación es una **denylist de nombres exactos**:

```json
"no-restricted-imports": ["error", {
  "paths": [
    { "name": "axios", "message": "..." },
    { "name": "lodash", "message": "..." },
    ...
  ]
}]
```

Dos agujeros:

1. **Semántica invertida.** Una denylist prohíbe lo enumerado; el DoD pide prohibir lo *no* enumerado. Cualquier paquete nuevo que nadie previó (`dayjs`, `redux`, `axios-retry`, `immer`...) entra sin que el lint diga nada.
2. **`paths` sólo hace coincidencia exacta del especificador.** Las subrutas esquivan la prohibición explícita.

### Evidencia

```ts
import get from 'lodash/get';
import dayjs from 'dayjs';
export const x = [get, dayjs];
```

```
npx eslint tools/lint-fixtures/_probe --ext .ts,.tsx
→ (ningún error)
```

`lodash` está prohibido explícitamente en `.eslintrc.json:115` y `dayjs` no está en la lista aprobada de la regla 25. Ninguno de los dos se detecta.

### Arreglo

**Paso 1 — tapar las subrutas** con `patterns` (que sí acepta globs):

```json
"no-restricted-imports": ["error", {
  "paths": [ ...dejar las existentes... ],
  "patterns": [
    { "group": ["axios", "axios/*"], "message": "Prohibido según regla 25: usar fetch nativo o cliente Supabase." },
    { "group": ["lodash", "lodash/*", "lodash-es", "lodash-es/*"], "message": "Prohibido según regla 25: usar utilidades de TypeScript nativas." },
    { "group": ["moment", "moment/*"], "message": "Prohibido según regla 25: usar date-fns (locale es) o Intl." },
    { "group": ["react-hot-toast", "react-hot-toast/*"], "message": "Prohibido según regla 25: usar sonner a través de src/ui/notify." },
    { "group": ["zustand", "zustand/*"], "message": "Prohibido según regla 25: estado de servidor va en TanStack Query y estado local en useState sin aprobación de Lautaro073." },
    { "group": ["gsap", "gsap/*"], "message": "Prohibido según regla 25: usar motion/react." },
    { "group": ["prisma", "prisma/*", "@prisma/*"], "message": "Prohibido según regla 25: no usar ORMs (usar Supabase / PostgreSQL directo)." }
  ]
}]
```

**Paso 2 — implementar la semántica de allowlist** que el DoD pide de verdad. ESLint no puede hacerlo bien (no ve `package.json`), así que va como test:

```ts
// tools/verify-approved-packages.test.ts
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// Lista aprobada según docs/agy-kit/.agents/rules/25-stack-y-patrones.md.
// Agregar acá SÓLO con aprobación de Lautaro073 (regla 00, dependencias).
const APROBADAS = new Set([
  '@supabase/ssr', '@supabase/supabase-js', '@tanstack/react-query',
  'class-variance-authority', 'clsx', 'lucide-react', 'next', 'react',
  'react-dom', 'server-only', 'sonner', 'tailwind-merge', 'zod',
]);

it('no hay dependencias de runtime fuera de la lista aprobada (regla 25)', () => {
  const noAprobadas = Object.keys(pkg.dependencies).filter((d) => !APROBADAS.has(d));
  expect(noAprobadas).toEqual([]);
});
```

Antes de escribir la lista, **leé `docs/agy-kit/.agents/rules/25-stack-y-patrones.md`** y usá la lista real de ahí, no la que copié de `package.json`. Conviene hacer lo mismo con `devDependencies` en una lista aparte.

**Paso 3 — fixture.** Agregar `tools/lint-fixtures/unapproved-subpath.ts` con `import get from 'lodash/get'` y su test en `verify-scaffold.test.ts`.

---

## 6. 🟡 La regla ignora re-exports e imports dinámicos

**Archivo:** `tools/eslint-plugin-cadeapp/index.js:34-56`
**Estado:** `[VERIFICADO]`

### Diagnóstico

El visitor cubre únicamente `ImportDeclaration`. Un archivo `'use client'` alcanza `src/server/**` sin ser detectado mediante:

- `export * from '@/server/env'`
- `export { serverEnv } from '@/server/env'`
- `const m = await import('@/server/env')`
- `require('@/server/env')`

### Evidencia

```tsx
'use client';

export * from '@/server/env';
```

```
npx eslint tools/lint-fixtures/_probe --ext .ts,.tsx
→ (ningún error)
```

(La directiva está primera en este fixture, así que `isClient` sí se detecta — el problema es exclusivamente que no hay visitor para `ExportAllDeclaration`.)

Esto importa especialmente acá porque **la forma canónica de exponer API pública de una feature en este repo es exactamente `export * from`**: `src/features/_template/index.ts` y `src/features/_template/server.ts` están construidos enteramente con esa forma. Es el patrón que todas las features de Fase 1 van a copiar, y es justo el que la regla no inspecciona.

### Arreglo

Extraer la comprobación a una función y engancharla a todos los nodos con `source`:

```js
create(context) {
  let isClient = false;

  function revisarFuente(node, source) {
    if (!isClient || typeof source !== 'string') return;
    if (!esImportDeServidor(source)) return;
    context.report({
      node,
      message:
        'Violación de frontera arquitectónica: Un archivo con directiva "use client" no puede importar de src/server/** ni features/*/server según la regla 20.',
    });
  }

  return {
    Program(node) {
      isClient = tieneDirectivaUseClient(node);
    },
    ImportDeclaration(node)      { revisarFuente(node, node.source?.value); },
    ExportNamedDeclaration(node) { revisarFuente(node, node.source?.value); },
    ExportAllDeclaration(node)   { revisarFuente(node, node.source?.value); },
    ImportExpression(node) {
      if (node.source?.type === 'Literal') revisarFuente(node, node.source.value);
    },
  };
}
```

(`esImportDeServidor` es la función del hallazgo 7.)

---

## 7. 🟡 `includes('/server')` bloquea `next/server`

**Archivo:** `tools/eslint-plugin-cadeapp/index.js:40-47`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```js
const isServerImport =
  importSource.startsWith('@/server') ||
  importSource.startsWith('src/server') ||
  importSource === '@/server' ||
  importSource.includes('/server') ||      // ← demasiado amplio
  importSource.endsWith('/server');
```

`includes('/server')` hace coincidencia en cualquier posición de la cadena. Además, las cinco condiciones se solapan: la tercera es redundante con la primera, y la quinta con la cuarta.

### Evidencia

```tsx
'use client';

import type { NextRequest } from 'next/server';
export type T = NextRequest;
```

```
e-next-server.tsx:3:1: Violación de frontera arquitectónica: ... [Error/cadeapp/client-no-server]
1 problem
```

Un import de tipos de Next perfectamente válido se reporta como violación de frontera. El mismo patrón va a bloquear `@/lib/server-timing`, `./server-utils`, `@/features/x/servers` o cualquier paquete con `/server` en la ruta.

Como la regla es `error` y la regla 20 dice explícitamente que estas reglas **no se desactivan**, esto empuja a poner `eslint-disable` en código legítimo — que es exactamente lo que el control quiere evitar.

### Arreglo

Anclar a segmentos reales de ruta:

```js
function esImportDeServidor(source) {
  // src/server/** por alias o ruta
  if (source === '@/server' || source.startsWith('@/server/')) return true;
  if (source === 'src/server' || source.startsWith('src/server/')) return true;
  // features/<x>/server(.ts) — sólo rutas internas del proyecto, nunca paquetes
  if (/^(@\/|\.{1,2}\/).*\/server(\.(ts|tsx|js|jsx))?$/.test(source)) return true;
  return false;
}
```

Clave: la última expresión regular exige que la ruta empiece con `@/`, `./` o `../`. `next/server` empieza con `n`, así que queda fuera. Verificalo con el fixture de la evidencia (debe pasar sin errores) más el fixture existente `client-importing-server.tsx` (debe seguir fallando).

---

## 8. 🟡 `entry-point` no cubre `schemas.ts`, `copy.ts` ni `query-keys.ts`

**Archivo:** `.eslintrc.json:94-105`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```json
"boundaries/entry-point": ["error", {
  "default": "allow",
  "rules": [{
    "target": ["feature"],
    "disallow": ["components/**/*", "hooks/**/*", "actions.ts", "queries.ts"],
    "message": "..."
  }]
}]
```

La regla 20 dice que una feature se importa **sólo** por `index.ts` (cliente) o `server.ts` (servidor). Esta configuración enumera lo prohibido en vez de lo permitido, y la lista está incompleta: `schemas.ts`, `copy.ts` y `query-keys.ts` quedan importables en profundidad.

### Evidencia

```ts
import { exampleItemSchema } from '@/features/_template/schemas';
export const s = exampleItemSchema;
```

```
npx eslint tools/lint-fixtures/_probe --ext .ts,.tsx
→ (ningún error)
```

El fixture commiteado `tools/lint-fixtures/deep-feature-import.ts` sólo ejercita la ruta `components/`, así que el test del DoD (a) pasa en verde mientras tres rutas de import profundo siguen abiertas.

### Arreglo

Invertir a allowlist. Ojo: `default: "disallow"` aplica a **todos** los tipos de elemento, así que hay que reabrir explícitamente los demás:

```json
"boundaries/entry-point": ["error", {
  "default": "disallow",
  "rules": [
    {
      "target": ["feature"],
      "allow": ["index.ts", "server.ts"],
      "message": "Violación de frontera arquitectónica: No se permite importar archivos internos de una feature. Usá su index.ts (cliente) o server.ts (servidor) según la regla 20."
    },
    {
      "target": ["domain", "lib", "ui", "types", "server", "app", "fixture"],
      "allow": ["**/*"]
    }
  ]
}]
```

Agregar además fixtures para `schemas.ts` y `query-keys.ts` con sus tests, para que el DoD (a) quede cubierto de verdad.

---

## 9. 🟡 `boundaries` permite `feature`→`server` desde cualquier archivo

**Archivo:** `.eslintrc.json:78-81`
**Estado:** `[ANÁLISIS]`

### Diagnóstico

```json
{
  "from": "feature",
  "allow": ["domain", "lib", "ui", "server", "types", "feature"]
}
```

`docs/agy-kit/.agents/rules/20-arquitectura.md` dice:

> `src/features/<x>`: importa `domain`, `lib`, `ui`, `server` (**solo desde `actions.ts`/`queries.ts`**) y otras features SOLO por su `index.ts` (cliente) o `server.ts` (servidor).

La configuración ignora el paréntesis: **cualquier** archivo de una feature —incluidos `components/*.tsx` y `hooks/*.ts`, que son código de cliente— puede importar `src/server/**` y `boundaries/element-types` no dice nada.

El único freno es `cadeapp/client-no-server`, que sólo actúa sobre archivos con directiva `'use client'` **detectada** — y ya vimos en los hallazgos 2, 6 y 7 que esa detección tiene falsos negativos confirmados. Un hook de feature **sin directiva** que importe `@/server/**` y sea consumido por un componente cliente no lo frena nadie: ni `boundaries` (lo permite), ni la regla custom (no es `'use client'`).

### Arreglo

Modelar `actions.ts`/`queries.ts`/`server.ts` como un tipo de elemento propio, **declarado antes** que `feature` (el orden importa: `eslint-plugin-boundaries` usa la primera coincidencia):

```json
"boundaries/elements": [
  ...
  {
    "type": "feature-server-api",
    "pattern": "src/features/*/@(actions|queries|server).ts",
    "mode": "file",
    "capture": ["featureName"]
  },
  {
    "type": "feature",
    "pattern": "src/features/*",
    "mode": "folder",
    "capture": ["featureName"]
  },
  ...
]
```

Verifiqué el patrón extglob contra la misma versión de `micromatch` que usa el plugin (4.0.8):

```
true   src/features/x/actions.ts
true   src/features/x/queries.ts
true   src/features/x/server.ts
false  src/features/x/components/a.tsx
false  src/features/x/hooks/a.ts
false  src/features/x/index.ts
false  src/features/x/schemas.ts
```

Y en `boundaries/element-types`, sacar `server` de `feature` y dárselo sólo al tipo nuevo:

```json
{ "from": "feature",            "allow": ["domain", "lib", "ui", "types", "feature", "feature-server-api"] },
{ "from": "feature-server-api", "allow": ["domain", "lib", "types", "server", "feature", "feature-server-api"] }
```

Hay que revisar también las reglas de `app` y `fixture` para que sigan pudiendo alcanzar `feature-server-api`. Después de este cambio, correr `pnpm test` completo: el fixture `deep-feature-import.ts` podría cambiar de regla disparada (de `entry-point` a `element-types`), y el test lo asserta por `ruleId`.

---

## 10. 🟡 `middleware.ts` nunca se lintea

**Archivos:** `.eslintrc.json:11` y `package.json:14`
**Estado:** `[VERIFICADO]`

### Diagnóstico

Dos capas que se refuerzan:

1. `"boundaries/include": ["src/**/*", "tools/lint-fixtures/**/*"]` — los archivos de la raíz quedan fuera del análisis de fronteras.
2. `"lint": "next lint"` — sin `--dir`/`--file`, `next lint` sólo recorre `app`, `pages`, `components`, `lib` y `src`. Confirmado en `node_modules/next/dist/lib/constants.js:241`:

```js
const ESLINT_DEFAULT_DIRS = ["app", "pages", "components", "lib", "src"];
```

`middleware.ts` vive en la raíz. No lo lintea nadie. Tampoco `tailwind.config.ts`, `vitest.config.ts` ni `postcss.config.mjs`.

### Evidencia

Creé `zz-root-probe.ts` en la raíz con un import explícitamente prohibido en `.eslintrc.json:112`:

```ts
import axios from 'axios';
export const x = axios;
```

```
npx next lint
→ ✔ No ESLint warnings or errors
```

### Por qué importa

La regla 20 le impone a `middleware.ts` su restricción **más estricta** de todo el repo:

> Archivos raíz (`src/app/layout.tsx`, `middleware.ts`, `src/app/providers.tsx`) son de P3; `middleware.ts` **solo** llama a la función de sesión exportada por `features/auth/server.ts`.

Es justamente el archivo que ningún control automático vigila. En T-009 se va a integrar ahí el refresco de sesión de Supabase Auth, sin red de seguridad.

### Arreglo

```json
// package.json → scripts
"lint": "next lint --dir src --file middleware.ts --max-warnings 0"
```

Verifiqué que `next lint` soporta `--file <files...>` y `--max-warnings [n]` en la versión instalada (`npx next lint --help`). El `--max-warnings 0` es un extra que conviene: hoy `next lint` sale con código 0 aunque haya warnings, así que «lint verde» es más débil de lo que parece — relevante cuando T-003 lo use como gate de CI.

Y en `.eslintrc.json`:

```json
"boundaries/include": ["src/**/*", "middleware.ts", "tools/lint-fixtures/**/*"],
```

Va a hacer falta declarar un elemento para `middleware.ts` en `boundaries/elements` (por ejemplo `{ "type": "middleware", "pattern": "middleware.ts", "mode": "file" }`) con `allow: ["feature-server-api"]`, o `boundaries` lo va a marcar como elemento desconocido.

### Verificación

Repetí el probe de la evidencia después del arreglo: `npx next lint` debe reportar el `import axios` del archivo raíz.

---

## 11. 🟡 Las Server Actions del template son inalcanzables desde cliente

**Archivos:** `src/features/_template/server.ts:1-5`, `src/features/_template/index.ts:1-6`, `.eslintrc.json:100`
**Estado:** `[ANÁLISIS]`

### Diagnóstico

`createExampleAction` no tiene ninguna ruta de import válida desde código de cliente. Las tres posibles están cerradas:

| Vía | Qué pasa |
|---|---|
| `import { createExampleAction } from '@/features/_template/actions'` | Bloqueado por `boundaries/entry-point` (`.eslintrc.json:100`, `actions.ts` en `disallow`) |
| `import { createExampleAction } from '@/features/_template/server'` | `server.ts:1` hace `import 'server-only'` → lanza en el bundle de cliente |
| `import { createExampleAction } from '@/features/_template'` | `index.ts` no reexporta `./actions` (sólo componentes, hooks, schemas, query-keys, copy) |

Un formulario `'use client'` en una feature real necesita la Server Action para pasarla a `<form action={...}>` o a `useFormState`. No puede obtenerla.

Como `_template` es la plantilla canónica que T-006, T-008 y todas las features de Fase 1 van a copiar (la regla 20 dice literalmente «copiar `src/features/_template/`»), el callejón sin salida se replica en cada módulo.

### Arreglo

Los módulos `'use server'` **son importables desde cliente por diseño** en Next — es el mecanismo estándar de Server Actions. `actions.ts` ya tiene la directiva en su línea 1, así que basta con reexportarlo desde la API pública de cliente:

```ts
// src/features/_template/index.ts
// Public Client API de la feature _template
export * from './components/example-card';
export * from './hooks/use-example';
export * from './schemas';
export * from './query-keys';
export * from './copy';
export * from './actions';   // Server Actions: importables desde cliente por diseño (Next App Router)
```

Y sacar `./actions` de `server.ts`, que debe quedarse sólo con lo que es estrictamente server-only:

```ts
// src/features/_template/server.ts
import 'server-only';

// Public Server API de la feature _template
export * from './queries';
```

Dos cosas a verificar después del cambio:

1. Que `index.ts` siga siendo importable desde un Server Component sin problemas (lo es: `'use server'` funciona en ambos lados).
2. Que el hallazgo 6 esté arreglado **antes** que este, o al menos a la vez. Si no, `index.ts` pasa a reexportar actions con `export * from` y conviene tener el visitor de re-exports funcionando para que la frontera siga vigilada.

Si preferís no exponer actions por `index.ts`, la alternativa es agregar `"actions.ts"` a la lista `allow` del `entry-point` para el target `feature`. Es menos limpio (amplía la superficie pública) pero es una decisión válida — conviene consultarla con Lautaro073 porque toca el contrato de la regla 20.

---

## 12. 🟡 `queryKey` fijo ignora el argumento `initialData`

**Archivo:** `src/features/_template/hooks/use-example.ts:7-15`
**Estado:** `[ANÁLISIS]`

### Diagnóstico

```ts
export function useExampleItems(initialData?: ExampleItem[]) {
  return useQuery({
    queryKey: exampleKeys.lists(),        // ← siempre la misma clave
    queryFn: async () => {
      return initialData ?? [];           // ← closure sobre el argumento
    },
    initialData,
  });
}
```

Dos problemas encadenados:

1. **Colisión de caché.** La clave es siempre `['example','list']`, sin importar el argumento. Dos pantallas que hagan `useExampleItems(listaA)` y `useExampleItems(listaB)` comparten la misma entrada: la segunda recibe los datos de la primera.
2. **La `queryFn` no refetchea nada.** Devuelve el valor capturado en el closure. Con `staleTime: 60 * 1000` heredado de `providers.tsx:9`, un cambio de `initialData` entre renders nunca se refleja.

`query-keys.ts:4` ya define la clave parametrizada correcta (`list: (filters) => [...]`) y el hook no la usa.

Importa porque es el patrón que T-204 («Datos en vivo con TanStack Query, `query-keys.ts` por feature, datos iniciales del servidor») y todas las features de datos en vivo van a copiar.

### Arreglo

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { exampleKeys } from '../query-keys';
import type { ExampleItem } from '../schemas';

export interface UseExampleItemsOptions {
  filters?: Record<string, unknown>;
  initialData?: ExampleItem[];
}

export function useExampleItems({ filters = {}, initialData }: UseExampleItemsOptions = {}) {
  return useQuery({
    // La clave incluye los filtros: dos consumidores con filtros distintos
    // no comparten entrada de caché.
    queryKey: exampleKeys.list(filters),
    queryFn: async () => {
      // En features reales: fetch a un route handler o llamada a una Server Action.
      // NO devolver initialData desde acá: haría que la query nunca se actualice.
      throw new Error('Implementar la lectura real en la feature que copie este template');
    },
    initialData,
  });
}
```

El `throw` es deliberado: deja explícito que el template no trae una lectura real y obliga a implementarla al copiarlo, en vez de heredar en silencio un hook que siempre devuelve lo mismo. Si preferís algo menos abrupto, dejá un comentario `// TODO(feature): implementar` y devolvé `[]`, pero entonces documentá que `initialData` no se refresca.

---

## 13. 🟡 `maximumScale: 1` bloquea el zoom de pellizco

**Archivo:** `src/app/layout.tsx:19-25`
**Estado:** `[ANÁLISIS]`

### Diagnóstico

```ts
export const viewport: Viewport = {
  themeColor: '#09BABD',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,      // ← impide ampliar la página
  viewportFit: 'cover',
};
```

Una persona con baja visión no puede ampliar ninguna pantalla de la app en iOS/Android. Es un fallo de WCAG 1.4.4 (Resize Text) y una auditoría fallida conocida de Lighthouse (`[maximum-scale] is less than 5`).

Se combina mal con el hallazgo 3: entre los dos, el texto queda en 10,5-12,25px **y** sin posibilidad de zoom. No hay ninguna vía de escape para el usuario.

T-205 exige Lighthouse móvil ≥ 95 en accesibilidad sobre pantallas que heredan este layout raíz — que es de P1, o sea que T-205 (P2) no va a poder arreglarlo desde su zona.

### Arreglo

```ts
export const viewport: Viewport = {
  themeColor: '#09BABD',
  width: 'device-width',
  initialScale: 1,
  // Sin maximumScale: el zoom de pellizco es un requisito de WCAG 1.4.4.
  viewportFit: 'cover',   // se mantiene para el safe-area inset del BottomNav (T-008)
};
```

`viewportFit: 'cover'` se conserva: lo necesita el `BottomNav` de T-008 para el safe-area inset, y no tiene nada que ver con el bloqueo del zoom.

---

## 14. 🔵 DECISIÓN — La ficha T-000 pide `middleware.ts` vacío

**Archivo:** `middleware.ts:1-12`
**Estado:** `[ANÁLISIS]` — desvío de alcance, no defecto técnico

### Situación

La fila T-000 de la sección 8 de `docs/implementation-plan.md` enumera entre los entregables:

> ...`providers.tsx` con el `QueryClientProvider`, **`middleware.ts` vacío**, `src/server/env.ts` y `src/lib/env.public.ts` validados con Zod, `.env.example`

El PR entrega una función `middleware` con un `config.matcher`:

```ts
export async function middleware(_request: NextRequest) {
  // Placeholder inicial T-000: en T-009 se integrará la actualización de sesión de Supabase Auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Dos observaciones técnicas, independientes de la decisión de alcance

1. **El matcher no excluye `/api`.** Cuando T-009 conecte el refresco de sesión de Supabase, cada llamada a `/api/cron/sweep` y `/api/health` (T-104) va a pagar una verificación de sesión innecesaria. Los route handlers de cron se autentican con `Authorization: Bearer ${CRON_SECRET}` (regla 20), no con sesión de usuario.
2. **`brand` sin ancla también matchea `/branding-*`.** El lookahead `brand` coincide con cualquier ruta que empiece con esa cadena, no sólo `/brand/`. Hoy es inocuo; conviene anclarlo a `brand/`.

### Qué hacer

Esto es una decisión de producto, no un bug. **Consultá a Lautaro073 antes de tocarlo.** Las opciones:

- **(a) Cumplir la ficha al pie de la letra:** dejar `middleware.ts` vacío y que T-009 lo escriba entero. Es lo que dice el plan.
- **(b) Aceptar el desvío explícitamente:** dejarlo como está, y que quien aprueba el PR lo registre en el comentario de aprobación. Si se toma este camino, al menos arreglar el matcher:

```ts
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

En cualquiera de los dos casos, arreglar el hallazgo 10 primero: este archivo no lo lintea nadie hoy, así que el desvío no lo detectó ningún control automático.

---

## 15. 🔵 DECISIÓN — Rangos caret donde el plan pide versiones exactas

**Archivo:** `package.json:19-52`
**Estado:** `[ANÁLISIS]` — convención, no defecto técnico

### Situación

`docs/implementation-plan.md:163` cierra el árbol del repositorio con:

> `package.json` (packageManager pnpm vía Corepack, engines.node, **versiones exactas**)

En el PR sólo dos dependencias están fijadas (`next: "14.2.24"` y `eslint-config-next: "14.2.24"`). Las otras 27 usan `^`.

### Riesgo concreto

Con `^` en 27 de 29 dependencias, un `pnpm install` sin lockfile —o un `pnpm update` accidental— puede traer minors distintas de React, Zod, TanStack Query o Tailwind entre las máquinas de P1, P2 y P3. Es exactamente el tipo de deriva que T-003 va a tener que diagnosticar en CI, y el §3.4 del plan (P2/P3 trabajando contra el fake de RPC en sus propias máquinas) depende de que los tres entornos sean iguales.

### Incoherencia menor asociada

`.nvmrc` fija `22.14.0` mientras `package.json:6-8` declara `engines.node: ">=20.0.0"`. Un entorno con Node 20 pasa la validación de `engines` pero no coincide con la versión declarada del proyecto.

### Arreglo

```
# .npmrc (nuevo archivo en la raíz)
save-exact=true
```

Y fijar las versiones actuales del lockfile:

```bash
pnpm install --save-exact $(node -e "
const p=require('./package.json');
console.log(Object.keys({...p.dependencies}).join(' '))
")
```

Conviene hacerlo leyendo las versiones ya resueltas en `pnpm-lock.yaml` para no mover nada de lo que ya está probado verde en este PR. Y alinear `engines`:

```json
"engines": { "node": ">=22.14.0" }
```

**Consultá a Lautaro073 antes de aplicarlo:** `package.json` y `pnpm-lock.yaml` son de su zona (§2 del plan, «Datos, servidor y plataforma»), y fijar versiones regenera el lockfile entero.

---

## NO TOCAR — falsos positivos ya descartados

Verifiqué estas cuatro cosas y **no son defectos**. Si algún otro informe las marca, ignoralo:

| Supuesto problema | Por qué no lo es |
|---|---|
| **`.env.example` falta** | Existe en `develop` desde antes de este PR (99 líneas) y **cubre las 17 claves** de ambos schemas Zod: las 8 de `publicEnvSchema` y las 7 de `serverEnvSchema`, más `NODE_ENV` y `SENTRY_ENVIRONMENT`. No aparece en el diff porque no cambió. |
| **`bg-primary/10` no funciona sin `<alpha-value>`** | Sí funciona. Compilé Tailwind contra esta config: `.bg-primary\/10 { background-color: hsl(var(--primary) / 0.1); }`. Tailwind v3 inyecta el canal alfa aunque el token no declare `<alpha-value>`. `src/app/page.tsx:5` está bien. |
| **Falta `metadata` o `lang` en `layout.tsx`** | Ya están. `src/app/layout.tsx:27-30` exporta `title` y `description`; la línea 38 pone `<html lang="es-AR">`. |
| **`tsc --noEmit` falla sin `next-env.d.ts`** | No falla. Lo comprobé moviendo el archivo fuera y corriendo `npx tsc --noEmit`: sin errores. |

Además, **no amplíes el alcance de T-000**. No agregues plugins de accesibilidad, providers de notificaciones, comportamiento de motion, UI de loading/error ni CI: nada de eso está en el DoD de esta tarea (son T-003, T-008 y T-205). Los hallazgos 3 y 13 tocan accesibilidad, pero son correcciones de código que este PR ya escribió, no requisitos nuevos.

---

## Por qué los checks verdes no alcanzan

Los cuatro checks de la descripción del PR son reales — los volví a correr contra este head SHA y dan verde. El problema es qué **no** cubren:

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| `pnpm build` verde | El scaffold compila | Nada consume `getPublicEnv()` todavía, así que el crash de cliente (hallazgo 1) no se manifiesta |
| `pnpm lint` verde | No hay violaciones en `src/` | No lintea `middleware.ts` ni la raíz (hallazgo 10); sale con código 0 aunque haya warnings |
| `pnpm test` 15/15 | Los tests pasan | El test del DoD de `server-only` es tautológico (hallazgo 4); el alias de Vitest impide que cualquier test detecte esa frontera |
| Fixtures de lint | 3 de 3 disparan su regla | Cubren un caso cada uno; los caminos alternativos (comentario previo, `export * from`, subruta de paquete, `schemas.ts`) pasan sin error — hallazgos 2, 5, 6, 8 |

Dicho de otro modo: de los tres controles que el DoD de T-000 define como su entregable central, **el (b) tiene un falso negativo trivial de activar, el (c) tiene la semántica invertida, y la verificación de `server-only` no verifica nada**.

---

## Checklist de verificación final

Después de aplicar los arreglos, todo esto tiene que pasar:

```bash
# 1. Checks base
pnpm typecheck
pnpm lint          # ahora con --dir src --file middleware.ts --max-warnings 0
pnpm test
pnpm build

# 2. El bug crítico está cerrado (ver sección 1 para el script completo)
#    grep "probe-marker" en .next/static/chunks/ DEBE devolver un archivo

# 3. La escala tipográfica respeta el piso D16
npx tailwindcss -i src/app/globals.css -o /tmp/tw.css --content src/app/page.tsx
grep -A2 "^html" /tmp/tw.css      # NO debe contener font-size

# 4. El lint alcanza la raíz
printf "import axios from 'axios';\nexport const x = axios;\n" > zz-probe.ts
npx next lint                      # DEBE reportar el import de axios
rm zz-probe.ts
```

Y los fixtures nuevos que hay que commitear, con su test correspondiente en `tools/verify-scaffold.test.ts` (principio 8 del plan: cada prueba nueva se demuestra fallando al romper la regla que prueba):

- [ ] `client-with-comment-importing-server.tsx` — directiva precedida de comentario (hallazgo 2)
- [ ] `client-reexporting-server.tsx` — `export * from '@/server/env'` (hallazgo 6)
- [ ] `client-importing-next-server.tsx` — `next/server` **no** debe disparar la regla (hallazgo 7)
- [ ] `unapproved-subpath.ts` — `lodash/get` (hallazgo 5)
- [ ] `deep-import-schemas.ts` — `@/features/_template/schemas` (hallazgo 8)

---

## Metodología

Todo se verificó contra `f71d8582471991b6101c1035cb73702ae446ca85` con el árbol de trabajo limpio. Los archivos de prueba creados durante la revisión (`src/app/envprobe/`, `tools/lint-fixtures/_probe/`, `zz-root-probe.ts`) y el directorio `.next/` fueron eliminados; el árbol quedó igual que al inicio.

Comandos usados para la evidencia:

- `next build` + `grep` sobre `.next/static/chunks/` + `next start` y lectura de la consola del navegador → hallazgo 1
- `npx eslint` sobre seis fixtures temporales → hallazgos 2, 5, 6, 7, 8
- `npx tailwindcss` con `--content` → hallazgo 3
- `npx next lint` con un archivo probe en la raíz → hallazgo 10
- Lectura de `node_modules/next/dist/lib/constants.js:241` y `node_modules/next/dist/build/webpack/plugins/define-env-plugin.js:34-44` → hallazgos 1 y 10
- `micromatch@4.0.8` (la versión que usa `eslint-plugin-boundaries`) → validación del patrón del hallazgo 9

No se verificó por ejecución dedicada: hallazgos 9, 11, 12, 13, 14, 15 (derivados de lectura de código y de las reglas del repo).
