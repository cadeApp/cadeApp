# PR #49 · Ronda 5 — `62cf1f9`

| | |
|---|---|
| **SHA revisado** | `62cf1f9` |
| **Commits nuevos** | `c35eb54` (H10, H12, H13 + residual de H06), `62cf1f9` (bitácora) |
| **Base** | `9f03018` |
| **Fecha** | 2026-09-21 |

## Veredicto

**13 de 15 cerrados y verificados. Cero decisiones pendientes.** H10 se resolvió por la opción (a), limpio, y H12 y el residual de H06 también.

Falta una sola cosa de fondo, y es incómoda: **la prueba de regresión escrita para cerrar H13 nunca ejecuta el script.** Pasa en el vacío. Lo demostré rompiendo el script a propósito.

| | |
|---|---|
| Cerrados y verificados | **13 de 15** |
| Decisiones pendientes | **0** |
| Abiertos | 2 (H13 reabierto · H14 nuevo, bajo) |

## Checks en `62cf1f9`

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` (`--dir src --file middleware.ts --max-warnings 0`) | limpio |
| `pnpm test` | **66 passed (66)** en 8 archivos (era 65) |
| `pnpm install --frozen-lockfile` | exit 0 · `Done in 316ms` |
| Alcance | 19 archivos, **0 fuera de la ficha** — tercera ronda consecutiva |

---

## 🔵→✅ H10 · Resuelto por la opción (a)

La ficha dejó de prometer un entregable inexistente. El título, el objetivo de `docs/tasks/T-002.md` y la fila del plan dicen ahora:

> configuración remota para `cadeapp-staging` **vía variables de entorno (sin requerir `supabase link` en local)**

Y el DoD de T-003 nombra el mecanismo: *«`ci.yml` falla si `db:types` deja drift … **usando `SUPABASE_PROJECT_REF`**»*. La cadena queda completa: quién lo hace, con qué, y cómo se demuestra.

## ✅ H06 residual y H12

`docs/onboarding.md:23` pasó a futuro y nombra a la ficha responsable: *«En CI (`ci.yml`, construido en T-003), se validará…»*.

`.env.example` cambió el host inventado por `https://placeholderprojectref.supabase.co`, que se lee como lo que es, y el comentario de arriba quedó con la forma correcta `https://<project-ref>.supabase.co`.

---

## 🔴 H13 · La prueba de regresión no prueba nada

El test nuevo (`clients.test.ts:122`) tiene la forma correcta: archivo temporal con contenido, correr el script con un flag inválido, verificar exit ≠ 0 y que el contenido no cambió. El problema está en una línea:

```js
spawnSync('node', [path.resolve('tools/db-types.mjs'), '--invalid-flag-force-fail'], {
  env: { ...process.env, DB_TYPES_TARGET_FILE: testFile },
  shell: process.platform === 'win32',   // ← acá
});
```

Con `shell: true` en Windows, Node **une los argumentos sin comillas**. La ruta del repo tiene espacios, así que `cmd` recibe:

```
node C:\Users\El Yisus Pai\Desktop\Proyectos\cadeApp\tools\db-types.mjs --invalid-flag-force-fail
```

y Node intenta cargar el módulo `C:\Users\El`. Corriendo el mismo `spawnSync` a mano:

| | `status` | ¿corrió el script? | primera línea de salida |
|---|---|---|---|
| `shell: true` | 1 | **NO** | `node:internal/modules/cjs/loader:1228` → `Error: Cannot find module 'C:\Users\El'` |
| `shell: false` | 1 | **SÍ** | `[db:types] Ejecutando: pnpm supabase gen types typescript --invalid-flag-force-fail` |

Las dos asserts se cumplen **en el vacío**: `status !== 0` por el module-not-found, y el contenido queda intacto porque no se ejecutó nada.

### Demostrado de punta a punta

Rompí `tools/db-types.mjs` a propósito, insertando la semántica exacta del bug de la ronda 3 —truncar el destino antes de ejecutar—:

```js
writeFileSync(TARGET_FILE, '', 'utf-8'); // BUG SIMULADO (redirección >)
const args = process.argv.slice(2);
```

y corrí el test:

```
✓ src/server/supabase/clients.test.ts (9 tests | 8 skipped) 44ms
  Tests  1 passed | 8 skipped (9)
```

**Pasó.** La prueba escrita para impedir que vuelva la pérdida de datos no la detecta. Es `P04-test-tautológico` otra vez, y en un test escrito justamente para cerrar un `P04`.

(Después restauré el script; el árbol quedó limpio.)

**El arreglo es una línea: borrar `shell: process.platform === 'win32'`.** Para ejecutar `node` no hace falta shell, y sin shell los argumentos van tal cual. Verificado arriba.

> **Detalle que empeora el caso.** En una ruta sin espacios el test sí funciona. Los runners de CI usan rutas sin espacios; las máquinas del equipo, no (`C:\Users\El Yisus Pai\…`, y P2/P3 igual si su usuario de Windows tiene nombre y apellido). O sea: el control quedaría activo justo donde todavía no hay CI, y apagado en silencio donde sí se corre `pnpm test` hoy.

Nota aparte: **el arreglo de H08 sigue siendo correcto.** Lo verifiqué ejecutando el script por fuera del test —con `shell:false` corre, falla y no toca el archivo destino—. Lo que falla es la red que lo protege, no el arreglo.

## 🔵 H14 · El arreglo de H12 amplió el regex sin necesidad

El mismo commit cambió, en `tools/db-types.mjs:21`:

```diff
- const match = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
+ const match = url?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/);
```

No hacía falta. El placeholder nuevo ya lo parseaba el regex original:

| URL | `[a-z0-9]+` (antes) | `[a-z0-9-]+` (ahora) |
|---|---|---|
| `placeholderprojectref.supabase.co` | `placeholderprojectref` | `placeholderprojectref` |
| `abcdefghijklmnopqrst.supabase.co` | `abcdefghijklmnopqrst` | `abcdefghijklmnopqrst` |
| `cadeapp-staging.supabase.co` | *(no matchea → cae a `--linked`)* | **`cadeapp-staging`** |

La lectura fue que el problema era el regex; el problema era la URL. El regex estricto era **la validación gratis que distingue un project ref de un nombre de proyecto** — exactamente la confusión que originó H09. Ahora un valor mal puesto se pasa a `--project-id` en vez de caer al respaldo `--linked`.

Severidad baja: el fallo sigue siendo ruidoso y el archivo sigue protegido. Pero es `AG-14`: un arreglo no debería reducir otro control.

---

## Para cerrar

| # | Qué | Dónde |
|---|---|---|
| 1 | **H13** — borrar `shell: process.platform === 'win32'` del `spawnSync`, y volver a correr el test con el script roto para verlo en rojo | `src/server/supabase/clients.test.ts:127` |
| 2 | **H14** — volver el regex a `[a-z0-9]+` | `tools/db-types.mjs:21` |

Dos líneas. Con eso la PR queda para aceptar.
