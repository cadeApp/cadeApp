# Revisión independiente · PR #458 / T-380 · Ronda 2

**Fecha:** 2026-10-20  
**SHA revisado:** `acd94ce13e318a279e2926c5dc4dce8200912c02` · **base:** `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`  
**Resultado:** **SIN BLOQUEANTES de implementación** · 0 hallazgos nuevos · 0 decisiones pendientes.  
**Aún no se declara listo para merge:** `db-tests` y `e2e-preview` del último SHA seguían sin concluir en el momento de revisar.

## Sincronización, alcance y autoría

- El HEAD remoto de PR #458 coincide con `acd94ce13e318a279e2926c5dc4dce8200912c02`, rama `feat/T-380-admin-reinstate-courier` hacia `develop`; comparación de commits `develop...acd94ce13e318a279e2926c5dc4dce8200912c02`: 0 detrás, 8 adelante, sin conflictos según GitHub (mergeable true).
- Desde la última carpeta de revisión `ab888679e55c406de1fdbb3eaa53432ebcc3a4f3` solo se modificaron **dos archivos permitidos**: `src/features/admin/components/applicant-detail-view.test.tsx` (+6/-3) y `docs/tasks/log/T-380.md` (+246). No se tocó `docs/revision-pr/pr-458/**` por parte del autor, ni la ficha ni la lógica de negocio.
- No hay nuevas decisiones de alcance/CC; el contrato CC-034 y los cambios productivos ya fueron revisados en R1. No hay secretos ni operaciones remotas realizadas desde esta revisión.

## Revisión de H01 · CORREGIDO

La línea que usaba `setTimeout(resolve, 50)` ya no existe en el caso del segundo submit. En `applicant-detail-view.test.tsx`, el segundo `fireEvent.submit(form)` se entrega con `await act(async () => { ... })`; después se afirma una sola llamada mientras la promesa de `reinstateCourierAction` permanece abierta, se resuelve la promesa y se exige un único `refresh`.

El autor registró M9 con RED `Tests 1 failed | 18 passed (19)` por `expected "vi.fn()" to be called 1 times, but got 2 times` tras retirar la guarda `decisionInFlight.current`; al restaurarla, GREEN `Tests 19 passed (19)`. M5 repite la misma mutación usando las dos suites.

**Comprobación independiente:** inspección del test y del componente en `acd94ce13e318a279e2926c5dc4dce8200912c02`, ejecución en el entorno de revisión de un control **estático** que da GREEN en el source real y RED al suprimir en memoria la guarda, más lectura del job unit oficial de ese SHA (`151/151` archivos y `2964/2964` tests). **No se ejecutó Vitest ni se indujo un RED dinámico desde este entorno:** no se presenta la salida del autor como una mutación propia. Estado `arreglado-verificado` para la eliminación del sleep y presencia del guard, con método expresamente acotado a estática + CI.

## Revisión de H02 · CORREGIDO

La bitácora añadió una sección nueva sin sobreescribir la anterior. Para cada mutación **M1–M9** figuran ruta, snippet antes/después, comando de Vitest, fallo esperado/observado, línea de resúmenes `Test Files` / `Tests` en RED (exit 1), y GREEN (exit 0) tras restaurar desde copia en memoria. Comparé las nueve preimágenes contra los archivos productivos del SHA; las nueve existen **exactamente** en origen. Se examinaron M1–M9 (no se repitieron solo una o dos).

**Comprobación independiente:** ejecuté un validador de contenido que enumera nueve secciones completas y coteja sus snippets con el código real. La primera versión de ese validador dio un falso resultado negativo por usar el grupo regex `[1]` (número) en vez de `[2]` (cuerpo); lo corregí antes del cierre, luego dio `9/9`. Esa corrección del verificador es una precaución de AG-60. No se afirma que el revisor haya corrido las mutaciones reales en Vitest. Estado `arreglado-verificado` respecto del **entregable de evidencia** que era el alcance de H02.

## CI oficial

**Ejecución de código de la ronda 2:** [CI 39445319788](https://github.com/cadeApp/cadeApp/actions/runs/39445319788), SHA `acd94ce13e318a279e2926c5dc4dce8200912c02`.

| Check | Observado |
|---|---|
| typecheck, lint, build, audit | success |
| unit | success: `151 passed (151)` archivos; `2964 passed (2964)` tests |
| bundle-budget | success advisory; `/admin/applicants/[id]` = 248 kB frente a límite 180 kB; igual valor documentado en R1, sin regresión nueva demostrada |
| db-tests | en curso durante la revisión |
| e2e-preview | pendiente en [run 39445508447](https://github.com/cadeApp/cadeApp/actions/runs/39445508447) |

**E2E anterior de producto** en [39436812843](https://github.com/cadeApp/cadeApp/actions/runs/39436812843), SHA `11f626b5`: la especificación `admin-courier-reinstate.spec.ts` pasó en 44.8 segundos, y el código de aplicación no se modificó desde entonces. Eso ayuda a contextualizar, pero **no permite afirmar que el E2E del nuevo SHA terminó verde**.

## Resultado y límites

- **BLOQUEANTES de código de esta ronda:** ninguno.
- **MEJORAS nuevas:** ninguna. No se amplía T-380 ni se exige corregir advertencias de bundle preexistentes.
- **DECISIONES:** ninguna.
- **No revisado:** sin pnpm local ni Docker; no se accedió a Supabase/Vercel remotos con credenciales. El git local no puede resolver github.com, de modo que los checks del reviewer son estáticos, y los dinámicos provienen de CI oficial.
- **Siguiente paso:** solo confirmar que `db-tests` y `e2e-preview` del SHA `acd94ce13e318a279e2926c5dc4dce8200912c02` acaben verdes y que la rama siga al día. No repetir toda CI por el commit de documentación de esta revisión. Lautaro073 realiza cualquier aprobación/merge, no el revisor.
