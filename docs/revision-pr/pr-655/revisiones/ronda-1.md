# Informe de revisión independiente — PR #655 / T-429 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/655  
**Head revisado:** `2b3576e68d8f02c492c810ea31fb47f4da35edae`  
**Código con CI/E2E oficial:** `b1858f176a7d4c078e76f72fe52deba4604dd7e9` (el commit posterior es solo bitácora)  
**Base develop:** `15dbf93f21662082bd45ca299d271e855049482a`  
**Fecha:** 2026-11-07

**Resultado: CON BLOQUEANTES (3).** H01 alto, H02 medio, H03 alto. No aprobar ni mergear. No hay nuevas 🔵 DECISIÓN: D01=B ya consta en la ficha.

## Alcance y hallazgos favorables
- Ocho archivos, +375/-5, todos dentro de los permisos de `docs/tasks/T-429.md` (ficha nueva; **no existe aún en develop**, por lo que se contrastó con issue #639 y la fila T-429 del plan). No hay dependencias, contratos, SQL ni workflows modificados.
- La detección `inspectStreamingSegments` clasifica correctamente los casos `S+B`, `S` huérfano y varios a la vez, por inspección y controles V8 aislados. El reporte `collectRevealState` está demostrado en el gate con `$RB.length=2`, `typeof $RT=number`, pestaña `visible`.
- La estrategia D01=B preserva las aserciones negativas de privacidad en `admin-trips` y el scoping a `<main>` en `admin-courier-reinstate`; los filtros visibles se limitan a cuatro afirmaciones positivas de UI.
- Dos intentos exitosos de E2E para SHA de código `b1858f176a7d4c078e76f72fe52deba4604dd7e9`; detalles y salvedades en `../evidencia/comandos.md`.

## H01 · Un boundary B: sin S: se considera terminado (BLOQUEANTE, alto)
**Archivo:** `e2e/helpers/skeletons.ts:11` y `e2e/helpers/streaming.ts:23-32`. **Patrón:** P08-control-no-cubre-lo-que-dice; raíz: P06-enumeracion-incompleta.

**Diagnóstico.** El estado `pending` solo enumera elementos `div[hidden][id^="S:"]` que ya llegaron. Si el servidor insertó el `<template id="B:1">` pero aún no llegó ningún `<div id="S:1">`, `inspectStreamingSegments` devuelve `{pending: [], orphaned: []}`. La expresión `NO_PENDING_SEGMENTS` queda `true` y el helper retorna antes de que termine el streaming. Viola la precondición explícita del DoD de esperar sin `template[id^="B:"]`. Los huérfanos `S` sin `B` **sí deben seguir permitidos** según D01=B.

**Evidencia independiente (RED).** Ejecutada la función extraída del SHA con un documento controlado con `B:1`, ningún `S:`: `pending=[]`, evaluación actual `true`, esperado `false`. Verde control con `B:1+S:1` y con `S:1` huérfano. Reproductor en `../evidencia/comandos.md`.

**Arreglo exacto.** Modificar `NO_PENDING_SEGMENTS` para exigir conjuntamente `document.querySelector('template[id^="B:"]') === null` y `inspectStreamingSegments(document).pending.length === 0`; no esperar a que desaparezcan los `S:` huérfanos ni borrar nodos del DOM. Agregar prueba `B solo` y matriz `B+S`, `S solo`, múltiples.

## H02 · Se reinicia el presupuesto de timeout (BLOQUEANTE, medio)
**Archivo:** `e2e/helpers/skeletons.ts:28-41`. **Patrón:** P05-semantica-invertida-vs-dod (timeout compartido declarado, timeout reiniciado implementado).

**Diagnóstico.** `waitForSelector(..., { timeout })`, el fallback `waitForSelector(..., { timeout })` y luego `waitForFunction(..., { timeout })` reciben **cada uno** el máximo completo. El código no comparte un deadline. El helper puede durar ~2T o 3T, contrario a «dentro de su mismo timeout». El tiempo adicional afecta el diagnóstico de gate y la capacidad de aislar flakiness, aun cuando los E2E actuales pasen.

**Evidencia independiente (RED).** Con stubs que consumen 14.000 ms de skeleton y 2.000 ms de streaming, la función real termina OK tras 16.000 ms para `{ timeout: 15000 }`; ambas APIs recibieron 15000. No es una medición de reloj de Chromium: es una simulación determinista de la política de tiempo extraída del código.

**Arreglo exacto.** Unificar en un solo predicado/poll con timeout total O medir `deadline = performance.now()+timeout` y pasar **solo el remanente** a las fases siguientes. Para no mantener la cascada `detached`→`hidden` que consume T antes de revisar elementos ocultos, comprobar `page.locator(selector).filter({ visible: true })` hasta `count=0` y usar el tiempo restante en streaming. Asegurar que la comprobación de skeleton cubra **todos** los elementos, no solo el primero. Mantener huérfanos como diagnósticos no bloqueantes.

## H03 · La suite no prueba la integración del helper (BLOQUEANTE, alto)
**Archivo:** `tools/e2e-streaming.test.ts:1-64`, `e2e/helpers/skeletons.ts:39-41`. **Patrón:** P08-control-no-cubre-lo-que-dice.

**Diagnóstico.** Los ocho tests importan exclusivamente `inspectStreamingSegments` y `collectRevealState`; ninguno importa ni llama `waitForNoSkeletons`. Una regresión que suprima `await page.waitForFunction(NO_PENDING_SEGMENTS, ...)` o `reportOrphanedSegments` deja todas esas unitarias inalteradas. Los gates exitosos demuestran las páginas probadas, pero no constituyen una prueba negativa controlada de la nueva espera.

**Evidencia independiente.** Se verificó por inspección que el archivo de tests no contiene `waitForNoSkeletons`. Un control independiente de invocación con stub pasó en verde sobre el helper original y dio RED al suprimir **en memoria** la llamada `waitForFunction` (`esperado 1; observado 0`). No se sustituyeron expectativas en la suite del autor ni se mutó el repositorio.

**Arreglo exacto.** Agregar en `tools/e2e-streaming.test.ts` pruebas del helper con un Page mock mínimo que ejecute la secuencia real (sin short-circuit de producción): espera cuando existe pendiente, deja pasar huérfano con diagnóstico, falla tras el timeout compartido, reporta `visibilityState/$RT/$RB`, y no pierde errores genuinos. Demostrar mutación que elimina `waitForFunction` → RED y restauración → GREEN; ejecutar el test también en el SHA posterior al arreglo.

## NO TOCAR / hipótesis descartadas
| Área | Motivo |
|---|---|
| `toHaveCount(0)` en `admin-trips` | Su intención de privacidad exige contar incluso texto oculto; no transformarlos en filtros visibles. |
| `admin-courier-reinstate` | Ya acota a `getByRole('main')`; los logs reales no indican modificarlo. |
| React/Next o DOM huérfano | D01=B aprobó un arreglo del test y diagnóstico; no borrar segmentos ni modificar `loading.tsx` sin un incidente funcional. |
| Excesos de bundle del CI | Preexistentes y no causados por esta PR E2E/documental; no abrir refactor fuera de alcance. |

## Checks y límites de verificación
| Check | Resultado y procedencia |
|---|---|
| GitHub CI en `b1858f17` | `success`: Vitest 199 archivos/3743 tests; typecheck, lint, build, db-tests exitosos (oficial) |
| E2E `42405675955` | dos intentos `success`, cada uno 123 Chromium + 7 global-settings (oficial); streaming 11 avisos en intento 2 |
| V8, controles independientes | H01 RED, H02 RED, H03 control GREEN y mutación RED, con stubs; **no Playwright** |
| Clon, pnpm local, git merge-tree | No ejecutados: entorno sin DNS hacia GitHub |
| `mergeable` | GitHub indica `true` para PR #655; no reemplaza `git merge-tree` |
| Autor M1/M2 | Resultados registrados en bitácora pero NO reproducidos independientemente (entorno sin clon/dependencias) |
| Último SHA documental `2b3576e6` | CI cancelado; no exigir otro green solo por bitácora, según regla décima |

## Para el arreglo y próxima ronda
1. El agente solo modifica `e2e/helpers/skeletons.ts`, `e2e/helpers/streaming.ts` si hace falta, `tools/e2e-streaming.test.ts` y `docs/tasks/log/T-429.md`. Ni ficha ni `docs/revision-pr/**`.
2. Mostrar RED→GREEN reales y no adulterar tests; reportar resultados exactos de Vitest, CI y gate por SHA.
3. Cuando publique el SHA, la revisión independiente enumerará toda la clase de B/S, presupuestos y escenarios con varios skeletons. `verificado_en_sha` permanece `null` hasta entonces.

**No hay acciones humanas obligatorias ni nuevas decisiones**: D01=B ya fue elegida. No mergear mientras H01-H03 sigan abiertos.