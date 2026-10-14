# PR #305 · Ronda 2 — T-350

**Fecha:** 2026-10-08. **Revisión independiente:** ChatGPT.  
**SHA del arreglo inspeccionado:** `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc`; HEAD previo de revisión: `2440e80c3adde93a6796945c2046f4d40ca52953`.  
**Resultado: SIN BLOQUEANTES.**

## Verificación del alcance y sincronización

- En GitHub, la comparación entre el commit de la ronda 1 y `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc` tiene 1 commit nuevo y exactamente dos archivos modificados: `docs/tasks/T-350.md` (+90/-9) y `docs/tasks/log/T-350.md` (+36/-0).
- Nadie del lado del autor modificó `docs/revision-pr/pr-305/**`: no hay conflicto de autoría AG-36.
- La PR completa sigue siendo documental y la comparación de rama con `develop` informó 0 commits behind y `mergeable=true`. **No se pudo correr `git merge-tree` localmente** por falta de DNS hacia GitHub en el contenedor.
- La ficha T-350 no existía en `develop` antes de la PR: no hay una ficha previa cuyos requisitos se hayan expandido sin decisión. La fila del plan es idéntica a la ronda anterior.
- No se alteraron `src/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, tokens ni el test de T-309.

## Revalidación de todos los hallazgos

### PR305-H01 — arreglado-verificado, solo especificación

`docs/tasks/T-350.md:84-86,120-147` fija la decisión 1-A. Incorpora dos E2E provisionales de R07 y C06 en la PR `review/T-350-trip-axe` sin modificar el spec de T-309; C06 se autentica con `loginAsMerchant(page)`, genera viaje `matched`, afirma `Viaje en curso` y `Repartidor asignado` y usa los seis tags WCAG, `violations=[]`, `passes>0`. Define un RED de rol incorrecto. Verificador independiente de estructura H01: **GREEN**; mutaciones de identidad, aserción exclusiva y tag WCAG: **3/3 RED**.

### PR305-H02 — arreglado-verificado, solo especificación

`docs/tasks/T-350.md:107-118` obliga a crear la PR de verificación desde `feat/T-309-uploads-a11y` con su spec original, `package.json`, `pnpm-lock.yaml`, `@axe-core/playwright@4.13.0`; exige `pnpm install --frozen-lockfile` y `pnpm typecheck`. Los cambios y tests temporales no se portan a la PR real. Verificador H02: **GREEN**; mutaciones de branch base, dependencia y lockfile: **3/3 RED**.

### PR305-H03 — arreglado-verificado, solo especificación

`docs/tasks/T-350.md:139-169` ordena un segundo test temporal R07 y precondiciones en ambos tests: mapa `trip-route-map` real, `route-map-fallback` ausente, ambos pines visibles y canvas de Google efectivamente listo antes de axe; evidencia del selector real, sin inventarlo. RED explícito bloqueando SDK, protección de teclado/arrastre, sin DOM patches ni reglas axe desactivadas. Verificador H03: **GREEN**; mutaciones de fallback, pin, canvas, prueba de SDK y teclado: **5/5 RED**.

**Total:** 3 verificaciones estructurales GREEN y **11/11 mutaciones RED** en memoria. Esta ejecución confirma que los requisitos exigidos quedaron escritos; **NO demuestra que el futuro código ya funcione**.

## Auditoría de la evidencia y corrección propia

La `evidencia/comandos.md` de la ronda 1 tenía un harness erróneo: buscaba la implementación detallada dentro del apartado corto del DoD y leía un spec de T-309 que ni siquiera está en la rama de esta PR. Por tanto, podía reportar falsos rojos. Es **un defecto de la revisión anterior**, no del autor ni de T-350. Se preserva el texto original y se anexa el verificador corregido autónomo, que lee exclusivamente la ficha y verifica secciones completas y mutaciones dirigidas. Un primer intento superficial de mutación conservó falsamente GREEN tras quitar la aserción positiva porque la misma frase figuraba en la explicación de RED; se refinó el control para exigir exactamente la aserción `getByRole('heading', { name: 'Repartidor asignado' })`. Resultado final **11/11 RED**. Ver detalles y código completo en `evidencia/comandos.md`.

## Checks observados en CI para `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc`

| Control | Resultado |
|---|---|
| `typecheck`, `lint`, `build`, `audit`, `unit` | success |
| Vitest en `unit` | **123/123 test files; 1.942/1.942 tests** |
| Tests de workflows/ADR | 75/75 y 6/6 |
| `db-tests` | success: Files=19, Tests=1854, Result PASS; control extra Files=1, Tests=10, PASS |
| `bundle-budget` | success formal, pero **warning real** de 235 kB en rutas admin: fuera de alcance y sin cambios productivos de esta PR |
| `approval-policy` | failure esperado: el cuerpo de la PR aún no contiene informe final en sección `### Informe de revisión de agy`; el comentario solo no es suficiente. Se publicará el informe en el cuerpo después del commit |
| `e2e-preview` | status pendiente observado, no necesario para la ficha documental; el GREEN de T-350 es futuro |

No se corrieron tests locales sobre checkout porque el contenedor no puede resolver github.com. No se ejecutó Supabase o Docker local, ni se afirmó un GREEN E2E inexistente.

**Nota:** La bitácora del autor informa correctamente que los nuevos RED/GREEN quedan pendientes de la PR de implementación. No da salidas locales nuevas de `pnpm vitest run tools/verify-fichas.test.ts`, pero el job CI de unitarias cubre el HEAD documental y pasó. Cualquier cifra que no figure en log no se atribuye al autor.

## Decisiones / cierre

- Sin decisiones nuevas. La decisión 1-A y la condición de usar APIs oficiales de Google/@vis.gl quedaron respetadas.
- **SIN BLOQUEANTES** de revisión documental; lista para que Lautaro073 decida merge una vez que los checks obligatorios reporten éxito.
- La revisión no aprueba ni mergea. Al mergear, correr `tomar-tarea` T-350 y exigir la ejecución real de las pruebas E2E, con el nodo de foco y sus ancestros documentados.
