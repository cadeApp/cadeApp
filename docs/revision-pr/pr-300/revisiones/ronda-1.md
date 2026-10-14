# Informe de revisión independiente — PR #300 / T-349 — ronda 1

**Resultado: SIN BLOQUEANTES.**  
**HEAD funcional revisado:** `783640ab7db0550cd6efe9a9ece0d54734644136`  
**Base develop:** `cd023e3453ead76983d54982df1548cb97aa57eb`  
**Fecha:** 2026-10-07  
**PR:** https://github.com/cadeApp/cadeApp/pull/300

## Alcance e integración

Comparación `develop...HEAD`: `ahead=4`, `behind=0`, `mergeable=true`. El diff final (125 adiciones, sin cambios de runtime) incluye exclusivamente:

- `docs/implementation-plan.md`: fila nueva T-349;
- `docs/tasks/T-349.md`: ficha;
- `docs/tasks/log/T-349.md`: bitácora append-only.

No se encontraron commits ni archivos de revisión independientes previos en `docs/revision-pr/pr-300/**`; no hay review threads. Los merges normales de `develop` conservaron tanto T-348 (#301/#302, onboarding merchant) como la nueva T-349 (#243).

La ficha es nueva, así que su propio alcance se contrastó además con el **issue #243**, el `develop` real y la corrección ya mergeada de T-343 / PR #275, ronda 4.

## Verificación de contrato y diseño

El helper actual `executeMutation` en `develop:src/server/rpc/cc007.test.ts`:

- crea un `git worktree add --detach` temporal;
- usa `filePath = path.join(mutationWorktree, relativeFilePath)`;
- lanza el Vitest hijo con `cwd: mutationWorktree`;
- restaura `filePath` en `finally`;
- retira el worktree en `afterAll`.

La ficha no modifica nada de esto, sino que exige un **control de regresión determinista**:

1. con mutación aplicada, verificar que la ruta mutada permanece dentro del worktree y fuera del repo principal (mediante `path.relative`);
2. verificar que el archivo correspondiente en el checkout principal sigue byte a byte igual que antes;
3. tras el bloque de mutaciones, verificar la identidad de todos los targets contra el snapshot inicial;
4. demostrar un RED específico del control haciendo temporalmente `filePath` relativo a `repoRoot`, restaurar el cambio y obtener GREEN;
5. no adulterar mutaciones, `testArgs`, expectativas, tiempos ni paralelismo.

La enumeración completa de los **cuatro targets reales** es correcta:

- A: `src/features/auth/guards.ts`;
- B: `src/features/auth/queries.ts`;
- C: `src/features/auth/actions.ts`;
- D: `supabase/migrations/20260925170000_cc007_consent_enforcement.sql`.

El DoD del issue #243 conserva los cuatro elementos: no contaminar suite paralela, RED real A/B/C, restauración, y control antirregresión. Los tres primeros tienen antecedente verificado en T-343/PR #275; T-349 se limita al cuarto.

No se detectó una aserción tautológica exigida por la ficha: el RED debe producirse por ruptura auténtica del aislamiento, no por timeout, fallo de target, error de setup ni alteración del test.

## Decisiones humanas resueltas

- **PR300-A01 — aceptado, 1-A:** Lautaro073 ratifica el alcance reducido a crear el control de regresión. No reabrir ni reemplazar la solución del worktree de T-343.
- **PR300-A02 — aceptado, 2-A:** Lautaro073 ratifica `T-348 → T-349`, porque T-348 ya corresponde al prerrequisito RLS merchant #301/#302 en `develop`; conservar el nombre de la rama sin rebase es legítimo.

Las dos atribuciones que inicialmente eran solo afirmaciones del agente quedaron autorizadas explícitamente durante esta revisión. **No quedan decisiones pendientes.**

## Corrección editorial del body

El body decía que `verify-fichas` fallaba por T-348 antes del merge de #302. Eso ya es falso en el HEAD revisado: `verify-fichas` pasó **7/7**. Se corrige el body para usar evidencia exact-head sin modificar la implementación ni la bitácora histórica.

## CI del SHA funcional

CI `37693862892` **success**:

| Check | Resultado |
|---|---|
| lint | ✅ |
| typecheck | ✅ |
| build | ✅ (Compiled successfully in 20.4 s) |
| unit | ✅ (123/123 archivos, 1941/1941 tests) |
| verify-fichas | ✅ 7/7 |
| verify-workflows | ✅ 75/75 |
| ADR | ✅ 6/6 |
| db-tests | ✅ 19 archivos / 1854 tests |
| tipos DB | ✅ sin drift |
| audit | ✅ job success, 1 moderate y 1 high ignorada |
| bundle-budget | ✅ advisory; rutas admin/login preexistentes >180 kB |
| Vercel | ✅ |

**Gate E2E:** `e2e-preview` run `37694034304`, job cancelado sin evidencia de fallo funcional. Se invocó el rerun del job `113041139068`; no declarar verde hasta que el commit status de `783640ab7db0550cd6efe9a9ece0d54734644136` cambie realmente a GREEN. El run vive en `develop` por `repository_dispatch`, y publica status en el SHA target de la PR.

`approval-policy` `37693858024` estaba rojo porque el body carecía del informe completo independiente SIN BLOQUEANTES. Se añade luego de esta revisión; debe verificarse la nueva corrida.

## Resultado y próximos pasos

- **BLOQUEANTES:** ninguno.
- **MEJORAS pendientes:** ninguna.
- **Decisiones:** ambas aceptadas y cerradas.
- **No revisado:** implementación futura de T-349 y su RED/GREEN, porque esta PR solo crea la ficha.
- **No mergear** mientras `e2e-preview` del HEAD y el resto de los checks requeridos no estén correctos.
- Mantener **#243 abierto** al mergear esta ficha: falta implementar y verificar el control de T-349 en otra PR normal; no cerrar #243 automáticamente.

Revisión independiente: no aprobó ni mergeó.
