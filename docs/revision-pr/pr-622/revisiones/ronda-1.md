# Informe de revisión — PR #622 / T-422 — Ronda 1

**Fecha:** 2026-11-05. **Autor del análisis:** revisión independiente de ChatGPT.  
**PR:** https://github.com/cadeApp/cadeApp/pull/622  
**Head SHA revisado:** `58cb60e0c24b0f28a7300c933e9d3773cbf22c10` · **Base:** `develop` @ `7809c3991767bd1770b1e5d3d1f945ac38c34463`  
**Resultado:** **SIN BLOQUEANTES (0)** · **MEJORAS: 2**. No aprobar ni mergear desde esta revisión.

## Diagnóstico y decisión de emergencia

El job `e2e-preview` del run [42117303547](https://github.com/cadeApp/cadeApp/actions/runs/42117303547) falló antes de los specs, durante `pnpm exec playwright install --with-deps chromium`. El log identifica imagen `ubuntu26/20261101.186`, `@playwright/test 1.55.1` y error `Playwright does not support chromium on ubuntu26.04-x64`.

Se enumeraron los nueve YAML del directorio `.github/workflows`: exactamente **tres jobs ejecutan** `playwright install --with-deps chromium`, y los tres usan `runs-on: ubuntu-24.04` en el SHA revisado:
- `e2e-preview.yml`, job `e2e`;
- `e2e-mutation.yml`, job `mutation`;
- `e2e-staging.yml`, job `e2e`.

La corrección es mínima: no se cambia Playwright, lockfile, credenciales ni cobertura E2E. Los jobs `resolve` y `report` de `e2e-preview` conservan `ubuntu-latest`, correctamente, porque no instalan Chromium.

### 🔵 D01 — Resuelta por delegación explícita transmitida el 2026-11-05

- **Opción A, recomendada AHORA:** fijar Ubuntu 24.04 solo en los jobs instaladores. Ventaja: recuperación inmediata y predecible con Playwright 1.55.1; costo: pin temporal que exige mantenimiento.
- **Opción B:** actualizar Playwright a versión que soporte Ubuntu 26.04, con lockfile. Solución sostenible y objetivo a medio plazo, pero modifica binarios, dependencias y potencialmente los specs: no se mezcla con un hotfix sin verificación real.
- **Opción C:** forzar `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` para instalar binarios de otro Ubuntu. Evita el pin, pero usa una combinación no oficialmente soportada, menos diagnosticable.
- **Decisión adoptada:** **A ahora**, **B luego** mediante [issue #623](https://github.com/cadeApp/cadeApp/issues/623); **C descartada**. La alternativa B se activa solo después de comprobar instalación de Chromium y E2E sobre 26.04.
- **Alcance:** se acepta expresamente para este hotfix el cambio de `runs-on` en `e2e-mutation.yml` y `e2e-staging.yml`. La ficha en la rama documenta la autorización, aunque su párrafo «Fuera de alcance» necesita armonización editorial (H02).
- **Limitación:** el gate `workflow_run` ejecuta el YAML del branch por defecto: no puede demostrar el nuevo runner antes del merge de este PR; nunca contabilizar un E2E posterior como ejecutado hoy.

## Hallazgos

### PR622-H01 · MEJORA (medio) — Control que dice «every job» pero usa una lista cerrada

**Archivo:** `.github/workflows/verify-workflows.test.mjs:1421-1433`. **Patrón:** P08-control-no-cubre-lo-que-dice. **Estado:** abierto, no bloqueante para los tres jobs actuales.

**Diagnóstico.** El test agregado enumera tres pares fijos de archivo/job. El conjunto actual es exhaustivo, por lo que protege el hotfix, pero el nombre y la aserción prometen detectar **cualquier** job instalador. Un cuarto job no queda cubierto.

**Evidencia independiente [VERIFICADO en ejecución de JavaScript con contenido del SHA].**
- Original: los tres jobs instaladores enumerados tienen runner 24.04 → control independiente GREEN.
- M1/M2/M3: cambiar en memoria el `runs-on` de uno de los tres jobs a `ubuntu-latest` produce RED en cada caso.
- M4: agregar a `e2e-preview.yml` un job `phantom-e2e` que ejecuta el mismo `playwright install` con `runs-on: ubuntu-latest`. La lógica exacta de la prueba publicada sigue GREEN (porque no lo enumera), mientras que el barrido independiente devuelve RED sobre `phantom-e2e`. Ningún archivo del repositorio fue modificado. Harness copiable en [evidencia/comandos.md](../evidencia/comandos.md).

**Recomendación.** En el seguimiento #623, recorrer automáticamente los `*.yml` y jobs que ejecuten instalación Playwright, verificar su runner y exigir que el conjunto detectado no esté vacío. Agregar una mutación con cuarto job. No alterar expectations, saltar pruebas ni simular GREEN; el alcance inmediato no justifica demorar el fix.

### PR622-H02 · MEJORA (bajo) — La ficha contradice la excepción autorizada

**Archivo:** `docs/tasks/T-422.md`, sección «Fuera de alcance». **Patrón:** P03-comentario-contradice-codigo. **Estado:** abierto, editorial.

**Diagnóstico [INSPECCIÓN].** La rama incorpora `e2e-staging.yml` y el nuevo `runs-on` en «Archivos permitidos» y en «Proceso», pero «Fuera de alcance» todavía dice `Cambios en e2e-staging` y `en e2e-mutation más allá de queue: max`.

**Recomendación.** En el siguiente ajuste documental, dejar la excepción explícita: `e2e-staging (excepto runs-on del job e2e)`, `e2e-mutation (excepto queue: max y runs-on del job mutation)`. No bloquea: la autorización ya está expresamente documentada en el cambio propuesto y fue ratificada para este hotfix.

## Checks y límites de verificación

| Comprobación | Resultado y evidencia | Alcance |
|---|---|---|
| Falla original de browser | **RED** run 42117303547, job 127560339320 | Real, Ubuntu 26.04 + Playwright 1.55.1 |
| CI typecheck y lint | **GREEN** | Run 42131903532, SHA `58cb60e0c24b0f28a7300c933e9d3773cbf22c10` |
| CI unit | **GREEN**: 193/193 archivos, 3568/3568 tests | Run 42131903532, job 127610328844 |
| CI verify-workflows | **GREEN**: 86/86 | Mismo job; ejecución real del archivo añadido |
| CI build | **GREEN** | Run 42131903532 |
| DB tests | **En curso al leer los resultados**; no hay cambios de SQL/RLS en este PR | No se lo presenta como GREEN |
| Mutaciones del revisor | **3 RED, 1 falso GREEN identificado** | Aserciones independientes en memoria sobre contenido del SHA |
| E2E posterior al pin | **NO VERIFICADO** | Requiere que `develop` incorpore el workflow; no se lanzó run manual |

**No se ejecutaron** `pnpm typecheck/lint/test` en un clon local: este entorno no tiene acceso de red a `github.com` para clonar. Los checks mencionados son logs del CI del SHA original. No se ejecutó Supabase/Docker ni se leyeron secretos.

## NO TOCAR — falsos positivos descartados

- `runs-on: ubuntu-latest` en jobs `resolve` y `report`: no descargan Chromium.
- No actualizar Playwright en este PR: modifica una variable independiente de la incidencia y perjudica la atribución de regresiones.
- La ausencia de E2E GREEN con YAML nuevo antes del merge: limitación deliberada de `workflow_run` en default branch, no una ejecución ficticia ni motivo para disparar workflows a mano.
- No alterar pruebas para satisfacer el gate ni deshabilitar `--with-deps`.

## Cierre

**SIN BLOQUEANTES.** Se recomienda integrar urgentemente el hotfix cuando la persona autorizada decida el merge (esta revisión **no mergea**), y **verificar después** que un `e2e-preview` real complete ambos proyectos en `ubuntu-24.04`. La prueba inmutable del defecto original y la de CI estructural quedan documentadas. Si el primer E2E posterior no es GREEN, investigar el fallo nuevo sin declarar resuelto el incidente.

Comandos y mutantes: [evidencia/comandos.md](../evidencia/comandos.md). Hallazgos: [hallazgos.jsonl](../hallazgos.jsonl).
