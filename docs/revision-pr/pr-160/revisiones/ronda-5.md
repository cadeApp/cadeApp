# Ronda 5 — PR #160 / T-303

**Fecha:** 2026-10-01  
**SHA revisado:** `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`  
**Resultado:** **CON BLOQUEANTES (1)**

## Criterio operativo confirmado por P1

Lautaro073 aclaró que las tareas E2E como T-303 no se consideran terminadas al mergear a `develop`.

Secuencia de cierre:

`PR → develop → promoción develop→staging → deploy/migraciones → E2E real en staging → tarea Hecha`.

En consecuencia:
- la ausencia de corrida real de `main-flow.spec.ts` en staging no bloquea por sí sola el merge de esta PR a `develop`;
- sí bloquea marcar el primer DoD y T-303 como terminados después del merge.

## Sincronización

Kira sincronizó correctamente hasta el `develop` `1457072a7cac1ae9e2a8a92abe9253d45b745082`.

Durante esta ronda `develop` avanzó a:

`01f8fb20587beb5b43b606103051deb49e1c01d1`

Comparación actual:
- ahead: 24
- behind: **9**
- merge-base: `1457072a7cac1ae9e2a8a92abe9253d45b745082`

Los commits nuevos de develop incluyen CC-014 y cambios grandes en `src/ui/map.tsx` / `src/ui/map.test.tsx`. Como T-303 publica solicitudes mediante el formulario que integra `MapPicker`, la rama debe absorberlos y volver a pasar CI antes de aprobación.

No hubo cambios del autor en `docs/revision-pr/pr-160/**` después del commit de revisión de Ronda 4.

## Revalidación Ronda 4

### PR160-H05 — ARREGLADO VERIFICADO

El body ya no marca como verde el comando compuesto cuando la corrida local de `pnpm test` terminó con exit code 1.

La revisión inspeccionó el CI del SHA exacto `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`, run **36956593490**, y verificó:

- `typecheck`: success;
- `lint`: success;
- `unit`: success;
- Vitest con cobertura: **110/110 archivos, 1602/1602 tests**;
- tests de workflows: **31 tests**;
- tests ADR: **6 tests**;
- `db-tests`: **13 archivos, 1614 tests, Result: PASS**;
- generación de tipos local + `git diff --exit-code`: job verde;
- build, bundle-budget y audit: success.

El rojo local del autor no se usa como verde; el CI del SHA exacto aporta la verificación reproducible en Linux.

### PR160-H10 — ARREGLADO SIN VERIFICAR

La concurrencia ya usa la fixture `context` de Playwright, que recibe el `baseURL` del proyecto.

Flow 5 mantiene sesiones separadas y crea el contexto del courier con:

```ts
const baseURL = testInfo.project.use.baseURL;
...
browser.newContext({ baseURL })
```

con fail-closed si falta la URL.

La estructura corrige el defecto. La verificación runtime se hará en staging después del merge.

### PR160-H11 — ARREGLADO SIN VERIFICAR

El test de privacidad ahora cubre:
- sentinel literal;
- dígitos crudos;
- `formatPhone(sentinelPhone)`;
- normalización por línea del texto visible;
- normalización individual de cada `href`.

Así detecta una fuga como `3865 12-3456` sin concatenar números no relacionados de todo el HTML.

La verificación runtime se hará en staging después del merge.

### PR160-H12 — SIGUE BLOQUEANTE

La rama volvió a quedar detrás de `develop`, ahora por **9 commits**.

No se considera un error de Kira en la sincronización anterior: `develop` avanzó después. Pero el estado actual impide aprobar porque entró CC-014 sobre el mapa usado por el formulario de publicación.

**Arreglo:** merge normal de `origin/develop`, sin rebase/force, y revalidar el nuevo HEAD.

## Estado de los arreglos anteriores

H08, H09 y R03 continúan corregidos estructuralmente y quedan pendientes de ejecución staging. H01, H02, H03, R01 y R02 tampoco se elevan como bloqueantes de merge: su verificación final es precisamente el gate post-merge en staging definido por P1.

## CI del SHA revisado

Workflow **CI #788**, run **36956593490**, del SHA `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`: **success**.

Resultados verificados en logs:
- Vitest: `Test Files 110 passed (110)`
- Vitest: `Tests 1602 passed (1602)`
- db-tests: `Files=13, Tests=1614`
- db-tests: `Result: PASS`
- `src/server/supabase/clients.test.ts`: 10 tests verdes; el timeout local conocido no reprodujo en CI.

## Gate post-merge de T-303

El workflow `.github/workflows/e2e-staging.yml` actual ejecuta únicamente:

`e2e/specs/smoke.spec.ts`

Eso sirve para el arnés T-301, pero no valida T-303.

Por decisión de proceso de P1, esto **no bloquea esta PR antes de develop**. Después de promocionar el commit de T-303 a staging debe correrse explícitamente:

```bash
pnpm exec playwright test e2e/specs/main-flow.spec.ts --project=chromium
```

contra el deployment de staging. Un smoke verde por sí solo no permite marcar T-303 como Hecha.

## Resultado

**CON BLOQUEANTES (1):**
- **PR160-H12:** sincronizar nuevamente con el `develop` actual y obtener CI verde sobre ese nuevo HEAD.

No aprobar ni mergear todavía.
