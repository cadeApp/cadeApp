# PR #128 / T-315 — Ronda 2

**SHA revisado:** `c2df5e6aafe12fdd0de6057455b0707a83645c4a`  
**Develop al iniciar:** `ffded647be7445b33092ccc76d26e78430ec87dd`  
**Resultado:** **CON BLOQUEANTES (1)**

No hay decisiones nuevas para Lautaro073.

## Sincronización y proceso

El commit del autor posterior a R1 toca únicamente:
- `.github/workflows/deploy.yml`
- `.github/workflows/verify-workflows.test.mjs`
- `docs/tasks/log/T-315.md`

No escribió `docs/revision-pr/**`.

Mientras se arreglaba R1, `develop` avanzó un commit por CC-013. GitHub reporta `ahead 3 / behind 1` y la PR como mergeable. El nuevo commit de develop no modifica los archivos funcionales de T-315, pero la rama debe incorporar `origin/develop` antes de la próxima verificación.

## PR128-H01 — CERRADO Y VERIFICADO

El arreglo implementa D02/2-A: `deploy-production` usa `RUN_ACTOR` desde `github.event.workflow_run.actor.login`, compara contra `Lautaro073` y conserva `exit 1` para el actor no autorizado.

El test restringe el chequeo al step correspondiente, exige `actor.login`, prohíbe `triggering_actor.login` y exige `exit 1`.

Mutación independiente: `actor.login -> triggering_actor.login` produce RED. No queda residual en H01.

## PR128-H02 — PARCIAL, SIGUE BLOQUEANTE

El arreglo mejora el control: recorta jobs/steps, exige `pull -> build -> deploy -> health`, comprueba `exit 1` y prohíbe varias formas de ignorar fallos.

Pero una batería independiente encontró dos implementaciones rotas que siguen GREEN:

### Residual 1 — comentario aceptado como comando

Cambiar una línea activa de:

`pnpm dlx vercel@61.0.0 pull ...`

a:

`# pnpm dlx vercel@61.0.0 pull ...`

deja el control GREEN. `body.indexOf(command)` verifica presencia textual, no ejecución.

### Residual 2 — negación del health

Cambiar:

`curl --fail ... "$APP_URL/api/health"`

a:

`! curl --fail ... "$APP_URL/api/health"`

deja el control GREEN. En shell, `!` invierte el estado de salida: una respuesta que hace fallar `curl --fail` termina con estado cero, contradiciendo el DoD.

### Arreglo requerido

No sumar una blacklist interminable. El test debe afirmar positivamente que:

- `pull`, `build` y `deploy` son líneas de shell activas del bloque `run`, no comentarios/echo;
- el health es una invocación directa a `curl --fail ... "$APP_URL/api/health"` como último comando del step, sin prefijo o envoltorio que invierta/absorba su status.

Ambas mutaciones anteriores deben quedar RED.

## Evidencia

La bitácora del autor declara sus cuatro RED y baseline GREEN. La revisión ejecutó una batería distinta: baseline GREEN; comentario de `vercel pull` GREEN; `! curl --fail` GREEN; volver a `triggering_actor` RED.

No se inspecciona CI general mientras H02 siga abierto. El checkout completo volvió a fallar por resolución DNS, así que los checks del autor no se atribuyen a la revisión.

## Veredicto

**CON BLOQUEANTES (1): PR128-H02.**

H01 cerrado. A01 aceptado. Sin decisiones pendientes.
