# PR #128 / T-315 — Ronda 1

**SHA revisado:** `f5a11f0f8f4e85e83f675c56afbef47b529a81d1`  
**Base:** `develop@b659027f49a96762d020e23f159f898b2895d938`  
**Resultado:** **CON BLOQUEANTES (2)**

## Decisiones previas al cierre

### D01 — ficha T-315 ausente en develop

`docs/tasks/T-315.md` no existe en `develop`; fue creada en la misma PR que implementa la tarea. Eso impide hacer el contraste mecánico habitual de la ficha desde el target.

**Decisión Lautaro073: 1-A.** Se acepta esta vez como excepción de proceso la ficha incluida en la rama y no se abre una PR administrativa separada. Se registra como `PR128-A01` aceptado.

### D02 — identidad usada por producción

La ficha dice que producción debe exigir que el run lo haya iniciado Lautaro073, “igual que `migrate-production`”. El workflow de migración usa el actor original del run; el deploy usa `workflow_run.triggering_actor.login`, que representa a quien dispara/re-dispara la ejecución y puede diferir en un rerun.

**Decisión Lautaro073: 2-A.** `deploy-production` debe usar `github.event.workflow_run.actor.login`.

## BLOQUEANTES

### PR128-H01 — actor de producción no replica la semántica de migrate

**Archivo:** `.github/workflows/deploy.yml:66-70`  
**Severidad:** alto · **Categoría:** correctness · **Patrón:** P01-contrato-de-framework-no-verificado

El paso `Require authorized release actor` carga:

`TRIGGERING_ACTOR: ${{ github.event.workflow_run.triggering_actor.login }}`

y autoriza comparando ese valor con `Lautaro073`.

La ficha exige el mismo criterio que `migrate-production`, y D02 fijó explícitamente que el dato correcto es el actor original del workflow run. En un rerun, actor y triggering actor pueden diferir.

**Arreglo requerido:** usar `RUN_ACTOR: ${{ github.event.workflow_run.actor.login }}`, comparar `$RUN_ACTOR` con `Lautaro073` y endurecer el test para que volver a `triggering_actor` produzca RED.

### PR128-H02 — el control no cubre tres invariantes que afirma proteger

**Archivo:** `.github/workflows/verify-workflows.test.mjs:203-263`  
**Severidad:** medio · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice

Los cuatro tests nuevos verifican fragmentos de texto, pero dejan pasar regresiones que contradicen el DoD o el nombre del caso:

- quitar por completo `vercel pull` deja los tests nuevos verdes;
- convertir el health en `curl ... || true` deja verde el caso “fails the job unless /api/health answers 200”;
- cambiar el rechazo de actor no autorizado de `exit 1` a `exit 0` deja verde el caso “fails visibly for an unauthorized actor”.

Harness independiente contra el SHA revisado:

```
baseline: GREEN
M1 remove vercel pull: GREEN
M2 health ignores failure: GREEN
M3 unauthorized actor exits 0: GREEN
```

**Arreglo requerido:** verificar por job la secuencia completa `pull -> build -> deploy -> health`, afirmar que el health no neutraliza su exit y afirmar que la rama de actor no autorizado termina con `exit 1`. Cada una de esas tres mutaciones debe quedar RED antes de dar H02 por corregido.

## DESVÍO ACEPTADO

### PR128-A01 — T-315 se implementó sin ficha previa en develop

**Archivo:** `docs/tasks/T-315.md:1`  
La regla raíz pide que la ficha exista en develop antes de implementar. En este caso la ficha nace dentro del mismo PR. Lautaro073 aceptó explícitamente 1-A para no separar una PR administrativa retroactiva.

**Estado:** aceptado. No requiere cambio en esta PR. No convierte la ficha de rama en precedente general para próximas tareas.

## MEJORAS

Ninguna adicional en esta ronda.

## No revisado todavía

- CI del SHA final: se difiere hasta que no haya bloqueantes.
- Deploy real a Vercel y `/api/health`: solo puede ejercitarse después de mergear el workflow a la rama por defecto y promover a staging.
- No se ejecutó checkout completo local por una limitación de red del entorno de revisión; las mutaciones H02 sí se reprodujeron en un harness independiente con el contenido exacto del SHA.

## Prompt de arreglo

Ver comentario de cierre en la PR. El prompt restringe archivos, da patrón de código, tests y mutaciones RED concretas, y prohíbe crear/adulterar tests para obtener verde.
