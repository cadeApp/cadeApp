# Ronda 2 — PR #509 · T-392 — 2026-10-22

**Revisión independiente:** SHA `aaaf41e9fd71f7e256452e143458f9d039569ad0`; base `c24927c0598905a37ce48bd1e77f9f1383f4a24d`; **RESULTADO: SIN BLOQUEANTES**.

## PR509-H01 — arreglado-verificado

El commit `aaaf41e9` modifica sólo `.github/workflows/verify-workflows.test.mjs` y `docs/tasks/log/T-392.md` respecto del commit de revisión `306fbf5`. No toca `health-cron.yml`; su blob sigue siendo `8304fcc9...`. Los dos tests ahora usan `assert.doesNotMatch(body, /^ {4}if\s*:/m)` para prohibir cualquier `if` de job en staging y production. El test de uptime dejó de ignorar el caso `condition: null`.

## Mutaciones independientes

| Fixture en memoria | Control ronda 1 | Control ronda 2 |
|---|---|---|
| YAML sin mutar | GREEN | GREEN |
| M1 `if: vars.PRODUCTION_APP_URL != ''` production | RED | RED |
| M2 `if: github.event_name == 'workflow_dispatch'` production | GREEN indebido | RED |
| M3 `if: >-` + variable en línea siguiente | GREEN indebido | RED |
| M4 evento `workflow_dispatch` en staging | GREEN indebido | RED |
| M5 `if: false` en production | GREEN indebido | RED |
| M6 `if` dentro de un step (sin if de job) | GREEN | GREEN |

La revisión reprodujo los predicados exactos contra el YAML del HEAD mediante JavaScript aislado: M1-M5 son rechazados y el control sano/M6 aceptados. Harness completo en `evidencia/comandos.md`. La bitácora del agente reporta además la suite completa con mutaciones en rojo y restaurada verde: los conteos de mutaciones de esa bitácora **no** se atribuyen a esta revisión.

## CI del SHA revisado

Corrida https://github.com/cadeApp/cadeApp/actions/runs/39728704163: typecheck success, lint success, build success, audit success, bundle-budget success, unit success. El log de unit muestra **156 archivos Vitest / 3180 pruebas pasadas**, luego **81/81 tests de workflows** y **6/6 tests adicionales**. `db-tests` todavía estaba ejecutándose al redactar este informe. Lint registró un warning Prettier no bloqueante (preexistente de cientos de archivos).

El `approval-policy` inicial falló por ausencia de la sección obligatoria del informe **en el cuerpo de la PR**, no por el código. Se debe completar la sección `### Informe de revisión de agy` en el cuerpo de la PR. Este workflow reacciona a `edited`.

## Alcance, seguridad y límites

Los cambios de la PR permanecen dentro de los archivos permitidos de `docs/tasks/T-392.md` en develop. Ningún contrato, migración, dependencia, secret o endpoint modificado. Se revisaron la bitácora, los comentarios, el diff y las pruebas. GitHub reporta `mergeable=true`. No se clonó por DNS, así que typecheck, lint y suite se comprobaron por logs del runner GitHub (no ejecutados localmente). No se accedió a secrets ni se desplegó. No hay decisiones 🔵.

## BLOQUEANTES

Ninguno. PR509-H01 corregido y verificado en el SHA documentado. No se reportan regresiones nuevas.

## MEJORAS

Ninguna necesaria para el merge; warning de Prettier no bloqueante.

## No revisado / operación posmerge

Después del merge a `develop` (rama predeterminada), comprobar una corrida `schedule` de `health-cron-production`: success o error explícito por falta de `CRON_SECRET`. Registrar enlace en `docs/tasks/log/T-392.md`. No se comprobaron secrets ni ejecuciones reales en producción. No hace falta promover a main para que Actions use el YAML corregido del default branch.
