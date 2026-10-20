# Informe independiente — PR #452 — Ronda 2

**Fecha:** 2026-10-20  
**PR:** https://github.com/cadeApp/cadeApp/pull/452  
**SHA de autor revisado:** `ff7b9d70c7a836b78430d16c7585204e0dbac1d1`  
**Base develop real:** `d672f885125db006565b8e665383d1db043fb508` (merge PR #448)  
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES (0)**.

## Hechos comprobados y alcance

- PR #448 está mergeada y cerrada, commit de merge `d672f885`. `docs/contracts/CC-033.md`, `CC-034.md` y `CC-035.md` están disponibles en develop.
- `d51c5e735144b083eca6c23c23ec22e80cfb71ca` tiene dos padres: commit de revisión R1 `add4f31cc...` y merge de develop `d672f885...`: integración por **merge normal**, no rebase.
- `git compare develop...ff7b9d7`: 4 commits adelante y 0 atrás; no cambios de ejecución en el delta: 13 rutas, todas bajo `docs/`, incluyendo tres fichas de implementación, tres fichas UI actualizadas, el plan, bitácora T-384 y la carpeta de revisión.
- Bitácora `docs/tasks/log/T-384.md` leída: reporta 15 PASS/4 FAIL con arnés R1, `verify-fichas` 7/7 (referido por autor), `git diff --check` limpio. No marca falsamente hallazgos como verificados.
- No hay comentario humano nuevo ni threads de revisión de PR #452 aparte de la ronda 1 al leerla. La PR estaba en Draft.

## PR452-H01 — ARREGLADO Y VERIFICADO

**Anterior:** T-385/T-386 se presentaban como si CC-034/035 ya estuvieran mergeados antes de que #448 se cerrara.  
**Ahora:** #448 **está mergeada**; T-385:5-6 y T-386:5-6 indican contrato mergeado y «Bloqueo: ninguno». Las filas de plan T-385 y T-386, líneas 411-412, también indican `mergeado por PR #448`. CC-034 y CC-035 están presentes en develop.

**Comprobación:** 6/6 aserciones independientes de estado del contrato, ficha y plan; 4/4 mutaciones que reinstalan el estado obsoleto producen rojo en el control. **La PR no debe fingir «BLOQUEADA»** para satisfacer el arnés rígido de R1; los 4 FAIL reportados por el autor eran falsos negativos tras el merge. El arnés R1 se conserva como evidencia histórica; el de R2 cubre el caso correcto.

**SHA de verificación:** `ff7b9d70c7a836b78430d16c7585204e0dbac1d1`. Método: aserciones JS ejecutadas con textos del SHA remoto y comprobación del merge GitHub. No implementación SQL.

## PR452-H02 — ARREGLADO Y VERIFICADO

**Aristas documentadas:**
- T-376 → **T-384 (#449)**: `docs/tasks/T-376.md:4-5`, fila de plan §8 T-376 (401).
- T-380 → **T-385 (#450)**: `docs/tasks/T-380.md:4-5`, fila T-380 (406).
- T-383 → **T-386 (#451)**: `docs/tasks/T-383.md:4-5`, fila T-383 (409).

Las tres fichas añaden además en «Reconciliación» que la UI **no puede empezar** hasta que su tarea de implementación esté mergeada y el workflow `migrate-develop` aplique la RPC en Supabase Develop. No hay cambio en los DoD de las UI.

**Comprobación:** 9/9 aserciones (tres fichas, tres filas y tres gates de migración), 6/6 mutaciones eliminando la arista en memoria dan rojo. `board-sync.mjs` usa `useLocalTaskCards: true` y su parser lee IDs T-xxx de la primera línea de dependencias. **Ojo:** también extrae el ID del **título del issue**. #435 tenía `[T-376]`; #442 y #447 tenían títulos `[QA]` sin T-id, por lo que `board-sync` las ignoraba. Esta revisión hizo el arreglo mínimo directamente en GitHub:

- #442 → `[T-380] [QA] Admin no puede reactivar un repartidor suspendido ni reconsiderar un rechazado`.
- #447 → `[T-383] [QA] La suscripción push falla si el navegador quedó suscripto con otra cuenta`.

Ambos títulos se verificaron por lectura posterior. No se tocaron cuerpos, etiquetas ni workflows. El siguiente `board-sync` ordinario **podrá** mapear las fichas; no se declara que haya ejecutado todavía ni que haya cambiado el tablero.

**SHA documental verificado:** `ff7b9d70c7a836b78430d16c7585204e0dbac1d1`; metadatos de issues comprobados en GitHub durante ronda 2.

## Matriz de comprobaciones de la ronda

| Control independiente | Resultado |
|---|---|
| DoD de T-384/385/386 = plan | 3/3 |
| Bitácora y carpeta de revisión autorizadas | 3/3 |
| Suite futura dos sesiones + mutación exigida | 3/3 |
| H01: estados correctos de contratos en fichas, plan y develop | 6/6 |
| H02: dependencias y migración posterior en tres fichas | 9/9 |
| Parser y carga de fichas de board-sync | 2/2 |
| Diff contra develop solo documentos | 1/1 |
| **Total verificaciones independientes** | **27/27 PASS** |
| **Mutaciones de controles documentales** | **10/10 RED detectadas** |
| `pnpm vitest run tools/verify-fichas.test.ts` | 7/7 **declarado por el autor**; no reproducido |
| `git diff --check` | limpio **declarado por el autor**; no reproducido |
| `db-tests`, E2E, Supabase/Docker | NO exigidos ni ejecutados, PR solo documentación |
| `git merge-tree` local | No ejecutado; GitHub informa mergeable y ahead 4/behind 0 |

El arnés de R2, las mutaciones en memoria y las limitaciones de ejecución están documentados en `../evidencia/comandos.md`. No se hacen afirmaciones sobre RPC funcionando, RLS real, migración aplicada ni CI del futuro código.

## Conclusión

**SIN BLOQUEANTES DOCUMENTALES**, H01/H02 corregidos y verificados sobre el SHA indicado. Las fichas pueden mergearse como documentación si GitHub permite Ready/merge; **T-384/385/386 continúan sin implementar sus RPC** y las UI T-376/380/383 no pueden comenzar hasta que la respectiva implementación haya sido mergeada y `migrate-develop` aplicado en Develop.

No hace falta rerun de CI verde únicamente por actualizar estos registros. No se aprobó, no se cambió Draft y no se mergeó la PR.
