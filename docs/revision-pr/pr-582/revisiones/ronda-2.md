# PR #582 — T-400 · Revisión independiente, ronda 2

**Fecha:** 2026-11-03 · **SHA revisado:** `2764de210c4929ac2b5a6ea07357d441f1db3759` · **Base develop:** `f4bd475bdec8378fa819fc75388fc505b808bd25`.

**Resultado: CON BLOQUEANTES (1 nuevo, H03).** No aprobar ni mergear. H01 y H02 originales muestran correcciones coherentes con lo requerido, aunque no se ejecutó una mutación runtime independiente por falta de acceso git/pnpm. El nuevo H03 es una debilidad comprobada de la **nueva guarda** que introduce H02.

## Comprobaciones al inicio

- El head remoto y el PR coincidían con `2764de210c4929ac2b5a6ea07357d441f1db3759`. `develop` siguió en `f4bd475b...` (no se detectaron cambios posteriores en la ficha ni en dependencias, `mergeable: true` según GitHub). No se pudo ejecutar `git merge-tree` ni `git log` local; el API de commits confirma la secuencia `9a25af62 → 6ec5a777 (R1) → d277a858 (fix) → 40197470 (bitácora) → 2764de21 (refuerzo de H01/H02)`.
- Ningún comentario nuevo de revisión humana ni review thread; permanece el informe R1 del revisor. El autor **no modificó** `docs/revision-pr/pr-582/**`. Son 6 archivos cambiados desde R1, todos de «Archivos permitidos».
- Ficha `docs/tasks/T-400.md` leída desde `develop`, idéntica en la rama. No existe una ampliación de alcance ni 🔵 DECISIÓN.

## Hallazgos anteriores

**H01 — arreglado-sin-verificar (corrección visible + CI unit green).** `src/features/admin/queries.ts:550-558,677-682` usa `asAuditReason(after.reason)` únicamente para las cuatro acciones admitidas. A diferencia de `asText`, preserva el valor intacto si no es vacío. Mantiene el texto original sin trim; las pruebas `queries.test.ts:933-957` usan espacios y saltos periféricos; `audit-log-table.tsx:222` usa `whitespace-pre-wrap`. Correcto por inspección. Falta mutación independiente de la implementación en Vitest, prevista en comandos R2.

**H02 — arreglado-sin-verificar (mejora sustantiva + CI unit green).** `audit-catalog.test.ts` ahora deriva el dominio de `p_action` por cada migración con escritura dinámica, exige el `app_private.request_cycle` correspondiente, compara conjuntos exactamente, usa el dominio efectivo en `resolve()` para exigir etiquetas y valida llamadas con argumento literal. Las cuatro mutaciones del autor constan en la bitácora: T-369/CC-007 agregando valor, `report_incident` sin `return`, llamada a `request_cycle` con literal nuevo. No se reproducen como Vitest independiente en este entorno. **Residual nuevo:** el control introducido para justificar excluir `report_incident` puede confundir SQL no ejecutable con `return`; véase H03.

## BLOQUEANTE NUEVO

### PR582-H03 — `returnsBeforeWrite` reconoce `return` inerte como salida ejecutable

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice / AG-60, AG-75 · **Archivo:** `src/features/admin/audit-catalog.test.ts:167-172`.  

**Problema:** El regex busca la secuencia `\breturn\b` dentro de una rama y antes del `INSERT`, sin descontar comentarios SQL (`--`, `/* */`) ni literales entre comillas. Basta sustituir el `return jsonb_build_object(...)` real de `report_incident` por `perform jsonb_build_object(...); -- return eliminado` para **eliminar la salida anticipada sin cambiar el resultado del guard**. El flujo mutado podría alcanzar la escritura de `audit_log` para la acción que el catálogo excluye por considerarla inalcanzable, y no tiene etiqueta nueva por ser excluida.

**Evidencia independiente:** sobre el cuerpo SQL real de `20261017090000_t369_publication_credits.sql` recuperado desde GitHub se ejecutó el mismo patrón JS del test: original `true`; `perform` puro `false`; `perform` con `-- return`, `/* return */` o `raise notice 'return'` → **`true` falso**. Comparación de dominio: siete valores esperados contra siete detectados, sin cambio. Ver matriz y harness completo en `../evidencia/comandos.md`. **No inventar RED Vitest:** el resultado es reproducción de **la regex aislada** contra el SQL real, no una ejecución del runner original.

**Corrección concreta:** hacer que el análisis léxico del bloque SQL ignore comentarios de línea, de bloque y literales de texto al identificar sentencias `RETURN`, conservando posiciones (offset) para mantener el límite del `INSERT`; o exigir por parser explícito un `RETURN` ejecutable **como sentencia** dentro de la misma rama de `report_incident`. No eliminar la comprobación ni sustituirla por `toContain('return')`. Añadir casos que prueben cada falso positivo, con RED del **test** al mutar SQL temporalmente, y GREEN sin mutación. Nunca modificar migraciones en el commit real.

**Clase enumerada:** los falsos positivos reproducibles corresponden a comentario `--`, comentario `/* */` y literal SQL (`raise notice 'return'`); los tres afectan a la misma guarda y requieren un único arreglo del analizador. Los cuatro mutantes del autor siguen siendo válidos pero no ejercen estos límites léxicos.

## Estado de CI y E2E

En el SHA `2764de210c4929ac2b5a6ea07357d441f1db3759`: GitHub Actions run `41694433794` tiene `build`, `unit`, `lint`, `typecheck`, `audit` y `bundle-budget` en success. Log unit: **189 archivos Vitest aprobados** (comprobado en run previo `41693263827`, SHA `40197470`; en el head nuevo `unit` figura success) y suites Node (workflow 81/81 y ADR 6/6 en run previo). `db-tests` en curso (sin cambios SQL); `approval-policy` falló porque exige informe **SIN BLOQUEANTES**, lo cual no corresponde todavía. El `e2e-preview` estaba pendiente al revisar. La bitácora del nuevo commit `2764de21` registra E2E local 1 passed (53.5 s) sobre el Preview de `40197470`, además del anterior sobre `9a25af62`; todavía falta el E2E oficial del head `2764de21`. Estos resultados locales son evidencia escrita por el autor, no una ejecución independiente del revisor.

**Limitación del revisor:** no hay clon Git accesible ni pnpm en este entorno; `pnpm typecheck`, `pnpm lint`, `pnpm test` y `node analizar.mjs verificacion` no se corrieron localmente. Son observaciones de CI oficial por SHA y una batería de inspección/mutación en memoria. No se adjudica `verificado_en_sha` hasta que se ejecute una comprobación independiente del control real.

## Próximo paso

Corregir H03 **solo** en `src/features/admin/audit-catalog.test.ts`, registrar evidencia y E2E en `docs/tasks/log/T-400.md`, correr los controles. Ronda 3 revisará el nuevo analizador con mutaciones independientes y el CI del SHA final. Los fixes de H01/H02 quedan intactos.
