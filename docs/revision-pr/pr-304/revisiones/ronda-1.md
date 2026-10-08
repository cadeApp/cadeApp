# Informe de revisión — PR #304 / T-349 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/304  
**HEAD de implementación revisado:** `255fdc2153e2afcfcb1e0c34c64221f04c6b6b5b`  
**Base:** `develop` @ `958076db46063b4128f72f52a581b95d7e6bf01f`  
**Fecha:** 2026-10-08  
**Decisión de Lautaro073:** **A — endurecer el control** (confirmada antes de cerrar la ronda).  
**Resultado:** **CON BLOQUEANTES (1)**.

## Alcance y contexto

Leídos los contratos de revisión y la ficha `docs/tasks/T-349.md` **desde develop**; cotejados el diff, la bitácora y la autorrevisión. Solo se alteraron `src/server/rpc/cc007.test.ts` y `docs/tasks/log/T-349.md`, dentro de los archivos permitidos; mutaciones A-D, `testArgs`, expectativas y timeouts permanecen sin modificar. `Refs #243` es correcto: no debe cerrar ese issue por un merge automático.

La PR estaba a un commit de `develop` (comparación GitHub: ahead 1, behind 0) y `mergeable=true` al consultar; no se ejecutó `git merge-tree` local por no disponerse de clon. La carpeta `pr-304` no existía antes de esta ronda y no había comentarios de revisión independiente.

## PR304-H01 — 🔴 BLOQUEANTE (alto) · P08 control-no-cubre-lo-que-dice

**Archivo:** `src/server/rpc/cc007.test.ts:195-202` · **Clasificación:** cobertura de pruebas · **Origen:** ambos (el código implementa literalmente los dos puntos de comprobación de la ficha, pero su objetivo general deja esta ventana sin cubrir).

### Diagnóstico

El `assertMutationIsolated` se ejecuta únicamente **antes** de `spawnSync`. Después de retornar el hijo, `executeMutation` devuelve el resultado directamente y el `finally` restaura el archivo temporal. El test final compara los cuatro archivos del checkout principal **después** de A-D, no durante la ventana entre el retorno del hijo y su finalización lógica.

Una regresión futura que escriba al checkout principal **después** de esa primera comprobación, y restaure los bytes antes del test final, deja verdes ambas comprobaciones existentes. La concurrencia con otro worker vuelve a ser posible en esa ventana. Este ejemplo no implica que el HEAD actual haga esa escritura; demuestra que su control no detectaría cierta regresión.

### Evidencia independiente y alcance de lo comprobado

**[VERIFICADO — arnés aislado]** Se ejecutó un pequeño script Node con archivos reales en un directorio temporal y reproduciendo las funciones `isInside` / `assertMutationIsolated` del HEAD y el orden de `executeMutation`. Una inyección que escribe `MUTATED` en el checkout principal *después* de un hijo simulado y restaura en `finally` dio:
- Control actual: **GREEN**, aunque hubo escritura fuera del worktree.
- Control con llamada posterior al hijo: **RED**, error `Isolation broken: ... changed in the main checkout while mutated`.
- Sin la inyección: **GREEN**, con bytes originales preservados.

El harness completo, copiable a `/tmp`, la ejecución y su salida están en `evidencia/comandos.md`. **No** se ejecutó en esta sesión el Vitest real en un clon de la PR, ni se reprodujeron los RED del autor: el contenedor no pudo resolver `github.com` para clonar. Es un hallazgo de análisis del código reforzado con reproducción del mecanismo en arnés, **no** un RED confirmado de la suite del repositorio.

### Arreglo acotado aceptado (decisión A)

En `executeMutation`, **inmediatamente después** del `spawnSync('pnpm', testArgs, ...)` y **antes** de `return res`, ejecutar de nuevo:

```ts
assertMutationIsolated(relativeFilePath, filePath, mainBefore);
```

La llamada permanece **dentro** del `try` para que el `finally` existente restaure el archivo del worktree si falla. No cambiar las mutaciones A-D ni sus expectations y timeouts.

**Mutación RED nueva obligatoria:** inyectar temporalmente *después* de `spawnSync` una escritura al archivo correspondiente del checkout principal con `mutated`; garantizar que se restaura `mainBefore` en el `finally` **solo del experimento**. Antes de agregar el segundo assert, esta inyección debe poder dejar verdes A-D y el test final; con el segundo assert, A-D deben fallar por `Isolation broken: ... changed in the main checkout while mutated`; una vez retirada la inyección, GREEN 13/13. El agente debe aportar líneas reales de salida; no fabricarlas.

**Límite explícito:** un segundo snapshot no identifica escrituras y restauraciones **ambas ocurridas dentro de la ejecución del hijo**. Esta ronda exige cerrar la ventana posterior al proceso hijo elegida por Lautaro073; no atribuir al control una garantía absoluta de monitoreo continuo.

## Lo que está correctamente implementado y no debe alterarse

- La primera guarda de ubicación usa `path.relative` para exigir la ruta bajo `mutationWorktree` y fuera de `repoRoot`.
- La comparación de bytes usa `Buffer.equals`; el snapshot final cubre `guards.ts`, `queries.ts`, `actions.ts` y la migración CC-007.
- Las cuatro mutaciones A-D siguen presentes con salida no-cero y `FAIL|failed`.
- Ni código de producción ni migraciones fueron cambiados.
- El fallo focal inicial de suite (13/13 casos pasados) fue documentado por el autor sin aumentar timeout; no se reprodujo independientemente y no se convierte en hallazgo sin evidencia adicional.

## CI de la implementación (antes del commit de revisión)

CI run [37722272323](https://github.com/cadeApp/cadeApp/actions/runs/37722272323) del SHA revisado:
- `unit` **PASS**: `Test Files 123 passed (123)`, `Tests 1942 passed (1942)`, `cc007.test.ts` 13 tests.
- `db-tests` **PASS**: `Files=19, Tests=1854, Result: PASS`; etapa preliminar adicional `Files=1, Tests=10, Result: PASS`.
- `typecheck`, `lint`, `build`, `audit` y `bundle-budget` **PASS**.
- Status externos `Vercel` y `e2e-preview` **success** para el mismo SHA.
- `approval-policy` **FAIL**: faltaba informe de revisión independiente sin bloqueantes, comportamiento esperado. Este informe **con bloqueantes** no autoriza marcarlo como aprobado.

Los checks verdes no inyectan escritura posterior a `spawnSync`, por lo que no contradicen H01. El commit de esta ronda mueve HEAD y dispara checks nuevos; estos datos **no** certifican el nuevo HEAD.

## Restricciones de corrección

Únicamente `src/server/rpc/cc007.test.ts` (bloque 9 / helper) y `docs/tasks/log/T-349.md`. No tocar `docs/revision-pr/**` (exclusivo del revisor), fichas, fuentes, migraciones, configuración Vitest, dependencias, archivos nuevos ni tests artificiales. Scripts auxiliares en `/tmp`.

No hubo aprobación ni merge. **Próximo paso:** el autor corrige H01 según prompt del comentario; luego revisión independiente de ronda 2.
