# PR #128 / T-315 — Ronda 3

**SHA revisado:** `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`  
**Base:** `develop@ffded647be7445b33092ccc76d26e78430ec87dd`  
**Resultado:** **SIN BLOQUEANTES**

No hay decisiones nuevas para Lautaro073.

## Sincronización

El autor hizo lo pedido en R2:

1. trajo el commit de revisión `f0829bb`;
2. hizo `git fetch origin`;
3. incorporó `origin/develop` por merge normal en `885ecb0`;
4. no hizo rebase, amend ni force-push;
5. el commit funcional final es `f0c613a`.

GitHub reporta `ahead 6 / behind 0`, base `ffded647` y PR mergeable.

Entre R2 y el SHA revisado no se escribió `docs/revision-pr/pr-128/**` desde el lado del autor. El merge de develop trae `docs/revision-pr/pr-126/**`, que corresponde a CC-013 y no altera la carpeta de esta revisión.

## PR128-H01 — CERRADO

Sin cambios desde R2. `deploy-production` conserva:

- `RUN_ACTOR: ${{ github.event.workflow_run.actor.login }}`;
- comparación contra `Lautaro073`;
- `exit 1` para actor no autorizado;
- ausencia de `workflow_run.triggering_actor.login`.

Estado: **arreglado-verificado** en `c2df5e6`.

## PR128-H02 — CERRADO Y VERIFICADO

El arreglo abandona el matching sobre texto crudo y agrega `shellCommands(stepBody)`, que:

- localiza el bloque `run: |`;
- toma únicamente su contenido;
- descarta líneas vacías;
- descarta líneas cuyo contenido empieza con `#`;
- une continuaciones terminadas en `\` en un comando lógico.

El test de secuencia trabaja sobre comandos activos del step `Build and deploy to Vercel (<job>)` y exige:

- `pull` activo;
- `build` activo;
- asignación activa del `deploy --prebuilt --prod`;
- orden `pull < build < deploy`;
- step de health posterior.

El test de health exige exactamente un comando lógico que:

- empiece con `curl --fail `;
- conserve `--retry 6`, `--retry-delay 10` y `--retry-all-errors`;
- termine exactamente en `"$APP_URL/api/health"`;
- no viva en un job con `continue-on-error`.

### Reproducción de la evidencia del autor

Las tres mutaciones declaradas en la bitácora se reprodujeron sobre el mismo contrato del SHA:

1. comentar el `vercel pull` de staging → **RED**;
2. `! curl --fail` en staging → **RED**;
3. reemplazar el build de staging por un `echo` → **RED**.

Baseline restaurado → **GREEN**.

### Batería independiente

Mutaciones distintas de las del autor:

1. invertir `pull` y `build` en staging → **RED** por orden;
2. eliminar el comando de deploy de staging → **RED** por deploy faltante;
3. agregar `|| true` al health → **RED** porque el comando ya no termina en la URL.

Se probaron además `pull/build ... || true`, que permanecen GREEN. No se abre residual: esas mutaciones agregan una exigencia diferente —propagación explícita del fallo de pull/build— que no forma parte del DoD de H02. La implementación real no contiene esa neutralización y GitHub Actions ejecuta actualmente los comandos simples con shell fail-fast.

Estado: **arreglado-verificado** en `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`.

## CI del SHA revisado

CI run **#606**, SHA exacto `f0c613a8...`:

| Job | Resultado | Evidencia relevante |
|---|---|---|
| typecheck | success | paso `pnpm typecheck` verde |
| lint | success | `pnpm lint` verde |
| unit | success | 103 archivos / 1381 tests; workflow tests 27/27 |
| build | success | build completado |
| audit | success | advisory completado |
| db-tests | success | Files=12, Tests=1601, Result: PASS; db:types generado; diff de tipos sin cambios |
| bundle-budget | success advisory | hay rutas preexistentes >180 kB; T-315 no modifica bundle |

El `pnpm test` local del autor había mostrado dos fallos por interferencia/timeout fuera de T-315. El runner limpio de CI no los reproduce: Vitest termina **1381/1381**.

## No revisado por definición

- Deploy real a Vercel tras merge + siguiente promoción a staging.
- Valor efectivo de `PRODUCTION_APP_URL` en configuración externa. No se leen ni modifican secrets/variables desde la revisión.

## Veredicto

**SIN BLOQUEANTES.**

- PR128-H01: cerrado.
- PR128-H02: cerrado.
- PR128-A01: aceptado por decisión 1-A.
- Decisiones pendientes: ninguna.

Esta revisión no aprueba ni mergea.
