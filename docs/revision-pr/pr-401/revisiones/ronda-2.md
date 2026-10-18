## Cierre definitivo de ronda 2 — HEAD integrado d88e01c1cb17fabe0f593be26fde45c4fffdd756

**RESULTADO: SIN BLOQUEANTES.** La integración con develop está resuelta y comprobada en el merge real. CI run **39059019921** finalizó **SUCCESS** con **141 archivos / 2668 tests unitarios**, **29 archivos / 2735 pgTAP**, CC-030 **47/47**, mutación de gracia 0 **7 RED y 47 GREEN**, concurrencia SQL/trigger RED→GREEN, integración T-369 GREEN, generación de `database.types.ts` idéntica, typecheck/lint/build/audit/bundle-budget y `approval-policy` verdes. La verificación fue del SHA **d88e01c1** (code merge), y los defectos H01/H02 conservaron el mismo blob de TS que se sometió a las mutaciones AST independientes. No hay otra ronda técnica exigible sólo por el commit de documentación de revisión.

`e2e-preview` **NO se ejecutó**: permanece bloqueado por necesitar la migración de CC-030 en Develop, previsto en el rollout. No presentar ese chequeo como verde. La promoción a staging/main y activar `enforce` siguen siendo decisiones humanas **posteriores**. **Esta revisión NO aprueba ni mergea**.

---

# Ronda 2 — Revisión independiente PR #401 / T-370 / CC-030 — 2026-10-17

**HEAD revisado:** `a980ee9d918a8f6fb36e3952c0b0989a098168fd` (cambios de código `ee7e2c1f`, fix SQL `a980ee9d`). **BASE al lanzar CI:** `711a2f7054d77fd664d3ec09b3bbdd24efb88476`. **Develop al cierre:** `708a9afb96da6e022031a02a548f0c47a524ecb3`. **Ronda final:** defectos de R1 corregidos y gate de integración H04 resuelto en d88e01c1, CI SUCCESS.

```text
Informe revisar-pr — T-370 — 2026-10-17 — revisión independiente (ronda 2)
Resultado: CON GATE DE INTEGRACIÓN (1); BLOQUEANTES DE CÓDIGO R1 CORREGIDOS
Checks CI sobre merge ref antiguo 941b73d: typecheck ✅ lint ✅ build ✅ audit ✅ unit ✅ (2599/2599), db-tests ✅ (2467/2467), CC-030 47/47, approval-policy ✅. E2E no ejecutado (requiere migración Develop).
H01: ARREGLADO-VERIFICADO EN SHA a980ee9d (por inspección AST independiente con mutación y CI).
H02: ARREGLADO-VERIFICADO EN SHA a980ee9d (por inspección AST independiente con mutación y CI).
H03: autorrevisión archivada, no editada por el autor durante arreglos.
H04 — PENDIENTE: develop avanzó 45 commits y añadió T-356, que interactúa con Storage. Hay que integrar develop y validar el árbol combinado.
```

## Ronda 1: comprobación de arreglos

### PR401-H01 — cerrada para SHA a980ee9d

Comparación mecánica desde `1516ba90`: `claimResultSchema.storagePath` pasó de `z.string().startsWith('courier/')` a `z.string().min(1)`. Sin cambios de migración productiva o bucket. `src/server/cron/orphan-courier-documents.test.ts` agregó el caso H01 que simula ruta `legacy/cc030_orphan_old.jpg` y verifica `Storage.remove` en `courier-docs`; conservó la prueba negativa de ruta vacía y las restantes. `supabase/tests/cc030_courier_docs_orphans.sql` añadió un caso real `pg_temp.put_object('legacy/cc030_orphan_old.jpg', now()-9d)`, plan 47. CI del commit ee7e2c1f detectó `malformed array literal` en esa prueba: el autor cambió el uso SQL de `ANY` por `'...'::text = any((subquery)::text[])` sin cambiar la aserción. En HEAD a980ee9d el caso pasa en db-tests 47/47. CC-030 documenta expresamente el alcance completo de nombres en el bucket.

**Control independiente:** archivo real verificado por blob SHA `fbb2e60d5b6a75fe4aaa9298d529caa089061bdb`. AST TypeScript GREEN de `storagePath: z.string().min(1)`. Mutaciones NUEVAS en memoria: `.min(128)` → RED, recuperar → GREEN; `.startsWith('courier/')` → RED, recuperar → GREEN. No se alteraron archivos del repositorio; no hubo runtime del proyecto independiente por falta de clon con dependencias.

### PR401-H02 — cerrada para SHA a980ee9d

Las tres ramas `if (claimError)`, `if (removeError)`, `if (completeError)` arrojan mensajes fijos sin interpolación. No se cambió `src/app/api/cron/sweep/route.ts`. Tres pruebas nuevas con mensajes de proveedor que contienen rutas ficticias verifican la excepción y su stack, con el control de que `complete` no se llama si Storage falla. En CI todas las 2599 unitarias pasaron.

**Control independiente:** AST del mismo blob comprobó exactamente esas tres ramas con `new Error(<literal constante>)`; mutaciones INDEPENDIENTES de interpolación para claim, remove y complete → cada una RED y restitución GREEN. Esta validación estática verifica la estructura peligrosa exacta; se complementa con los tests unitarios ejecutados por CI, no los reemplaza.

### PR401-H03 — proceso conservado

La autorrevisión del agente fue archivada por el revisor en `autorrevision-agy-r0.md`. Comparación GitHub `1516ba90...a980ee9d`: los **únicos cinco archivos modificados** son `docs/contracts/CC-030.md`, `docs/tasks/log/T-370.md`, `src/server/cron/orphan-courier-documents.test.ts`, `src/server/cron/orphan-courier-documents.ts` y `supabase/tests/cc030_courier_docs_orphans.sql`. Sin cambios del autor en `docs/revision-pr/**`.

## CI del SHA

Se verificó `CI run 39056606304`. En `unit` job `117465738987`: 140 archivos, **2599 tests** en verde. En `db-tests` job `117465739039`: `cc030_courier_docs_orphans.sql` GREEN con 47/47; mutación de gracia 0 falla 7 de 47 y al restaurar pasa 47/47; integración de concurrencia writer/claimer GREEN, trigger deshabilitado RED, restaurado GREEN; último `Files=28, Tests=2467, Result: PASS` y `database.types.ts` generado idéntico. `approval-policy` check 39056606326 SUCCESS. `typecheck`, `lint`, `build`, `audit`, `bundle-budget` SUCCESS. `e2e-preview` SKIPPED y status `error` debido a esquema sin migrar en Develop; **no** contarlo como verde.

**Límite importante:** GitHub Actions hizo checkout de `refs/remotes/pull/401/merge` en el commit `941b73d`: mensaje Git `Merge a980ee9d into 711a2f`. Es decir, el run en verde ensayó la combinación con el **develop anterior**, no con el develop actual.


**Actualización de integración, verificada después de leer los tests:** al corte, GitHub devuelve `mergeable=false`, `mergeable_state=dirty` para base `develop` ahora en `708a9afb96da6e022031a02a548f0c47a524ecb3` (**45 commits** detrás de la rama). Comparación mecánica de cambios desde el base anterior `711a2f`: hay **3 archivos solapados** entre T-370 y T-369: `.github/workflows/ci.yml`, `src/types/database.types.ts` y `supabase/tests/integration/cc025_backfill.mjs`. No todos necesariamente presentan marcadores de conflicto, pero requieren resolución consistente. En CI conservar T-369 (integración normal, mutación y verificación final) y CC-030 (16 líneas de mutación de gracia/trigger), nunca reemplazar un bloque por el otro; en tipos conservar todas las tablas/RPC T-369 y las dos RPC CC-030 y exigir `db:types --local` sin diff; en backfill conservar `--include-all` en las dos llamadas y la documentación del cambio de develop. Esto **no** se corrige inventando tests ni debilitando workflows. Si hay conflictos adicionales no listados, deben registrarse y analizarse en vez de decidir unilateralmente.

## PR401-H04 — NUEVO BLOQUEANTE DE INTEGRACIÓN (no defecto funcional demostrado)

La comparación GitHub `develop...a980ee9d` arroja **45 commits behind, 10 ahead**; el develop actual es `708a9afb`. Entre los cambios de develop están el flujo nuevo T-356: `src/features/courier-onboarding/actions.ts` suma `replaceCourierDocumentAction`, `components/document-replacement-card.tsx` nuevo y nuevos tests E2E de onboarding. Son justamente rutas del producto que usan `courier-docs` y `replace_courier_document`. Una lectura comparativa confirma que las subidas siguen usando `upsert:false` y el prefijo `courier/<uid>/`, sin una incompatibilidad demostrada. La API GitHub pasó a `mergeable:false`, `mergeable_state:dirty`: **hay conflictos de integración**, no sólo falta de tests del árbol combinado.

**Prueba necesaria:** sincronizar la rama `feat/T-370-huerfanos-storage` con `origin/develop` **mediante merge, nunca rebase**, sin resolver conflictos inventando comportamiento ni tocando la ficha de T-356. Ejecutar `git merge-tree --write-tree origin/develop HEAD` y checks focalizados más completos; después leer `db-tests`, `unit` y `approval-policy` del nuevo SHA. No habilitar `enforce` ni hacer comandos de migración manuales. Registrar el merge en la bitácora T-370, sin modificar `docs/revision-pr/**`. Si aparecen conflictos inesperados, detener y comunicar símbolos/rutas para revisión.

**Conclusión:** H01 y H02 están resueltos en el código revisado y sus controles nuevos funcionan. Antes de autorizar merge es necesaria la integración con los 45 commits recientes de develop y sus checks. Es un gate de coordinación, no una acusación de regresión efectiva.

**Sin merge a develop, sin aprobación, sin comandos contra infraestructura, sin Docker ni Supabase local/remoto** durante esta ronda.

## Actualización de integración ocurrida durante la ronda

**HEAD integrado definitivo analizado:** `d88e01c1cb17fabe0f593be26fde45c4fffdd756` — merge commit de dos padres (`a980ee9d918a8f6fb36e3952c0b0989a098168fd` y `708a9afb96da6e022031a02a548f0c47a524ecb3`). La PR pasó de `mergeable:false / dirty` a `mergeable:true` y la comparación con develop arroja **0 behind**. Antes de esto hubo 45 commits de develop sin incorporar; el agente los integró. No debe exigirse un segundo merge por el conflicto que ya está resuelto.

**Resolución constatada en GitHub:**
- `.github/workflows/ci.yml`: conserva el bloque de CC-030, las tres ejecuciones T-369 (normal, mutación y verificación final) y el resto de los controles anteriores. No se deshabilitaron checks.
- `src/types/database.types.ts`: conserva las tablas/RPC T-369 y las dos RPC de huérfanos de CC-030.
- `supabase/tests/integration/cc025_backfill.mjs`: conserva el comentario explicativo de T-369 y las dos opciones `--include-all` que habían introducido ambas ramas.
- `src/server/cron/orphan-courier-documents.ts`: blob Git **`fbb2e60d5b6a75fe4aaa9298d529caa089061bdb`**, idéntico al comprobado por mutaciones AST independientes. La migración productiva CC-030, el nuevo pgTAP plan(47) y los tests H01/H02 se mantuvieron.
- Las pruebas unitarias del CI integrado pasaron **141 archivos, 2668 tests**; typecheck, lint, build, audit, bundle y approval-policy también pasaron. `db-tests` del run `39059019921` estaba en curso al preparar esta adenda y requiere inspección del resultado y los conteos antes de cerrar H04; no declarar GREEN por anticipado.

La creación del commit de revisión es **sólo documentación** y no exige rehacer checks por sí misma conforme a la décima regla de equipo. No se ha hecho deploy ni merge de la PR a develop por parte de esta revisión.

## Cierre de H04

Integración completada en d88e01c1 con padres a980ee9d y 708a9afb; validado en CI SUCCESS run 39059019921. Se cerró como **arreglado-verificado**; no queda bloqueante técnico nuevo. Esta actualización es posterior a las etapas cronológicas documentadas arriba.
