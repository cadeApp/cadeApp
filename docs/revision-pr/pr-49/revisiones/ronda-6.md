# PR #49 · Ronda 6 — `4010afa`

| | |
|---|---|
| **SHA revisado** | `4010afa` |
| **Commits nuevos** | `e183924` (H13, H14), `4010afa` (bitácora) |
| **Base** | `9f03018` |
| **Fecha** | 2026-09-21 |

## Veredicto

**Los 15 hallazgos técnicos están cerrados y verificados ejecutando.** Cero abiertos, cero decisiones pendientes. La PR está lista para aceptar.

Queda un solo ítem, y no es de código: **el cuerpo del PR no trae el checklist de seguridad**, que es uno de los tres puntos que §2 le manda verificar a quien aprueba. Es pegar un bloque.

| | |
|---|---|
| Cerrados y verificados | **15 de 16** |
| Decisiones pendientes | **0** |
| Abierto | 1 (H15 — cuerpo del PR, no código) |

## Checks en `4010afa`

| Comando | Alcance real | Resultado |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit`, todo el proyecto | exit 0 |
| `pnpm lint` | `next lint --dir src --file middleware.ts --max-warnings 0` | `✔ No ESLint warnings or errors` |
| `pnpm test` | `vitest run` | **66 passed (66)** en 8 archivos |
| `pnpm build` | `next build` | exit 0 · First Load JS **87.2 kB** |
| `pnpm install --frozen-lockfile` | | exit 0 · `Done in 322ms` |
| Alcance | 19 archivos vs. los «Archivos permitidos» | **0 fuera** — cuarta ronda consecutiva |

`pnpm test:db` y `rls_enabled.sql` no aplican todavía: la base es T-004 y T-005.

---

## 🔴→✅ H13 · Ahora la prueba sí atrapa la regresión

Se quitó `shell: process.platform === 'win32'` del `spawnSync`. Lo verifiqué **en rojo**, con el mismo experimento de la ronda 5: rompí `tools/db-types.mjs` insertando la semántica del bug original,

```js
writeFileSync(TARGET_FILE, '', 'utf-8'); // BUG SIMULADO (redirección >)
const args = process.argv.slice(2);
```

y esta vez el test **falla**:

```
AssertionError: expected '' to be '/* original types content */'
 ❯ src/server/supabase/clients.test.ts:141:30

 Test Files  1 failed (1)
      Tests  1 failed | 8 skipped (9)
```

En la ronda 5, ese mismo escenario pasaba en verde. Ahora el control existe de verdad. Restauré el script; la suite completa queda 66/66.

## 🔵→✅ H14 · El regex volvió a ser estricto

`tools/db-types.mjs:21` vuelve a `[a-z0-9]+`. Comprobado:

| URL | resultado |
|---|---|
| `https://placeholderprojectref.supabase.co` | `placeholderprojectref` |
| `https://abcdefghijklmnopqrst.supabase.co` | `abcdefghijklmnopqrst` |
| `https://cadeapp-staging.supabase.co` | `undefined` → cae a `--linked` |

La validación gratis que distingue un project ref de un nombre de proyecto está de vuelta.

---

## Lo que verifiqué para el checklist de seguridad

El ítem 5 del template —*«Ningún check, regla de lint o umbral de CI debilitado»*— es el que más fácilmente esconde algo, así que lo revisé aparte.

**No se apagó nada.** `grep` de `"off"`, `"warn"`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `.skip` y `.todo` sobre todo el diff: 0 coincidencias nuevas. Los cuatro scripts de check (`lint`, `test`, `typecheck`, `build`) están intactos. La PR **agrega** una regla, `cadeapp/server-layer-must-be-server-only`, en `"error"`.

Hay un solo ensanche, en `.eslintrc.json`:

```diff
 { "from": "lib",
-  "allow": ["domain", "lib"] }
+  "allow": ["domain", "lib", "types"] }
```

Es necesario y mínimo: `src/lib/supabase/browser.ts` hace `import type { Database } from '@/types/database.types'`. Y deja a `lib` consistente con el resto — `server`, `feature`, `app` y `fixture` ya permitían `types`; `lib` era el único que no. `types` es una capa de solo tipos, sin acoplamiento en runtime.

## 🔵 H15 · Falta el checklist de seguridad en el cuerpo del PR

El cuerpo se escribió con secciones propias (Cambios, DoD verificado, Evidencia de calidad) en vez de las del template, y quedaron afuera el **checklist de seguridad**, la casilla de «cada prueba nueva se demostró fallando», Dependencias nuevas y Rollback.

El template lo marca obligatorio *«si toca `supabase/`, `src/server/`, `.github/`, `.agents/` o `package.json`»*: esta PR toca tres de esos. Y §2 dice que quien aprueba verifica (1) CI verde, (2) informe de `revisar-pr` generado por él o ella, (3) **que el checklist de seguridad esté marcado**. El punto 3 hoy no se puede verificar porque la sección no existe.

No afecta al código. El bloque va en el comentario de cierre, listo para pegar.

Por qué ningún check lo atajó: `approval-policy` es de T-003 y todavía no existe; nada local lee el cuerpo del PR.

---

## Cómo terminó la PR

Seis rondas, 16 hallazgos. El recorrido, en orden de lo que costó:

- **Lo que se arregló rápido y quedó bien a la primera:** las fronteras arquitectónicas (H01, H02). Una regla de ESLint nueva, probada en las dos direcciones.
- **Lo que necesitó dos vueltas:** la coherencia de la documentación (H03, H11, H12). Cambiar la dirección de un flujo obliga a barrer todos los archivos que lo describen, y siempre queda uno.
- **Lo que necesitó tres:** la prueba de regresión de H08. Primero no existía (H13 ronda 4), después existía pero no ejecutaba nada (H13 ronda 5), y recién en la sexta atrapó el bug.
- **Lo que destapó deuda de otra PR:** H07. Correr `pnpm install --frozen-lockfile` —un comando que no está en el DoD— encontró que el lockfile venía desalineado desde T-000 y que yo no lo había visto revisando la #47.

El dato que queda para `AGENTS.md` está en [`lecciones.md`](../lecciones.md): AG-18 (tocar dependencias exige instalación limpia) es la que más rinde, y AG-21 (diferir trabajo exige editar el DoD de destino) la que más se repite disfrazada.
