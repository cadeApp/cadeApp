# Revisión PR #128 — T-315

- PR: #128 `[T-315] Deploy a Vercel desde GitHub Actions`
- Rama: `feat/T-315-deploy-vercel`
- SHA revisado: `c2df5e6aafe12fdd0de6057455b0707a83645c4a`
- Base observada al iniciar R2: `develop@ffded647be7445b33092ccc76d26e78430ec87dd`
- Ronda actual: 2
- Estado: **CON BLOQUEANTES (1)**
- Decisiones: D01 = 1-A; D02 = 2-A.

## Resumen

- **PR128-H01 cerrado/verificado:** producción usa `workflow_run.actor.login`; volver a `triggering_actor` deja el control en RED.
- **PR128-H02 parcial:** la batería del autor detecta las cuatro mutaciones pedidas en R1, pero la batería independiente de R2 encontró dos variantes todavía verdes:
  1. comentar la línea activa de `vercel pull` conserva el texto buscado y el test pasa;
  2. anteponer `!` a `curl --fail` invierte el exit del health y el test pasa.

La implementación productiva del SHA mantiene los comandos activos y el health sin negación. El bloqueante es el control de regresión exigido por el DoD.

PR128-A01 sigue aceptado.

## Sincronización

GitHub reportó `ahead 3 / behind 1`: `develop` avanzó a `ffded647` por CC-013 mientras se arreglaba R1. Ese commit no toca los archivos funcionales de T-315 y la PR figura mergeable, pero antes de R3 la rama debe incorporar `origin/develop` mediante merge, nunca rebase.

## Checks

- El commit de arreglo toca solo `deploy.yml`, `verify-workflows.test.mjs` y `docs/tasks/log/T-315.md`; el autor no tocó `docs/revision-pr/**`.
- La bitácora trae los cuatro RED pedidos y GREEN de la suite específica.
- El autor declara typecheck/lint verdes y `pnpm test` local rojo por dos fallos fuera de T-315; no se promueve esa evidencia a verificación independiente.
- CI general todavía no se inspecciona porque H02 sigue bloqueante.
- El checkout completo volvió a fallar por DNS; la batería independiente se ejecutó en un harness aislado con las aserciones relevantes del SHA.

## Siguiente ronda

1. Merge de `origin/develop`.
2. Endurecer H02 validando líneas/comandos ejecutables, no presencia textual ni listas crecientes de sintaxis prohibida.
3. RED con comentario de `vercel pull`, RED con `! curl --fail` y una tercera mutación distinta elegida por el autor.
4. Con H02 cerrado, revalidar checks y recién entonces inspeccionar CI del SHA final.
