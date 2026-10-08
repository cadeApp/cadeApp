# Informe de revisión independiente — PR #304 / T-349 — ronda 2

**Fecha:** 2026-10-08  
**Implementación revisada:** `12c7e9a5fa004e6715a84751b6f9e847b0d9487c` (rama `feat/T-349-cc007-isolation-control`, contra `develop` `958076db46063b4128f72f52a581b95d7e6bf01f`)  
**Referencia ronda anterior:** [ronda 1](ronda-1.md), PR304-H01  
**Resultado técnico:** **SIN BLOQUEANTES NUEVOS; H01 corregido por inspección y evidencia complementaria**. `db-tests` terminó PASS; `e2e-preview` quedó pendiente en la última consulta.  
**Decisiones nuevas:** ninguna.

## Alcance y contraste

Desde el commit de revisión `f3090a8cc9a4a5f63287e4a8b7a76321d814e326`, la implementación `12c7e9a5fa004e6715a84751b6f9e847b0d9487c` modifica solo:
- `src/server/rpc/cc007.test.ts`: segunda llamada de `assertMutationIsolated` justo después de `spawnSync`, antes de `return res`, y comentario.
- `docs/tasks/log/T-349.md`: RED/GREEN y limpieza documentados.

Los demás archivos del diff general `pr-304/**` fueron escritos en la ronda 1 de **esta revisión**, sin modificación posterior del autor. Ninguna edición a mutaciones A-D, sus rutas `testArgs`, expectations, timeout, fuentes ni migración. La ficha T-349 desde `develop` permite ambos archivos; no hubo cambio de alcance. `develop` seguía en `958076db46063b4128f72f52a581b95d7e6bf01f` al consultar, la PR `mergeable=true` y el compare desde `f3090a8cc9a4a5f63287e4a8b7a76321d814e326` mostró un commit ahead/0 behind. **No** se corrió `git merge-tree` local por imposibilidad de clonar.

## PR304-H01 — corregido en el código

**Archivo:** `src/server/rpc/cc007.test.ts:193–205`.

La secuencia actual es exactamente:

```ts
fs.writeFileSync(filePath, mutated, 'utf8');
assertMutationIsolated(relativeFilePath, filePath, mainBefore);
const res = spawnSync('pnpm', testArgs, { cwd: mutationWorktree, shell: true, encoding: 'utf8' });
assertMutationIsolated(relativeFilePath, filePath, mainBefore);
return res;
```

Las dos guardas siguen dentro del `try` cubierto por `finally { fs.writeFileSync(filePath, original, 'utf8'); }`. No hay `writeFileSync` nuevo al checkout principal. Se corrige la ventana concreta elegida por Lautaro073 (opción A), incluida una modificación al archivo principal que permanezca tras finalizar el proceso hijo.

**Evidencia autor** (bitácora): el control anterior + inyección posterior al hijo arrojó 13/13 verde; el control nuevo + misma inyección 4 fallidos/9 pasados con `Isolation broken`, y la suite recuperada 13/13; typecheck/lint/test 1942/1942, `git diff --exit-code` de cuatro archivos con exit 0. **No fue reproducida por el revisor directamente en Vitest del repositorio.**

**Nueva batería del revisor — ejecución independiente:** un arnés autocontenido con archivos reales en `os.tmpdir()`, y **procesos hijos Node reales** que escriben cada uno de los cuatro archivos principales *durante* `spawnSync` y salen con status 1. Para cada archivo:
1. Un modelo fiel del control anterior (solo pre-hijo) permanece verde pese a la escritura.
2. Con la llamada posterior también presente, el control detecta `Isolation broken: ... changed in the main checkout while mutated` (RED).
3. Con hijo sin escritura, el control deja pasar el status del hijo (GREEN).
4. Los bytes de main/worktree se restauran y se limpian archivos temporales.

**4/4 casos independientes PASS**. Script **completo** y salida en [evidencia/comandos.md](../evidencia/comandos.md#ronda-2--bater%C3%ADa-independiente-con-hijos-reales). **Precisión:** este harness reproduce el comportamiento y orden de las funciones inspeccionadas, **no** ejecuta el `cc007.test.ts` real contra el repositorio; no se debe describir como verificación del RED en el SHA.

**Estado JSONL:** `arreglado-sin-verificar`, `verificado_en_sha=null` por regla de independencia: la comparación de SHA está basada en código remoto + CI, y la prueba de mutación fue sobre un arnés, no sobre la suite real. **No es un bloqueante técnico nuevo**; es la distinción de fuerza de evidencia.

**Límite conocido y aceptado:** dos snapshots no observan una escritura al checkout principal que ocurra y se restaure íntegramente durante la ejecución del hijo. Agy lo anotó. No se afirma monitoreo continuo ni se abre otro alcance para T-349.

## CI para la implementación revisada

GitHub Actions run [37724810211](https://github.com/cadeApp/cadeApp/actions/runs/37724810211), que checkouteó merge sintético `68183e4` de `12c7e9a5fa004e6715a84751b6f9e847b0d9487c` con `958076db46063b4128f72f52a581b95d7e6bf01f`.

- `unit` ✅: `Test Files 123 passed (123)`; `Tests 1942 passed (1942)`; `cc007.test.ts` 13 tests.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget` ✅.
- Vercel preview ✅ sobre el mismo SHA.
- `db-tests` ✅: `Files=1, Tests=10, Result: PASS` (etapa preliminar) y `Files=19, Tests=1854, Result: PASS` (etapa principal); leído directamente del log del job `113140445642`.
- `e2e-preview`: **pendiente** en la última consulta sobre el SHA (aún no es un pass confirmado); no asumir resultado.
- `approval-policy` ❌ por faltar el informe completo SIN BLOQUEANTES en el **cuerpo** de la PR. El workflow lee `pull.body` (`.github/workflows/approval-policy.mjs`), no los comentarios. Debe completarse la sección del cuerpo con un resumen de revisión independiente real.
- No se ejecutaron localmente typecheck/lint/Vitest del repo: `git ls-remote` falló por DNS (`Could not resolve host: github.com`). Las pruebas de CI son verificaciones externas del SHA.

## Conclusión

**Sin bloqueantes detectados en el código del arreglo H01.** El estado `arreglado-sin-verificar` refleja estrictamente el límite de reproducción independiente del RED/GREEN en la suite real. No mergear hasta confirmar `e2e-preview` y obtener `approval-policy` verde con el informe en el cuerpo. No se aprobó ni mergeó; #243 continúa abierto hasta verificar su DoD.
