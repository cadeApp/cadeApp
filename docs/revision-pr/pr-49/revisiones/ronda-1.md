# Informe de revisión — PR #49 / T-002

**PR:** https://github.com/cadeApp/cadeApp/pull/49
**Head SHA revisado:** `3ba9be6b09a32bd7c6e5f9ee5b4ed39d547d5f62`
**Base:** `develop` @ `9f03018`
**Fecha:** 2026-09-21
**Alcance:** 8 archivos, +206 / −6

---

## Veredicto

Los cuatro checks están verdes, pero **el cliente del navegador no se puede usar desde el navegador** y la capa `src/server/` rompe su invariante central. Además, la ficha T-002 cambió de dirección (de Docker local a vinculación remota) y la PR quedó a mitad de camino entre las dos: entrega un `config.toml` de entorno local y no actualiza el onboarding.

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 61/61 en 8 archivos
```

> **Alcance de `pnpm lint`:** `--dir src --file middleware.ts`. Cubre los tres clientes nuevos. **No** cubre `supabase/config.toml` ni `docs/`.

| # | Sev. | Archivo | Problema |
|---|---|---|---|
| H01 | 🟠 | `src/server/supabase/browser.ts:1` | El cliente browser es inalcanzable desde un Client Component |
| H02 | 🟠 | `src/server/supabase/server.ts:1` | Falta `import 'server-only'`, que la regla 20 exige para todo `src/server/**` |
| H03 | 🟡 | `docs/onboarding.md:20` | Sigue describiendo base local y llama a un script inexistente |
| H04 | 🟡 | `supabase/config.toml:1` | Configura Docker local, contrario a la dirección de la ficha |
| H05 | 🟡 | `src/server/supabase/clients.test.ts:37` | «No hay claves en el repo» se verifica sobre tres archivos |
| H06 | 🟡 | `package.json:18` | El DoD exige correr `db:types`, que ninguna máquina puede ejecutar |
| A01 | 🔵 | — | Tres archivos fuera de los «Archivos permitidos» |

---

## Lo que está bien

- **`admin.ts` tiene `server-only`**, que es el ítem explícito del DoD, y usa `serverEnv.SUPABASE_SERVICE_ROLE_KEY` sin hardcodear nada.
- **No hay claves en el diff.** Lo verifiqué con un barrido de patrones (`eyJ…`, `sbp_`, `sb_secret`, `service_role=`): la única coincidencia es la palabra «service_role» en un comentario.
- **`supabase` está fijado a versión exacta** (`2.116.0`) en `devDependencies`, y figura en la allowlist de `verify-approved-packages.test.ts`.
- **`server.ts` maneja bien el caso de Server Component de solo lectura**: el `try/catch` alrededor de `cookieStore.set` es el patrón correcto de `@supabase/ssr`, y el comentario lo explica.

---

## H01 · 🟠 El cliente browser es inalcanzable desde un Client Component

**Archivo:** `src/server/supabase/browser.ts`
**Estado:** `[VERIFICADO]`

### Diagnóstico

`browser.ts` existe para que un Client Component cree su cliente de Supabase. Pero vive en `src/server/`, y la regla `cadeapp/client-no-server` —la que T-000 instaló y T-001 endureció— prohíbe que un archivo `'use client'` importe de `@/server/**`.

### Evidencia

```tsx
'use client';
import { createClient } from '@/server/supabase/browser';
export function C(){ const c = createClient(); return <div>{String(!!c)}</div>; }
```

```
probe.tsx:2:1: Violación de frontera arquitectónica: Un archivo con directiva "use client"
no puede importar de src/server/** ni features/*/server según la regla 20.
[Error/cadeapp/client-no-server]
```

Es **exactamente el patrón de `PR47-H11`**: una API pública que no es alcanzable desde el lado de la frontera al que dice servir. Allá fueron las Server Actions del template; acá es el cliente del navegador.

### Por qué pasó

La ubicación la dicta el propio plan: `docs/implementation-plan.md:157` dibuja `server/{supabase/{server,browser,admin}.ts,…}` y la ficha T-002 repite esa ruta. O sea, **el agente siguió el plan**; lo que está mal es el plan, que ubica un cliente de navegador dentro de una capa que la regla 20 define como enteramente server-only.

### Arreglo

Hay que elegir, y es decisión de @Lautaro073 porque toca la regla 20 o el plan:

- **(a)** Mover `browser.ts` a `src/lib/supabase/browser.ts`. `src/lib` es importable desde cliente, no tiene la restricción de `server-only`, y la descripción de la capa en la regla 20 —«utilidades sin estado y configuración pública»— le calza. Hay que actualizar el plan §4 y la ficha.
- **(b)** Dejarlo donde está y exceptuarlo en `cadeapp/client-no-server`. Más barato, pero abre un agujero con nombre propio en la frontera que costó tres rondas endurecer en la #47, y habría que probar que la excepción no se extiende.

Recomiendo **(a)**: la frontera «`'use client'` nunca llega a `src/server/**`» vale más que la comodidad de tener los tres clientes en la misma carpeta.

En cualquiera de los dos casos, el arreglo no está completo sin un **consumidor de prueba** que compile desde el lado cliente — es `AG-10`.

---

## H02 · 🟠 Falta `server-only` en `server.ts` y `browser.ts`

**Archivo:** `src/server/supabase/server.ts:1`
**Estado:** `[VERIFICADO]`

### Diagnóstico

La regla 20 es explícita: «`src/server`: … **Todo archivo de `src/server/**` empieza con `import 'server-only'`**». El plan §4 lo repite.

Estado real de la capa:

| Archivo | `server-only` |
|---|---|
| `src/server/env.ts` | sí ✅ |
| `src/server/supabase/admin.ts` | sí ✅ |
| `src/server/supabase/server.ts` | **no** ❌ |
| `src/server/supabase/browser.ts` | **no** ❌ |

En `browser.ts` la ausencia es *necesaria* —un cliente de navegador con `server-only` reventaría—, lo cual confirma H01: el archivo no pertenece a esa capa. En `server.ts` es un olvido liso y llano: usa `cookies()` de `next/headers`, así que es server-only de hecho, pero no lo declara.

### Por qué pasó

**No existe ningún control que verifique la invariante.** Ni `.eslintrc.json` ni el plugin propio tienen una regla para esto; la regla 20 solo lo enuncia en prosa. El test de T-002 comprueba `server-only` en `admin.ts` —el ítem que nombra el DoD— y nada más.

Es `AG-08` otra vez: el control no alcanza lo que dice cubrir, porque no hay control.

### Arreglo

1. Agregar `import 'server-only';` como primera línea de `server.ts`.
2. **Crear la regla que falta**, que es lo que evita la próxima repetición. Una regla en `tools/eslint-plugin-cadeapp/index.js` que exija el prólogo `server-only` en todo `src/server/**/*.ts` salvo `*.test.ts` y salvo el que se decida excluir por H01:

```js
'server-layer-must-be-server-only': {
  meta: { type: 'problem', docs: { description: 'Todo archivo de src/server/** empieza con server-only (Regla 20)' }, schema: [] },
  create(context) {
    const f = (context.filename || context.getFilename()).replace(/\\/g, '/');
    if (!/\/src\/server\/.+\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) return {};
    return {
      Program(node) {
        const tieneImport = node.body.some(
          (s) => s.type === 'ImportDeclaration' && s.source.value === 'server-only'
        );
        if (!tieneImport) {
          context.report({ node, message: "Regla 20: todo archivo de src/server/** debe empezar con import 'server-only'." });
        }
      },
    };
  },
}
```

Con su fixture positivo y **su caso negativo** (`AG-07`): un archivo de `src/server/` con `server-only` que no debe reportar.

---

## H03 · 🟡 El onboarding quedó desactualizado y cita un script inexistente

**Archivo:** `docs/onboarding.md:20-30`
**Estado:** `[VERIFICADO]`

La ficha T-002 pide «sección de base en `docs/onboarding.md` (**sin Docker local**)», y `docs/onboarding.md` está entre los «Archivos permitidos». **La PR no lo tocó.** La sección sigue diciendo:

```
## 3. Base local
pnpm supabase start
pnpm supabase db reset            # aplica migraciones + seed
pnpm db:types                     # no debería generar diff
```

Y la sección 4 invoca `pnpm test:db`, que **no existe**: los scripts son `dev, build, start, lint, typecheck, test, test:watch, test:coverage, db:types`.

El DoD «P2 o P3 levantan la base siguiendo solo el onboarding» no se puede cumplir con instrucciones que apuntan a un flujo descartado y a un comando que no está.

### Arreglo

Reescribir la sección 3 para el flujo remoto que la ficha define, y quitar o crear `pnpm test:db`. Vale la pena que T-003 sume un check que valide que los comandos citados en `docs/` existen en `package.json` — es barato y ya tiene dos casos.

---

## H04 · 🟡 `config.toml` va en dirección contraria a la ficha

**Archivo:** `supabase/config.toml`
**Estado:** `[ANÁLISIS]`

El archivo configura los puertos de `supabase start` (54321 API, 54322 db, 54323 studio), o sea el entorno **local con Docker**. La ficha actualizada dice «vinculación al proyecto remoto (`cadeapp-staging`)» y «sección de base … **sin Docker local**», y sus «Archivos permitidos» ya no incluyen `supabase/config.toml` (la versión anterior de la ficha sí lo incluía).

Lo llamativo: **el test premia justo lo que la ficha descartó.** `clients.test.ts:51-56` exige que `supabase/config.toml` exista y contenga `project_id`. Si mañana alguien sigue la ficha y borra el archivo, el test se pone en rojo.

### Arreglo

Decidir la dirección y alinear las tres cosas —ficha, archivo y test— en el mismo sentido. Si se mantiene el flujo remoto, `config.toml` sale y el test con él; si se vuelve al local, hay que revertir la ficha.

---

## H05 · 🟡 «No hay claves en el repo» se verifica sobre tres archivos

**Archivo:** `src/server/supabase/clients.test.ts:37-47`
**Estado:** `[ANÁLISIS]`

```ts
const files = fs.readdirSync(supabaseDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
for (const file of files) {
  expect(content).not.toMatch(/eyJhbGciOi/);
  expect(content).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);
}
```

El DoD dice «**no hay claves en el repo**». El test recorre `src/server/supabase/` y nada más: un secreto en `supabase/config.toml`, en `.env.example`, en `docs/` o en una migración pasaría sin que nadie lo note. Y mientras los tres clientes usen variables de entorno, el test pasa por construcción.

Revisé el repo a mano y **no hay claves** — el DoD se cumple. Pero no gracias a este test.

### Arreglo

Barrer el repo entero (excluyendo `node_modules`, `.next` y `.git`) con los patrones de secreto de Supabase: `eyJhbGciOi` (JWT), `sbp_` (personal token), `sb_secret_`, y `service_role` seguido de un valor. Es unas pocas líneas más y cubre lo que el DoD dice.

---

## H06 · 🟡 El DoD exige un comando que ninguna máquina puede correr

**Archivo:** `package.json:18`
**Estado:** `[ANÁLISIS]`

```json
"db:types": "supabase gen types typescript --project-id cadeapp-staging > src/types/database.types.ts"
```

`--project-id` contra un proyecto remoto necesita un token de Supabase. Y `docs/onboarding.md` declara, en su sección «Qué NO hay en tu máquina»:

> Credenciales de staging o producción, service role remota, **tokens de Supabase o Vercel**. Los tiene CI.

Así que el DoD «tipos generados con `pnpm db:types` sin diff» **no es verificable en ninguna máquina del equipo** por diseño del propio proyecto. O corre en CI (y entonces el DoD debería decirlo), o alguna máquina necesita el token (y entonces hay que cambiar la política de la regla 00 y el onboarding).

**Detalle asociado:** el script escribe en `src/types/database.types.ts`, que **no está** en los «Archivos permitidos» de T-002 — la ficha anterior sí lo incluía y la actualizada lo quitó. Correr el DoD violaría el alcance de la propia tarea.

### Arreglo

Decidir dónde corre `db:types` y dejarlo explícito en la ficha. Si es en CI, T-003 lo agrega como job y el DoD se redacta como «CI regenera los tipos y no hay diff». Y volver a incluir `src/types/database.types.ts` entre los archivos permitidos.

---

## A01 · 🔵 DECISIÓN — Tres archivos fuera de alcance

**Estado:** `[VERIFICADO]`

Los «Archivos permitidos» de T-002 son `src/server/supabase/**`, `package.json`, `.env.example` y `docs/onboarding.md`. Filtrando el diff quedan fuera:

| Archivo | Comentario |
|---|---|
| `docs/tasks/log/T-002.md` | La bitácora la **exige** el DoD común. La tensión es de la ficha, no del trabajo |
| `docs/tasks/T-002.md` | Ídem: la ficha de la tarea |
| `supabase/config.toml` | Sustantivo — va junto con H04 |

Los dos de `docs/tasks/` son el mismo choque que ya vimos: el DoD común pide bitácora y la ficha no da dónde ponerla. Conviene resolverlo **de una vez para todas las tareas** agregando `docs/tasks/**` a los archivos permitidos por defecto, en lugar de discutirlo PR por PR.

`supabase/config.toml` es otra cosa y se decide con H04.

---

## Patrón que se repite

`P10-desvio-de-ficha-sin-consultar` va **seis apariciones en tres PRs**. `AG-13` viene proponiendo el mismo control desde la #47: leer los «Archivos permitidos» de la fila y fallar si el diff los excede. Con tres PRs de evidencia, ya no es una hipótesis.

Y aparece un patrón nuevo que conviene mirar: **la ficha cambió de dirección sin que nadie lo notara**. H03, H04 y H06 son todos síntomas de que T-002 pasó de «Docker local» a «remoto» y el trabajo quedó repartido entre las dos versiones. No es culpa del agente que implementó; es que ningún control compara el entregable contra la versión vigente de la ficha.

---

## Metodología

Verificado contra `3ba9be6` con el árbol limpio. El probe del Client Component se creó y se borró. El barrido de secretos usó patrones de Supabase sobre el diff completo. Comandos en [`../evidencia/comandos.md`](../evidencia/comandos.md).

No verificado por ejecución: H04, H05 y H06 (lectura de la ficha, del test y de la política de credenciales).
