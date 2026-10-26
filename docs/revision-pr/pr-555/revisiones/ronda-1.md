# Informe de revisión independiente — PR #555 / T-416 — Ronda 1

**Fecha:** 2026-10-26  
**PR:** https://github.com/cadeApp/cadeApp/pull/555  
**HEAD revisado:** `48ec95b3b86b502a4349ae789f5fb7f0b258a9c4`  
**Base:** `develop` @ `24b2e374f90f7fd1257e53ed5a750b2a0e4724bb`  
**Resultado:** **CON BLOQUEANTES (2)**. **MEJORAS:** 1, no bloqueante.  
**Decisiones:** **D01=A** (aceptar ISO más estricto, documentar y probar `+0300` rechazado); decidida por Lautaro073 antes de publicar la ronda.

## Diagnóstico de la migración

- `package.json` y `pnpm-lock.yaml` resuelven `zod@4.6.7`, versión posterior al parche del GHSA-mrhx-c7xc-m3w5 (`4.6.6`).
- `src/domain/rpc-contracts.ts` conserva IDs históricos no RFC vía `z.string().guid()`; también se actualizaron los validadores concretos del diff.
- `src/lib/zod-messages.ts` diferencia `undefined` (obligatorio) del tipo erróneo y delega al error por defecto si no se proporcionó mensaje de tipo; los tests existentes muestran cobertura pertinente.
- No se detectó cambio de ficha T-416 entre `develop` y la rama. Los 29 archivos del diff están dentro de los globs permitidos.
- El cambio consciente de `+0300` no se considera una regresión por decisión D01=A. Lo bloqueante es que aún no hay test que la proteja.
- El aviso GHSA sobre colecciones sin cota no significa que Zod 4 inmunice todas las validaciones sin máximo; **riesgo separado de la migración** en #560, por inspección, sin afirmar explotación.

## Bloqueantes

### PR555-H01 · Falta el test negativo del offset compacto decidido

**Archivo:** `src/domain/t416-zod-v4.test.ts:27-31`  
**Severidad:** media · **Tipo:** BLOQUEANTE de prueba · **Evidencia:** [ANÁLISIS].

**Diagnóstico:** el test `las fechas que devuelven Postgres y JS...` afirma los formatos `Z`, `+00:00` y `-03:00` válidos y varias entradas inválidas; omite expresamente el offset compacto `+0300`. Aun cambiando inadvertidamente la validación para admitirlo, esa batería no fallaría. La decisión del propietario exige aceptar el estándar estricto y fijar el borde.

**Arreglo cerrado:** editar **solo** el test nombrado. Agregar `2026-10-26T10:00:00+03:00` a los positivos y `2026-10-26T10:00:00+0300` a los negativos, con expectativa `true` / `false` explícita. No modificar `isoTimestampSchema` ni introducir un nuevo validador.

**Verificación:** GREEN del test real sin mutar. Demostrar RED mutando exclusivamente en memoria/restaurando los bytes originales del schema para aceptar `+0300`, de modo que falle precisamente la aserción nueva. Luego GREEN sin mutación y `git diff` sin residuos. La secuencia reproducible propuesta está en `evidencia/comandos.md`; aún no ejecutada por esta revisión.

### PR555-H02 · No existe un E2E Preview en verde del SHA revisado

**Archivo de constancia:** `docs/tasks/log/T-416.md:35-38`  
**Severidad:** media · **Tipo:** BLOQUEANTE operativo · **Evidencia:** [VERIFICADO EN ESTADOS DE GITHUB, no reproducción E2E].

**Diagnóstico:** la bitácora informa una ejecución local contra Preview con **109 passed y 2 flaky**; los dos de `main-flow.spec.ts` pasan tras reintentos, pero el informe no trae un artefacto que esta revisión haya reproducido. En el HEAD revisado, GitHub publica `e2e-preview=error` porque se canceló [run 40278273817](https://github.com/cadeApp/cadeApp/actions/runs/40278273817) (job 121425701510). No equivale a E2E verde. La cancelación no es una falla funcional demostrada de Zod.

**Arreglo cerrado:** al publicar el próximo commit de corrección de H01, no cancelar la ejecución automática del Preview; dejar que el workflow confiable termine y que el estado `e2e-preview` del SHA nuevo marque `success`. No ejecutar manualmente workflows, no cambiar Playwright ni desactivar gates o reintentos. Registrar por separado cualquier `flaky`, con nombre del spec y causa verificada, no supuesta.

## Mejora no bloqueante

### PR555-H03 · +13 kB en First Load JS de 28 de 62 rutas comparadas

**Área:** versión de Zod y bundles de cliente · **Evidencia:** [VERIFICADO EN LOGS DE BUILD].

Los logs de `bundle-budget` de [develop @ 24b2e37](https://github.com/cadeApp/cadeApp/actions/runs/40272927740/job/121409795479) frente a [PR @ 48ec95b3](https://github.com/cadeApp/cadeApp/actions/runs/40278168669/job/121425674822) muestran incrementos uniformes:
| Ruta | develop | PR | Delta |
|---|---:|---:|---:|
| `/courier/feed` | 250 kB | 263 kB | **+13 kB** |
| `/courier/offers` | 160 kB | 173 kB | **+13 kB** |
| `/merchant/dashboard` | 272 kB | 285 kB | **+13 kB** |
| `/merchant/requests/new` | 252 kB | 265 kB | **+13 kB** |
| `/login` | 250 kB | 263 kB | **+13 kB** |

**Interpretación:** hay un incremento real de bundle coincidente con la dependencia migrada, pero no se demostró qué chunk lo explica. Muchas rutas ya incumplían 180 kB antes. El job retorna SUCCESS porque el presupuesto es advisory. **No se bloquea un parche de seguridad urgente por este dato sin causa o remediación acotada demostrada.** Seguimiento específico: [issue #561](https://github.com/cadeApp/cadeApp/issues/561). Relación con `pr-82/AG-92` (verde no garantiza cumplimiento cuantitativo).

## Checks y límites de la evidencia

- **SHA 48ec95b3, CI inspeccionada:** `typecheck`, `lint`, `build`, `audit`, `unit` y `bundle-budget` success. En el log de `unit`: **181 archivos, 3370 pruebas**. En `audit`: **3 moderadas**, sin la alta de Zod.
- `db-tests`: en la consulta estaba aún ejecutándose en este SHA. El commit funcional `f2f7182` tenía job en verde; esto no acredita el resultado final del SHA actual. No se levantó Docker ni Supabase local por instrucción del proyecto.
- `approval-policy`: failure esperado antes del informe independiente; no confundir fallo de proceso con defecto de código.
- `e2e-preview`: estado GitHub **error** por cancelación. La evidencia local (**109 passed y 2 flaky**) es **declaración del autor en bitácora**, no ejecución de esta revisión.
- **Checks locales del revisor:** no ejecutados. `git ls-remote`/`clone` sin DNS disponible. La inspección se hizo con archivos del HEAD de GitHub, diffs, comentarios y logs de Actions, no con worktree limpio.
- Las mutaciones de UUID/mensajes que declara el autor no fueron reproducidas por el revisor; se mantienen **sin verificar**. `verificado_en_sha` queda `null`.
- GitHub informa `mergeable=true` sobre la pareja de ramas consultada; no hubo `git merge-tree` local. No hay cambio de CC, ADR, migraciones ni ficha T-416 en los 29 archivos revisados.

## NO TOCAR

- No convertir de nuevo `.guid()` a `.uuid()`: perdería IDs existentes no RFC usados por fixtures.
- No crear un validador ISO personalizado: D01=A acepta el formato estricto.
- No suprimir la vulnerabilidad en `pnpm audit`; la migración ya elimina el aviso alto.
- No aflojar tests, inventar mocks, forzar verde ni alterar `docs/revision-pr/**` desde el agente.
- No refactorizar bundles ni límites de colecciones dentro de T-416: issues #561 y #560 los siguen por separado.

## Cierre y siguiente ronda

Pedir al agente un solo commit acotado de test + bitácora y el resultado del próximo E2E automático, con pruebas RED→GREEN verificables. Reabrir ronda 2 sobre el nuevo HEAD. **No aprobar ni mergear** con H01/H02 abiertos. El detalle del prompt quedó en el comentario de cierre de la PR y debe copiarse después de `git pull`.
