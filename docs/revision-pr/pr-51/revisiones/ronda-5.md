# PR #51 · Ronda 5 — `17eb44a` · Veredicto de aptitud

| | |
|---|---|
| **SHA revisado** | `17eb44a` |
| **Commits nuevos** | `17eb44a`, solo bitácora. **Cero cambios de código desde la ronda 4** |
| **Tamaño** | 18 archivos |
| **Fecha** | 2026-09-22 |

## Veredicto

**Casi, y lo que falta es más corto de lo que yo mismo dije.**

El código está terminado y revalidado contra el SHA final. Lo que impide aprobar hoy es un solo check rojo, y **ese check no depende de T-004** — me equivoqué al decirlo en las rondas 3 y 4. Se arregla con una PR de un archivo.

| | |
|---|---|
| Hallazgos cerrados | **9 de 12** |
| Abiertos | 3 (H08 · H11 · H12, nuevo) |
| Bloqueantes de código | **0** |
| CI | **7 de 8** — `db-types` rojo |
| Draft | **sí** |

## Checks revalidados en `17eb44a`

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | **72/72 Vitest · 17/17 workflows** |
| Árbol tras la suite | limpio |
| CI (run 35681459941) | `typecheck` `lint` `unit` `build` `bundle-budget` `db-tests` `audit` **pass** · `db-types` **fail** |
| Alcance | 18 archivos, **0 fuera de la ficha** |

---

## El drift de `db-types` no es un drift de esquema

Esto es lo que cambia la respuesta. Leí el diff completo del job y comparé las dos puntas:

| | stub commiteado | generado desde staging |
|---|---|---|
| `public.Tables` | `Record<string, never>` | `{ [_ in never]: never }` |
| `public.Views` | `Record<string, never>` | `{ [_ in never]: never }` |
| `public.Functions` | `Record<string, never>` | `{ [_ in never]: never }` |
| `public.Enums` | `Record<string, never>` | `{ [_ in never]: never }` |
| `public.CompositeTypes` | `Record<string, never>` | `{ [_ in never]: never }` |

**Los dos dicen lo mismo: el esquema `public` está vacío.** No hay ninguna tabla de la aplicación de un lado que falte del otro. Las ~640 líneas de diferencia son otra cosa:

- los tipos auxiliares que emite el CLI (`Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`, `CompositeTypes<>`, `Constants`);
- los esquemas **`storage`** (≈450 líneas) y **`graphql_public`**, que son de la plataforma Supabase, no de la app.

Así que **no hace falta que T-004 escriba ninguna migración para que este check pase.** Alcanza con commitear una vez la salida del generador: una PR de un archivo, `src/types/database.types.ts`, zona P1.

Y conviene hacerlo **antes** de mergear T-003, no después: el job en `mode=remote` va a estar rojo en **toda** PR que no toque `supabase/migrations`. Las que sí lo tocan —las de T-004 y T-005— caen en `mode=local` y comparan contra la base local, así que ellas no lo verían. El único que se come el rojo es el resto del equipo.

De paso, el archivo miente desde T-000: el encabezado dice *«Tipos generados automáticamente por Supabase CLI (T-002)»* y es un stub escrito a mano en `f71d858`, nunca regenerado. Lo único que hizo T-002 fue el script.

## 🔵 H12 · Si se commitea la salida tal cual, el contrato se lleva los esquemas internos de Supabase

**`tools/db-types.mjs:11` · bajo · análisis, no verificado ejecutando**

`pnpm db:types` corre `supabase gen types typescript --project-id <ref>` **sin `--schema`**, y la salida del job lo confirma: trae `storage` y `graphql_public` junto a `public`.

Si eso se commitea tal cual, el archivo de contrato pasa a contener ~450 líneas de internals de la plataforma. El problema no es el tamaño: es que **una actualización de Supabase —una columna nueva en `storage.objects`, un `buckettype` nuevo— aparece como drift y bloquea PRs que no tienen nada que ver.** Un falso positivo en un check que va a ser obligatorio.

`--schema public` lo evita y deja el contrato en lo que la app posee. Toca `tools/db-types.mjs`, fuera de la ficha de T-003, así que va con quien sincronice el contrato — la misma PR del punto 1.

No lo pude comprobar corriendo el CLI: la máquina de desarrollo no guarda credenciales de staging ni de producción (§2 del plan), así que esto es análisis sobre la salida del job, no verificación.

## Lo que sigue abierto de antes

- **H08** — el bloque literal del informe para el cuerpo. Está en [`ronda-4.md`](ronda-4.md), comprobado ejecutando el módulo real en LF y en CRLF. Si se pega hoy, la fecha queda bien: no entró código nuevo desde la ronda 4.
- **H11** — `.gitattributes` o `endOfLine: auto`. Nivel repo, otra tarea.

---

## Para aprobar

| # | Qué | Quién |
|---|---|---|
| 1 | PR de un archivo: `src/types/database.types.ts` generado, con `--schema public` (H12) | **@Lautaro073** |
| 2 | Pegar el bloque del informe en «Informe de revisión de agy» (H08) | **quien apruebe** |
| 3 | Sacar la PR de Draft | **@Lautaro073** |
| 4 | Aprobación de P2 o P3, con los 8 checks verdes | **@KiraK72 o P3** |

Con el punto 1 hecho, los 8 jobs quedan verdes y **la PR está para aceptar**. El punto 1 no es trabajo de T-003 y no debería frenarla más de lo que tarda una PR de un archivo.

Después del merge, y no antes, quedan las cosas que necesitan los workflows ya en la rama base: `SUPABASE_PRODUCTION_PROJECT_REF` en Actions, revisores obligatorios en los dos environments, la migración vacía en staging, los dos merges seguidos, y la política de aprobación sobre PRs reales — incluyendo el caso de H09, si el run disparado por `pull_request_review` actualiza el check del PR.
