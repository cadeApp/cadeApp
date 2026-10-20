# Informe independiente — PR #452 — Ronda 1

**Fecha:** 2026-10-20  
**Autor:** @Lautaro073  
**Tareas:** T-384 (CC-033), T-385 (CC-034), T-386 (CC-035)  
**SHA inspeccionado:** `844f0c99f91184a5cc4bc069dc8512f0765c3adf`  
**Base develop:** `b35b0aef48608d0f3dd767460c65eccf56aed9f0`  
**PR de contratos pendiente:** #448, SHA `e06cb606651f0c94e4ae00eca12758eb9b2b8b53`  
**Resultado:** **CON BLOQUEANTES (2)**, sin aprobación ni merge.

## Qué se examinó

1. Reglas del repositorio: `AGENTS.md`, `docs/revision-pr/{COMO-ENTREGAR,README}.md` y `.agents/skills/revisar-pr/SKILL.md` de `develop`, más las lecciones históricas de revisión.
2. Diff completo de #452: `docs/implementation-plan.md` y las tres fichas nuevas; 4 archivos, +267/-0.
3. Contrato CC-033 mergeado en `develop`; contratos CC-034 y CC-035 desde #448, que continúa abierta. Fichas T-376 (develop), T-380 y T-383 (rama #448) y sus filas del plan.
4. Comentarios y threads de #452 (ningún comentario humano ni thread abierto al revisar), bitácoras T-384/385/386 (no existen todavía: tareas nuevas no implementadas), estado de ramas y metadatos.
5. 19 comprobaciones propias por lectura remota del SHA: **9 PASS / 10 FAIL** (10 condiciones agrupadas en 2 hallazgos). El arnés completo para repetir la verificación con worktrees limpios está en `evidencia/comandos.md`. Esta evidencia no equivale a ejecución de pnpm ni CI.

## Lo correcto y preservable

- T-384 autoriza exactamente la implementación previa a T-376. CC-033 ya está mergeado; no hay dependencia de #448.
- Las tres fichas separan implementación de RPC, dominio y pgTAP de las UI posteriores.
- Las tres alinean su primer DoD con la fila del plan y permiten bitácora y carpeta de revisión.
- Concurrencia con dos sesiones PostgreSQL reales, mutación `--mutation-check`, pruebas de contrato, fake y wrapper están previstas para las futuras PRs. **No se afirma que esas pruebas existan o hayan pasado.**
- Regla explícita contra mocks falsos, tests adulterados y pruebas de paso artificioso.
- No se observó edición del contrato o código dentro de #452.

## PR452-H01 — BLOQUEANTE · Estado de dependencia falso o incompleto en T-385/386

**Ubicaciones:** `docs/tasks/T-385.md:5,16-18`, `docs/tasks/T-386.md:5,16-18`; `docs/implementation-plan.md:404-405`.

Las dos fichas dicen `Dependencias (mergeadas en develop)` incluyendo CC-034 o CC-035, pero **ambos CC solo viven en la PR abierta #448**. La ficha ya contiene el aviso genérico de no empezar antes del merge del contrato, pero **ni ficha ni fila del plan explicitan el bloqueo actual, #448 y su condición de desbloqueo**, como decidió Lautaro073 (1-B). Esto puede hacer que un agy comience antes o trate como definitiva una versión todavía en review; los issues #450 y #451 aparecían con etiqueta `lista`.

**Corrección acotada:** en cada ficha separar dependencias efectivamente mergeadas de las pendientes, y escribir **BLOQUEADA hasta que CC-034/035 de PR #448 estén mergeados en develop**; reproducir la condición en la celda de dependencias de la fila T-385/386 del plan. Conservar el requisito posterior de verificar `migrate-develop` después del merge de la implementación antes de habilitar UI. No bloquear T-384 ni cambiar el alcance de los CC.

**Prueba RED actual:** 0/4 comprobaciones de bloqueo explícito (ficha + plan para ambos contratos); exactitud de CC y estado verificada contra la PR #448. **No hay arreglo para verificar todavía.**

**Origen:** ficha/plan + coordinación; patrón `P10-desvio-de-ficha-sin-consultar` (documentación de estado incoherente, no código defectuoso).

## PR452-H02 — BLOQUEANTE · Dependencias de las tres UI no incluyen tareas de implementación

**Ubicaciones:** `docs/tasks/T-376.md:4` y `docs/implementation-plan.md:401` (rama #452); `docs/tasks/T-380.md:4`, `docs/tasks/T-383.md:4` y las filas del plan de #448 (405 y 408 en el SHA revisado).

El tablero de tareas reconoce dependencias `T-xxx`, no CC-xxx, de modo que consignar solo CC-033/034/035 no impide comenzar la UI antes de que exista su RPC y haya migrado. La decisión 2-A ordena las nuevas dependencias, hoy faltantes.

**Corrección acotada:**
- **En #452:** `docs/tasks/T-376.md` + fila T-376 del plan: dependencia **T-384 (#449)**, manteniendo el requisito de RPC efectivamente aplicada en Supabase Develop.
- **En #448**, mientras siga sin mergear: `docs/tasks/T-380.md` + fila T-380 del plan: **T-385 (#450)**; `docs/tasks/T-383.md` + fila T-383: **T-386 (#451)**. No copiar estos archivos desde la rama #448 dentro de #452.
- Si #448 se mergea antes de ejecutar esas correcciones, `git merge origin/develop` en #452 y realizar la sincronización sobre las versiones realmente mergeadas; **sin rebase ni force push**.
- El primer bloque de dependencias no debe seguir diciendo que está todo «mergeado en develop» cuando T-384/385/386 aún son pendientes.

**Prueba RED actual:** 0/6 comprobaciones de dependencia (tres fichas + tres filas, de las ramas correspondientes). **No hay arreglo para verificar todavía.**

**Origen:** ambas (coordinación entre tareas y ficha); patrón `P08-control-no-cubre-lo-que-dice`, pues el tablero no interpreta CC-xxx como un gate de implementación.

## Decisiones de Lautaro073

- **1-B:** no esperar el merge de #448 para terminar las fichas. T-384 sigue disponible con CC-033; T-385/386 quedan explícitamente bloqueadas hasta merge de #448.
- **2-A:** agregar T-384/385/386 a las tres UI dependientes; aprovechar el control T-xxx del tablero y conservar el gate de migración de Develop.

No quedan decisiones técnicas por consultar en esta ronda.

## Pruebas, exclusiones y conclusión

La lectura cruzada de los documentos y el procesamiento independiente produjeron **9 PASS / 10 FAIL**. No se usó la batería del autor como fuente de verificación. Las aserciones que fallan corresponden a H01/H02; no son resultados de tests de software.

| Control | Estado |
|---|---|
| Coherencia de primeras cláusulas DoD y plan de las tres fichas | 3/3 PASS |
| Permiso de bitácora y revisión | 3/3 PASS |
| Declaración de suite de concurrencia + `--mutation-check` | 3/3 PASS |
| Bloqueo explícito de T-385/386 en ficha y plan | 0/4 PASS |
| Dependencia T-384/385/386 en fichas y filas UI | 0/6 PASS |
| `pnpm typecheck`, `lint`, `test` | No corridos; PR documental |
| `db-tests`, Supabase/Docker local, E2E | No exigidos ni ejecutados |
| Conflictos por `git merge-tree` local | No comprobado; sin clon local |

**Resultado final de ronda 1: CON BLOQUEANTES (2).** Se cierra documentalmente la ronda sin aprobación ni merge; se requiere un nuevo SHA de autor y una ronda 2 de revisión de H01/H02.
