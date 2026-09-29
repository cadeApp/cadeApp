# Nota de ronda 3 — PR #47 / T-000

**Estado:** árbol de trabajo, sin commitear
**Base:** `d0268345f72411148810a0ecf3eb5187890ada28`
**Fecha:** 2026-09-20

> Esto no es una revisión completa: es una nota de lo que encontré al verificar el arreglo de R01 mientras armaba esta carpeta. El trabajo está **a mitad de camino**.

---

## ⛔ `pnpm lint` está fallando ahora mismo

```
./src/features/_template/actions.ts
3:37  Error: No rule allows the entry point 'schemas.ts' in dependencies of type 'feature' with featureName '_template'  boundaries/entry-point

./src/features/_template/queries.ts
2:34  Error: No rule allows the entry point 'schemas.ts' in dependencies of type 'feature' with featureName '_template'  boundaries/entry-point
```

No son fixtures: son los archivos reales del template.

---

## Lo que sí quedó arreglado

El cambio en `.eslintrc.json` (quitar el `overrides`, agregar el elemento `feature-server-api`) **cierra R01 y el residual de H09**. Verificado:

| Caso | Resultado |
|---|---|
| `axios` y `lodash/get` en `src/features/_template/components/` | ✅ 3 errores (R01 cerrado) |
| Archivo suelto de feature → `@/server` | ✅ `boundaries/element-types` (residual de H09 cerrado) |

---

## R02 · Por qué se rompió

Al convertir `actions.ts`/`queries.ts`/`server.ts` en su propio elemento (`feature-server-api`), esos archivos **dejaron de ser internos** al elemento `feature`. Sus imports relativos a hermanos (`./schemas`) pasaron a evaluarse como dependencia entre elementos distintos, y ahí `boundaries/entry-point` solo permite `index.ts` y `server.ts`.

Confirmado en el código del plugin — `dist/Rules/EntryPoint.js`, función `modifyRules`: al normalizar las reglas solo conserva `to`, `allow`, `disallow`, `importKind`, `message` y `originalRuleIndex`. **Descarta `from`.** Por eso `entry-point` no puede distinguir «quién importa» y no hay forma de permitir el acceso solo desde dentro de la misma feature.

---

## Opciones evaluadas

### ❌ Opción A — agregar `schemas.ts` a los entry points permitidos

```json
"allow": ["index.ts", "server.ts", "schemas.ts", "copy.ts", "query-keys.ts"]
```

Arregla el lint, pero **reabre H08**. Verificado: el import profundo cross-feature `@/features/_template/schemas` vuelve a pasar sin error. Descartada.

### ✅ Opción B — un solo elemento `feature` + `overrides` que repite las listas base

Volver atrás en la separación de elementos y restringir `@/server` con `no-restricted-imports` en un `overrides` que **copia `paths` y `patterns` de la raíz** y le suma el patrón de `@/server` (era el «camino corto» de la ronda 2). Verificada completa:

| Caso | Resultado |
|---|---|
| `pnpm lint` | ✅ limpio |
| `axios` + `lodash/get` + `@/server` en `components/` | ✅ 4 errores |
| `query-keys.ts` → `@/server` | ✅ bloqueado |
| Import profundo de `schemas` (H08) | ✅ 1 error |
| `queries.ts` → `@/server` | ✅ permitido |
| `pnpm test` | ✅ 23/23 |

Archivo listo en el scratchpad de la sesión: `eslintrc-opcion-B.json`.

**Costo:** dos listas de paquetes que hay que mantener sincronizadas a mano. El día que alguien agregue un paquete prohibido a la raíz y se olvide del override, el hueco de R01 vuelve en silencio.

### 🔨 Opción C — regla propia `cadeapp/feature-server-boundary` (en curso)

Ya hay una implementación en `tools/eslint-plugin-cadeapp/index.js` que resuelve esto por archivo, sin tocar `no-restricted-imports` ni partir el elemento `feature`. **Es la mejor de las tres**: no duplica listas y no tiene el problema de `from` de `entry-point`.

Está a medias:

- ❌ No está conectada en `.eslintrc.json` (falta `"cadeapp/feature-server-boundary": "error"`).
- ❌ Los fixtures que la regla referencia en `isFixtureSimulatingFeature` (`feature-component`, `feature-hook`, `feature-loose`, `feature-schema`) no existen en `tools/lint-fixtures/`.
- ❌ Falta revertir la separación de elementos de `.eslintrc.json`, que es lo que rompe el lint.

**Recomendación:** terminar la opción C y revertir el elemento `feature-server-api`. Si hace falta cerrar rápido, aplicar B y dejar C para después.

---

## Cómo reproducir

```bash
npx next lint --dir src --file middleware.ts --max-warnings 0
```

Detalle de los probes en [`../evidencia/comandos.md`](../evidencia/comandos.md), sección R01.
