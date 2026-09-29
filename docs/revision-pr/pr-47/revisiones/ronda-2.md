# Informe de re-revisión — PR #47 / T-000 (ronda 2)

**PR:** https://github.com/cadeApp/cadeApp/pull/47
**Head SHA revisado:** `d0268345f72411148810a0ecf3eb5187890ada28`
**SHA anterior:** `f71d8582471991b6101c1035cb73702ae446ca85`
**Informe de la ronda 1:** [`pr-47-revision.md`](pr-47-revision.md)
**Fecha:** 2026-09-20

---

## Veredicto

El commit `d026834` arregla **11 de los 15 hallazgos** de forma completa y verificada, incluido el crítico. El trabajo es sólido: los arreglos son correctos de fondo, no parches cosméticos.

Quedan **5 puntos**: una regresión nueva introducida por el arreglo del hallazgo 9, tres arreglos parciales, y la decisión de alcance que sigue pendiente.

**Estado de los checks** (corridos contra `d026834` con `.next/` borrado y árbol limpio):

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 23/23 en 6 archivos
pnpm build      → ✓ 87.2 kB First Load JS en /
```

---

## Resumen

| # | Hallazgo original | Estado |
|---|---|---|
| 1 | `publicEnv` lanza en el navegador | ✅ **Arreglado** (verificado en bundle) |
| 2 | Comentario antes de `'use client'` | ✅ **Arreglado** (verificado) |
| 3 | `font-size:14px` invierte Anti-12px | ✅ **Arreglado** (verificado) |
| 4 | Test de `server-only` tautológico | ⚠️ **Parcial** — el test ya no es tautológico pero sigue sin ejercer `server-only` |
| 5 | Denylist vs allowlist de paquetes | ✅ **Arreglado**… pero ver 🔴 **R1** |
| 6 | Regla ignora `export * from` | ✅ **Arreglado** (verificado) |
| 7 | `includes('/server')` falso positivo | ✅ **Arreglado** (verificado) |
| 8 | `entry-point` incompleto | ✅ **Arreglado** (verificado) |
| 9 | `feature`→`server` sin restricción | ⚠️ **Parcial** — enfoque distinto al sugerido, deja hueco y causa **R1** |
| 10 | `middleware.ts` no se lintea | ✅ **Arreglado** (verificado) |
| 11 | Server Actions inalcanzables | ✅ **Arreglado** (verificado con build) |
| 12 | `queryKey` fijo | ⚠️ **Parcial** — colisión de caché resuelta, `queryFn` sigue devolviendo el closure |
| 13 | `maximumScale:1` | ✅ **Arreglado** |
| 14 | `middleware.ts` no vacío | 🔵 **Decisión pendiente** — matcher mejorado, desvío sigue |
| 15 | Rangos caret | ✅ **Arreglado** (0 caret, `engines` alineado con `.nvmrc`) |
| **R1** | **NUEVO** — `overrides` desactiva la denylist de paquetes en features | 🔴 **Regresión** |

**Orden sugerido:** R1 + 9 juntos (un solo cambio los resuelve), después 4, después 12, y 14 se consulta.

---

## 🔴 R1 — REGRESIÓN: el `overrides` desactiva la denylist de paquetes en las features

**Archivo:** `.eslintrc.json:163-187`
**Introducido por:** el arreglo del hallazgo 9
**Estado:** `[VERIFICADO]` — comparado antes/después

### Qué pasó

Para resolver el hallazgo 9 se agregó un bloque `overrides` que restringe `@/server` en los archivos de feature:

```json
"overrides": [
  {
    "files": [
      "src/features/**/components/**",
      "src/features/**/hooks/**",
      "src/features/**/schemas.ts",
      "src/features/**/copy.ts",
      "src/features/**/index.ts"
    ],
    "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@/server", "@/server/*", "src/server", "src/server/*"],
            "message": "Violación de regla 20: En una feature, solo actions.ts y queries.ts pueden importar de src/server/**." }
        ]
      }]
    }
  }
]
```

El problema es que **en ESLint un `override` reemplaza la configuración de la regla, no la fusiona**. Para los archivos que matchean ese `files`, la configuración de `no-restricted-imports` de la raíz —con todo el `paths` y el `patterns` que prohíben `axios`, `lodash`, `moment`, `react-hot-toast`, `zustand`, `gsap` y `prisma`— **deja de aplicarse por completo**.

Es decir: el arreglo del hallazgo 9 deshizo el arreglo del hallazgo 5 justamente en `components/` y `hooks/`, que es donde va a vivir la mayor parte del código de features.

### Evidencia

Mismo archivo (`src/features/_template/components/zz-probe.tsx`), dos configuraciones:

```ts
import axios from 'axios';
export const x = axios;
```

Con el `.eslintrc.json` de `f71d858` (antes del fix):

```
zz-probe.tsx:1:1: 'axios' import is restricted from being used.
  Prohibido según regla 25: usar fetch nativo o cliente Supabase. [Error/no-restricted-imports]
1 problem
```

Con el `.eslintrc.json` de `d026834` (después del fix):

```
(sin salida — no se detecta)
```

Y con los tres imports juntos en un componente de feature, sólo salta uno:

```
zz-probe.tsx:3:1: '@/server/env' import is restricted... [Error/no-restricted-imports]
1 problem
```

`axios` y `lodash/get` pasan sin error.

### Hueco residual del hallazgo 9

Además, la lista `files` del override no cubre los archivos sueltos en la raíz de una feature (`query-keys.ts`, o cualquier `utils.ts`/`constants.ts` que se agregue). Verificado:

```ts
// src/features/_template/query-keys-probe.ts
import { serverEnv } from '@/server/env';
export const k = serverEnv.NODE_ENV;
```

```
npx eslint src/features/_template/query-keys-probe.ts
→ (sin salida)
```

`boundaries/element-types` sigue teniendo `{ "from": "feature", "allow": [... "server" ...] }`, así que la capa de fronteras nunca fue la que bloqueó esto — el override es el único control, y no llega a estos archivos.

### Arreglo recomendado (resuelve R1 y el hueco de 9 a la vez)

Sacar la restricción de `@/server` del `overrides` y llevarla a `boundaries`, que es la capa que corresponde. Así `no-restricted-imports` queda intacto en la raíz y aplica a todo el proyecto sin excepciones.

**Paso 1 — borrar el bloque `overrides` completo** de `.eslintrc.json`.

**Paso 2 — declarar `actions.ts`/`queries.ts`/`server.ts` como elemento propio.** El orden importa: `eslint-plugin-boundaries` usa la primera coincidencia, así que este elemento va **antes** que `feature`:

```json
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
}
```

El patrón extglob está verificado contra `micromatch@4.0.8`, que es la versión que usa el plugin:

```
true   src/features/x/actions.ts
true   src/features/x/queries.ts
true   src/features/x/server.ts
false  src/features/x/components/a.tsx
false  src/features/x/hooks/a.ts
false  src/features/x/index.ts
false  src/features/x/schemas.ts
false  src/features/x/query-keys.ts
```

Fijate que `query-keys.ts` queda del lado `feature` — o sea, cubierto, que es justo el hueco residual.

**Paso 3 — en `boundaries/element-types`**, sacar `server` de `feature` y dárselo sólo al tipo nuevo:

```json
{ "from": "feature",            "allow": ["domain", "lib", "ui", "types", "feature", "feature-server-api"] },
{ "from": "feature-server-api", "allow": ["domain", "lib", "types", "server", "feature", "feature-server-api"] }
```

**Paso 4 — revisar `app`, `middleware` y `fixture`** para que sigan pudiendo alcanzar `feature-server-api`, y agregar `feature-server-api` al `target` de la regla de `entry-point` que permite `**/*`.

**Paso 5 — verificar.** Después del cambio, correr `pnpm test` completo: el fixture `deep-feature-import.ts` podría pasar a disparar `boundaries/element-types` en vez de `boundaries/entry-point`, y `verify-scaffold.test.ts` assertea por `ruleId`.

### Si preferís el camino corto

Si no querés tocar `boundaries`, el arreglo mínimo es **repetir el `paths` y el `patterns` de la raíz dentro del `override`**, agregando el de `@/server`. Funciona, pero deja dos listas que hay que mantener sincronizadas a mano — y el día que alguien agregue un paquete prohibido a la raíz y se olvide del override, el hueco vuelve en silencio. Por eso recomiendo el camino de `boundaries`.

### Fixture obligatorio

Sea cual sea el camino, agregar `tools/lint-fixtures/feature-component-unapproved-package.tsx` con `import axios from 'axios'` dentro de una ruta `components/`, y su test en `verify-scaffold.test.ts`. Es el caso exacto que se escapó.

---

## ⚠️ 4 — El test de build existe y puede fallar, pero no ejerce `server-only`

**Archivo:** `tools/verify-build-boundaries.test.ts:12`
**Estado:** `[VERIFICADO]`

### Lo que mejoró

El test tautológico viejo (`require('node_modules/server-only/index.js')`) se reemplazó por uno que crea un Client Component, corre `next build` y assertea que falla. Eso es un avance real: el test ahora **puede** fallar, y el alias de Vitest ya no lo hace circular.

### Lo que falta

El directorio de prueba es `src/app/__boundary_probe__`. En el App Router de Next, **las carpetas que empiezan con `_` son privadas y quedan excluidas del ruteo**. La página nunca se convierte en ruta, así que webpack nunca la incluye en ningún bundle y `server-only` nunca se ejecuta.

Lo que hace fallar al build es el paso de ESLint, no la frontera. Reproducido a mano con el mismo directorio:

```
   Creating an optimized production build ...
 ✓ Compiled successfully                      ← webpack no vio nada
   Linting and checking validity of types ...

Failed to compile.

./src/app/__boundary_probe__/probe.tsx
2:1  Error: Violación de frontera arquitectónica: ... cadeapp/client-no-server
```

El regex del test (`/server-only|Server Component|client-no-server|Violación de frontera/i`) es lo bastante permisivo como para aceptar ese fallo de lint. O sea: el test verifica de nuevo la regla de ESLint que ya cubre `verify-scaffold.test.ts`, no el DoD «importar un archivo `server-only` desde cliente rompe el build».

### La buena noticia

**La frontera real funciona.** Lo comprobé con una carpeta enrutable y el lint desactivado:

```
npx next build --no-lint
./src/server/env.ts
Error:
  x You're importing a component that needs server-only. That only works in a
  | Server Component which is not supported in the pages/ directory.
   ,-[src/server/env.ts:1:1]
 1 | import 'server-only';
   : ^^^^^^^^^^^^^^^^^^^^^
Import trace for requested module:
./src/server/env.ts
./src/app/boundary-probe/probe.tsx

> Build failed because of webpack errors
exit 1
```

El mecanismo está intacto. Sólo falta que el test lo toque.

### Arreglo

Dos cambios en `tools/verify-build-boundaries.test.ts`:

1. **Renombrar la carpeta sin guion bajo inicial** para que sea enrutable.
2. **Pasar `--no-lint`** para aislar el mecanismo, y **cerrar el regex** para que sólo acepte el error real.

```ts
const probeDir = path.resolve('src/app/boundary-probe');   // sin "_" inicial: debe ser enrutable
// ...
try {
  let buildError: Error | null = null;
  try {
    // --no-lint aísla la frontera de server-only del paso de ESLint,
    // que ya está cubierto por verify-scaffold.test.ts
    await execAsync('npx next build --no-lint');
  } catch (err) {
    buildError = err as Error;
  }
  expect(buildError, 'El build debería haber fallado por server-only').not.toBeNull();
  expect(buildError!.message).toMatch(/needs server-only/i);
} finally {
  await fs.rm(probeDir, { recursive: true, force: true });
}
```

Verifiqué que con estos dos cambios el build sale con **exit 1** y el log contiene `needs server-only`, así que el test va a pasar por la razón correcta.

**Cómo comprobar que el test puede fallar** (principio 8 del plan): quitá temporalmente `import 'server-only';` de `src/server/env.ts` y corré el test. Debe ponerse en rojo. Con la versión actual **no se pone en rojo**, porque el fallo de lint lo sostiene igual — esa es la prueba de que hoy no verifica lo que dice.

---

## ⚠️ 12 — Colisión de caché resuelta, el `queryFn` sigue devolviendo el closure

**Archivo:** `src/features/_template/hooks/use-example.ts:15-19`
**Estado:** `[ANÁLISIS]`

### Lo que se arregló

```ts
queryKey: exampleKeys.list(filters),   // ✅ antes: exampleKeys.lists()
```

El defecto que reporté —dos pantallas con datos distintos compartiendo la misma entrada de caché— está resuelto. La clave ahora se parametriza con los filtros, usando el helper que ya existía en `query-keys.ts:4`.

### Lo que queda

```ts
queryFn: async () => {
  // En features reales: fetch a un route handler o llamada a Server Action
  return initialData ?? [];
},
```

La `queryFn` sigue devolviendo el valor capturado en el closure. Con `staleTime: 60 * 1000` heredado de `providers.tsx:9`, cualquier refetch —por `refetchOnWindowFocus`, `refetchOnReconnect` o una invalidación— devuelve el mismo `initialData` en vez de datos frescos.

Para un stub de template es defendible, y el comentario avisa. Pero T-204 exige explícitamente «datos iniciales del servidor» e invalidación por Realtime, y este es el archivo que se va a copiar. El riesgo es que alguien copie el template, cambie sólo la parte de arriba y deje una `queryFn` que nunca refetchea.

### Arreglo sugerido

Hacer que el stub falle ruidosamente en vez de mentir en silencio:

```ts
queryFn: async (): Promise<ExampleItem[]> => {
  // En features reales: fetch a un route handler o llamada a Server Action.
  // NO devolver initialData desde acá: la query nunca se actualizaría.
  throw new Error('Implementar la lectura real en la feature que copie este template');
},
```

Con `initialData` presente, TanStack Query no ejecuta la `queryFn` en el primer render, así que el template sigue funcionando para mostrar datos iniciales; el `throw` sólo aparece cuando alguien dispara un refetch sin haber implementado la lectura — que es exactamente cuándo querés enterarte.

Si preferís algo menos abrupto, dejá `return initialData ?? []` pero agregá un comentario `// TODO(feature): reemplazar por la lectura real — esta query no refetchea`.

**Prioridad baja.** No rompe nada hoy; es higiene de plantilla.

---

## 🔵 14 — DECISIÓN pendiente: `middleware.ts` sigue sin estar vacío

**Archivo:** `middleware.ts`
**Estado:** sin cambios de fondo

El matcher mejoró y ahora excluye `api` y ancla `brand/`:

```diff
-'/((?!_next/static|_next/image|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
+'/((?!api|_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
```

Las dos observaciones técnicas que había hecho están resueltas. Pero el desvío de fondo sigue: la ficha T-000 de `docs/implementation-plan.md` dice «`middleware.ts` **vacío**» y el archivo tiene una función y un `config`.

**Esto no lo puede decidir un agente.** Es una de estas dos:

- **(a)** Vaciar el archivo y que T-009 lo escriba entero, como dice la ficha.
- **(b)** Aceptar el desvío y que quien apruebe el PR lo deje registrado en el comentario de aprobación.

Ahora que el hallazgo 10 está arreglado, al menos el archivo ya está bajo lint, así que la opción (b) es menos riesgosa que antes.

**Consultale a Lautaro073** antes de tocarlo.

---

## Detalle de lo verificado como arreglado

Cada uno reproducido contra `d026834`, no leído del diff.

**1 — `publicEnv` en el navegador.** Compilé una ruta de prueba con un Client Component que lee `publicEnv.NEXT_PUBLIC_APP_URL` con la variable en `https://probe-marker.example.com`:

```
grep -rl "probe-marker" .next/static/chunks/
→ .next/static/chunks/app/envprobe/page-4c6cd2eb27c4399e.js
```

El valor ahora **sí** se inlinea en el bundle de cliente. En la ronda 1 ese `grep` daba vacío y el navegador lanzaba. El arreglo (objeto literal con accesos `process.env.NEXT_PUBLIC_*` uno por uno) es el correcto, y el comentario de advertencia que quedó en el código es apropiado para que nadie lo "simplifique" con un bucle. El test `src/lib/env.public.test.ts` que compara las claves del schema contra el cuerpo de la función es una buena red.

**2, 6, 7 — el plugin de ESLint.** Batería de seis fixtures:

| Caso | Resultado |
|---|---|
| Comentario antes de `'use client'` + import de `@/server/env` | ✅ detectado |
| `'use client'` + `export * from '@/server/env'` | ✅ detectado |
| `'use client'` + `await import('@/server/env')` | ✅ detectado |
| `'use client'` + `import type { NextRequest } from 'next/server'` | ✅ **no** se reporta (falso positivo eliminado) |

La reescritura con `tieneDirectivaUseClient()` recorriendo el prólogo del AST y `esImportDeServidor()` anclando a `@/`, `./`, `../` es exactamente lo correcto.

**3 — tipografía.** `html` ya no fija `font-size` (0 coincidencias en la salida compilada), el piso pasó a `body { @apply ... text-sm }`, y el override de la escala en `tailwind.config.ts` funciona:

```
.text-xs { font-size: 0.875rem; }   ← 14px sobre raíz 16px
.text-sm { font-size: 0.875rem; }
```

Los dos usos de `text-xs` en `page.tsx` y `example-card.tsx` también se cambiaron a `text-sm`. La cláusula Anti-12px ahora se cumple de verdad.

**5 — subrutas de paquetes.** `import get from 'lodash/get'` ahora se detecta vía `patterns`. Y `tools/verify-approved-packages.test.ts` implementa la semántica de allowlist que pedía el DoD (c). **Contrasté la lista del test contra `docs/agy-kit/.agents/rules/25-stack-y-patrones.md:9-22` y coincide** — no es una lista inventada. (Ojo: esto vale para archivos fuera del `overrides`; ver R1.)

**8 — `entry-point`.** `import { exampleItemSchema } from '@/features/_template/schemas'` ahora dispara `boundaries/entry-point`. La inversión a `allow: ["index.ts", "server.ts"]` con `default: "disallow"` y la reapertura explícita de los demás tipos está bien hecha.

**10 — lint de la raíz.** Puse temporalmente un `import axios` en `middleware.ts` y el script nuevo lo detecta:

```
./middleware.ts
1:1  Error: 'axios' import is restricted from being used. [no-restricted-imports]
```

Nota menor: el script es `--dir src --file middleware.ts`, así que `tailwind.config.ts`, `vitest.config.ts` y `postcss.config.mjs` siguen sin lintearse. Es el alcance que había sugerido y me parece bien; si algún día querés cubrirlos, se agregan con más `--file`.

**11 — Server Actions.** Un Client Component que importa `createExampleAction` desde `@/features/_template` pasa el lint y **compila**:

```
└ ○ /actionprobe    13.4 kB    100 kB
```

El movimiento (reexportar `./actions` desde `index.ts` y dejar `server.ts` sólo con `./queries`) es correcto.

**13 — `maximumScale`.** Eliminado; `viewportFit: 'cover'` conservado para el safe-area de T-008.

**15 — versiones.** 0 rangos caret en `package.json`, `.npmrc` con `save-exact=true`, y `engines.node: ">=22.14.0"` alineado con `.nvmrc`. Resuelto.

---

## Nota de alcance (no es un defecto)

El commit `d026834` agregó `.el-consejo/pr-47-revision.md` al repo. Verifiqué que `.el-consejo/` **ya estaba versionado desde antes del PR** (existe en `42fd11f` con `revision-1/`, `revision-2/`, `revision-3/`), así que es práctica establecida, no un descuido.

Dicho eso, `.el-consejo/**` no figura en los «Archivos permitidos» de la ficha T-000 (que lista: raíz y configs, esqueleto de `src/**`, `middleware.ts`, `components.json`, `tools/lint-fixtures/**`), y el DoD común pide «sin cambios fuera de Archivos permitidos». Es menor y probablemente no valga la pena revertirlo, pero conviene mencionarlo en el PR para que no sorprenda en la aprobación.

---

## Sigue vigente: NO TOCAR

Los cuatro falsos positivos de la ronda 1 se mantienen. Verificados de nuevo contra `d026834`:

| Supuesto problema | Por qué no lo es |
|---|---|
| `.env.example` falta | Existe desde antes del PR y cubre las 17 claves de ambos schemas |
| `bg-primary/10` no funciona | Genera `hsl(var(--primary) / 0.1)` correctamente |
| Falta `metadata` o `lang` | Ambos presentes en `layout.tsx` |
| `tsc --noEmit` falla sin `next-env.d.ts` | No falla |

Y no amplíes el alcance de T-000: nada de plugins de accesibilidad, providers de notificaciones, motion, UI de loading/error ni CI. Son T-003, T-008 y T-205.

---

## Checklist de la ronda 2

```bash
# 1. Arreglar R1 + hueco de 9 (borrar overrides, mover a boundaries)
#    Verificar que el paquete prohibido se detecta DENTRO de una feature:
mkdir -p src/features/_template/components
printf "import axios from 'axios';\nexport const x = axios;\n" > src/features/_template/components/zz.tsx
npx eslint src/features/_template/components/zz.tsx     # DEBE reportar axios
rm -f src/features/_template/components/zz.tsx

#    Y que un archivo suelto de feature no llega a @/server:
printf "import { serverEnv } from '@/server/env';\nexport const k = serverEnv.NODE_ENV;\n" > src/features/_template/zz.ts
npx eslint src/features/_template/zz.ts                 # DEBE reportar
rm -f src/features/_template/zz.ts

# 2. Arreglar 4 (renombrar carpeta + --no-lint + regex cerrado)
#    Demostrar que el test puede fallar:
#    quitar `import 'server-only';` de src/server/env.ts → el test debe ponerse ROJO
#    restaurarlo → verde

# 3. Batería completa
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Fixtures nuevos a commitear en esta ronda:

- [ ] `tools/lint-fixtures/feature-component-unapproved-package.tsx` — `axios` dentro de `components/` (R1)
- [ ] `tools/lint-fixtures/feature-loose-file-importing-server.ts` — archivo suelto de feature → `@/server` (hueco de 9)

---

## Metodología

Verificado contra `d0268345f72411148810a0ecf3eb5187890ada28` con el árbol de trabajo limpio. Todos los archivos de prueba creados durante la revisión (`src/app/envprobe/`, `src/app/actionprobe/`, `src/app/boundary-probe/`, `src/app/__boundary_probe__/`, `tools/lint-fixtures/_p/`, probes sueltos en `src/features/` y en la raíz) fueron eliminados, y `.next/` borrado. `git status` quedó limpio.

Para la regresión R1 comparé el mismo archivo contra las dos versiones de `.eslintrc.json` (`git show f71d858:.eslintrc.json` restaurando después), que es la única forma de distinguir una regresión de un hueco preexistente.

No verificado por ejecución dedicada: hallazgo 12 (lectura de código) y la decisión 14.
