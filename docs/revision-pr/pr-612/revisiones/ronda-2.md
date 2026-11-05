# Ronda 2 — PR #612 / T-422

**Fecha:** 2026-11-05 · **Rama:** `fix/T-422-runner-env`  
**SHA exacto inspeccionado:** `4dfca21602da7fc067bae4c82ba04c1e1fcd2366`  
**Base develop:** `1105eaf42ae457b68cfd004ae182acebae68f3c7` · **Anterior:** `d4433a5e86c00f41b32dfee80bd15c7f16b62968`  
**Resultado: SIN BLOQUEANTES.** PR612-H01 y H02 corregidos y verificados. D01 aceptada; no hay decisiones nuevas.

## Qué cambió respecto de Ronda 1

Un commit con cinco archivos, todos permitidos por la ficha T-422 de `develop`: `e2e-preview.yml` (+16), `verify-workflows.test.mjs` (+20), ficha (+6/-1), runbook (+9/-6) y bitácora (+22). No se tocaron `src/**`, contratos, migraciones, specs, dependencias, otros workflows ni `docs/revision-pr/pr-612/**`. La ficha solo actualizó el texto de Google Maps del Diseño, sin ampliar alcance. GitHub declaró la PR mergeable y la base no cambió durante la lectura.

## PR612-H01 — arreglado-verificado

**Ruta:** `.github/workflows/e2e-preview.yml:104-118`; test `.github/workflows/verify-workflows.test.mjs:1421-1440`.

`Validate Maps public configuration` se ejecuta antes de `Build PR without privileged secrets` y recibe las dos `vars.NEXT_PUBLIC_GOOGLE_MAPS_*`. Para cada variable, `[ -z "$VARIABLE" ]` imprime un `::error::` con el **nombre**, nunca el valor, y termina en `exit 1`. No se heredan secretos; el step es Bash, sin `continue-on-error`. El VAPID privado sigue restringido al step servidor.

**Verificación independiente en memoria** del YAML obtenido de GitHub: basal conforme y **9/9 mutaciones propias detectadas**, distintas de la batería del agy: desactivar cada condición (2), convertir cada `exit 1` en `exit 0` (2), mover la guarda después del build (1), introducir un secreto (1), permitir `continue-on-error` (1), imprimir el valor (1) y poner `exit 0` antes de la guarda (1). El oráculo comprueba orden, env, guardas, corte y ausencia de filtraciones. No representa una ejecución de Playwright ni nueve `node --test` independientes; el harness completo está en [evidencia/comandos.md](../evidencia/comandos.md).

El test agregado por el agy exige la condición y el `exit 1` en cada bloque. Su bitácora informa dos mutaciones `if false; then` con **84 tests / 83 PASS / 1 FAIL** y GREEN restaurado **84/84**. En CI el nuevo test del archivo fue ejecutado y la suite de workflows pasó **84/84**. No se inventa una reproducción de sus logs RED locales.

## PR612-H02 — arreglado-verificado

**Rutas:** `docs/tasks/T-422.md:36-41`, `docs/runbooks/e2e-preview.md:80-87` (y Configuración manual), `docs/tasks/log/T-422.md:100-120`.

Cruce programático de las tres fuentes del SHA exacto: **3/3** mencionan usar los valores del Preview (A), clave exclusiva de CI solo después (B), disparador `RefererNotAllowedMapError`, consumo compartido y variables ya cargadas. Desaparece la instrucción vigente de compilar con clave falsa. La bitácora distingue que se comprobaron los nombres de las variables, no sus valores o restricciones.

## PR612-H03 / D01 — decisión P1 aceptada

**A ahora:** utilizar clave y Map ID ya cargados del Preview. **B después:** crear clave de CI solo si Google rechaza `localhost:3100` por referer o hay problemas reales de consumo compartido. No cambiar cuotas, reglas de origen ni secretos por especulación. Ninguna otra decisión pendiente.

## Evidencia de CI y límites

Run [42056929601](https://github.com/cadeApp/cadeApp/actions/runs/42056929601) confirma `head_sha=4dfca216`. Jobs `build`, `typecheck`, `lint`, `audit`, `bundle-budget` y `unit` en success. En `unit`: **Vitest 193/193 archivos, 3568/3568 tests; workflows 84/84; ADR 6/6**. `db-tests` finalizó **success**: `Files=42, Tests=3396, Result: PASS`, tests de concurrencia completados y `git diff --exit-code -- src/types/database.types.ts` sin diferencias. **CI completo 7/7 jobs en success.** El timeout local de `clients.test.ts` anotado por el agy pasó aislado; en el job CI completo la suite de Vitest pasó.

No se ejecutó un clon ni Supabase/Docker, no se leyeron `.env`, valores de claves o secrets. Los mocks de `map-privacy` no prueban si una clave pública acepta `localhost:3100`. El E2E real actualizado **no existe todavía**, ya que `workflow_run` usa la versión de `develop`. La ejecución previa 41977303708 terminó **108 PASS / 8 FAIL** y no se reinterpreta como resultado nuevo.

## NO TOCAR / falsos positivos descartados

La API key pública y Map ID deben incluirse en el bundle; la privada VAPID no. `Prettier format:check` es advisory preexistente, no un fallo de lint. Dos decisiones llamadas «D01» en secciones de distinto contexto tienen fecha y ámbito diferenciados; la nueva corresponde a Google Maps, no a la excepción sobre la ficha en PR610.

## Cierre

**SIN BLOQUEANTES** para el código y la documentación examinados. No hace falta otra ronda de correcciones. Antes de mergear, corroborar todos los checks del SHA, incluido `db-tests`. Lautaro073 decide el merge; **después**, probar en una PR interna el nuevo gate y exigir `e2e-preview success` sobre los proyectos `chromium` y `global-settings`. Solo entonces poner el Ignored Build Step de Vercel en «solo develop». Si Maps devuelve el error acordado, aplicar B. La revisión no ejecuta el merge ni modifica entornos remotos.
