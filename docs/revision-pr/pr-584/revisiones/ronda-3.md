# Informe de revisión — PR #584 / T-402 — ronda 3

**Fecha:** 2026-11-04 UTC (2026-11-03 en Argentina)  
**Head de código revisado:** `c4eba54c8e3d0b1936b5de9d0ca12dfab91c2c34`  
**Base original de PR:** `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a`; **develop actual:** `ceec11ef70df929fbebfe2dabd6012c86466dc05`  
**Resultado:** **CON BLOQUEANTES (1): H03 de integración.** H01 y H02 cerrados/verificados. No aprobar ni mergear.

## 1. Cambios de esta ronda y decisiones

Respecto del commit documental del revisor `4a265745`, el autor añadió 15 PNG en `docs/tasks/log/T-402-capturas/`, 3 líneas en la ficha T-402 y 10 en la bitácora; no tocó código funcional ni tests. La extensión de Archivos permitidos se limita a la carpeta de imágenes, solicitada por Lautaro073. D01 (7 secciones + getAdminOperatorName) continúa resuelta.

## 2. H01 — CERRADO, verificado en gate E2E

**Estado:** `arreglado-verificado`. **SHA comprobado:** `4a26574585d3d85a28ef679b4b33c10404f17efb`.

Se leyó íntegro el log del job de E2E: [run 41742929749 / job 126288767541](https://github.com/cadeApp/cadeApp/actions/runs/41742929749/job/126288767541). El workflow se disparó por `repository_dispatch` desde develop, pero el job **hizo checkout explícito del SHA 4a265745** (no confundir el `head_sha` del workflow con el commit sometido a prueba). Pasaron sin retry los dos tests de `admin-nav-mobile.spec.ts`: navegación de las 7 secciones a 390 px (línea 72) y prueba de umbral/escritorio 1023/1024/1280 (línea 109). Se conservaron las comprobaciones de iconos, aria-current, ancho y posición de main, nombre del operador y Salir. Las mutaciones CSS declaradas por el autor no se ejecutaron por cuenta propia, y su harness temporal no fue recuperado, pero la suite funcional original sí fue ejecutada oficialmente y el revisor inspeccionó logs con SHA.

**Resumen del gate:** `113 passed (chromium)` + `6 passed (global-settings)`; **1 flaky** en `admin-trips.spec.ts`, ajeno a T-402 (dos fallos y éxito en retry #2). El flake se documentó de forma independiente en [issue #585](https://github.com/cadeApp/cadeApp/issues/585).

## 3. H02 — CERRADO, capturas inspeccionadas 15/15

**Estado:** `arreglado-verificado`. **SHA comprobado:** `c4eba54c8e3d0b1936b5de9d0ca12dfab91c2c34`.

Se verificaron **15 imágenes PNG reales** mediante la API y apertura visual: 7 de escritorio de **1280×800**, 7 móviles de **390×844** y otra de **390×844** con menú abierto. El inventario cubre Postulantes, Comercios, Viajes, Incidentes, Novedades, Parámetros y Auditoría, sin faltantes. Muestran datos sintéticos de E2E; no se observaron datos reales ni hash DNI expuesto. La leyenda `DNI Hash: Pendiente` en Postulantes corresponde a la rama previa a T-401, sin un valor de hash real. Lautaro073 autorizó expresamente el cambio de entrega al repositorio, y la sección de capturas del cuerpo de la PR enlaza las 15 imágenes. **No hay pendiente manual adicional H02.**

## 4. H03 — BLOQUEANTE nuevo: conflictos con develop

**Detección:** API GitHub `GET /pulls/584` sobre `c4eba54c` devuelve `mergeable=false` / `mergeable_state=dirty`. La rama diverge desde `2ed5ef`: 5 commits nuevos en develop, final `ceec11ef`, pertenecientes a T-401 / PR #583. El diff nuevo de develop toca `src/features/admin/copy.ts`, `queries.ts` y `queries.test.ts`, que también toca T-402. **La comparación de parches demuestra solapamiento de archivos; no se ejecutó un merge-tree local para identificar cada marcador exacto.** No atribuir el conflicto a las capturas ni darlo por resuelto con CI verde.

**Corrección acotada:** en la rama `feat/T-402-admin-shell` ejecutar `git fetch origin` y `git merge origin/develop`, **nunca rebase, force-push ni amend**. Para las áreas en conflicto conservar del T-401 recién mergeado: eliminación de `dniHash`, campos `hasDni`, texto `dniLoaded/dniPending`, `merchantDisplayName`, `signupIncomplete`, pruebas de T-401. Conservar de T-402: `ADMIN_COPY.nav.menuButton/menuTitle`, `getAdminOperatorName` y sus tests, shell responsive y E2E; sin restaurar hash de DNI. Resolver sin alterar componentes de otras tareas ni la carpeta de revisión. Repetir tests de ambas tareas y validar `git merge-tree --write-tree origin/develop HEAD`.

**No implementar la fusión dentro de la revisión independiente:** afecta código funcional y tests de dos tareas convergentes, no es un cambio mínimo autoverificable. Pedir un commit de integración al agente y revisar un SHA nuevo antes del merge.

## 5. CI oficial leído y comparación de presupuestos

**Run CI 41742808125**, en SHA de código `4a265745`: `typecheck`, `lint`, `unit`, `build`, `audit`, `db-tests` y `bundle-budget` terminaron `success`. En el log `unit`: **189 archivos / 3459 tests Vitest** y cobertura All files 87.75% statements, 83.68% branches. En `db-tests`: **40 archivos / 3252 pruebas pgTAP, PASS**; el job también ejecutó mutaciones RED esperadas y validó `git diff --exit-code` del tipo de base. En `bundle-budget` la conclusión es `success` pero hay advertencias (p. ej. /admin/applicants 263 kB, /merchant/dashboard 292 kB); comparación independiente contra build de develop inicial `2ed5ef` confirma **delta 0 kB** en rutas admin y comercio/repartidor revisadas. No se interpreta verde como cumplimiento de presupuesto absoluto, ni se atribuye regresión de bundle a T-402.

El `approval-policy` de los SHA anteriores falló porque el cuerpo de la PR no contenía el informe completo. Se actualizará el cuerpo con el resultado veraz `CON BLOQUEANTES`; no falsificar `SIN BLOQUEANTES` solo para obtener un check verde. No exigir CI nuevo exclusivamente por adjuntar PNG o actualizar la revisión, pero **sí verificar la integración con el develop nuevo** tras H03.

## 6. Estado final de ronda y pendientes

- **H01:** cerrado/verificado, sin cambios nuevos pedidos al spec.
- **H02:** cerrado/verificado, sin tareas humanas pendientes.
- **H03:** abierto/bloqueante; merge de develop y verificación del resultado a cargo del agente.
- **QA #585:** issue independiente por flaky heredado de T-410; no bloquear funcionalmente T-402 sin relación causal demostrada.
- **D01:** opción A autorizada, no requiere nueva pregunta.

No hay decisión 🔵 pendiente. **PR aún Draft, no aprobada ni mergeada.** Siguiente ronda solo para verificar el nuevo SHA fusionado con develop.
