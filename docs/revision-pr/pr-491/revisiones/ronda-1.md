# Informe de revisión independiente — PR #491 / T-312 — Ronda 1

**Commit de implementación revisado:** [`3b6810858ead3c7a22b3d365437fb85edd9419b7`](https://github.com/cadeApp/cadeApp/commit/3b6810858ead3c7a22b3d365437fb85edd9419b7)
**Base:** `develop` @ `6b1aba74283ab5560f8be875fecd8ea4b35a7bb2` · **Rama:** `feat/T-312-release-checklist` · **Fecha:** 2026-11-07.
**Resultado:** **SIN BLOQUEANTES DE LA PR DOCUMENTAL** (0). Se cierran H03/H04. H01/H02 quedan explícitamente aceptados **solo como diferidos fuera de esta PR** bajo D1=A y D2=A; los riesgos operativos continúan.

## Resumen

| ID | Clasificación | Estado en 3b681085 | Evidencia |
|---|---|---|---|
| H01 | Decisión / riesgo operativo externo | D1=A; pendiente en tarea aparte | `health-cron.yml` job production; `release.md:47-48` |
| H02 | Decisión / configuración humana | D2=A; ramas todavía sin protección | API `/branches/{main,staging,develop}`; `release.md:53-54` |
| H03 | Documentación incorrecta | **Arreglado y verificado** | `release.md:26-28`, `migrate.yml`, `deploy.yml`; GREEN/RED |
| H04 | Documentación desactualizada | **Arreglado y verificado** | `release.md:21,100-101`, `health-cron.yml`; GREEN/RED |

## Detalle y resolución

**H01 — required reviewer y cron periódico.** `health-cron-production` sigue usando `environment: production`; si se exige approval en ese environment antes de separar el job, el monitoreo programado también esperará aprobación. D1=A: definir tarea separada para moverlo a `production-monitoring` (copiando allí solo los secretos necesarios, sin imprimir valores) y **después** habilitar required reviewer en `production`. Esta PR no edita `.github/workflows/**`, fuera de los archivos permitidos.

**H02 — branch protection.** La API de GitHub devolvió `protected:false` para las tres ramas y no hay rulesets. D2=A: Lautaro073 configura PR obligatoria, checks requeridos, sin push directo ni force-push en `main/staging/develop`. La casilla en `release.md:53-54` es documentación, no protección efectiva. Sin cambios de configuración desde esta revisión.

**H03 — re-run no cambia actor.** Corregido en `release.md:26-28`. `migrate.yml` contrasta `GITHUB_ACTOR` y `deploy.yml` usa el actor del `workflow_run` original; la documentación indica que hace falta un **nuevo push de Lautaro073 a main**, por ejemplo un nuevo merge. La aserción de texto/contrato pasa y la mutación que vuelve a sugerir re-run falla (RED).

**H04 — cron de URL fija.** Corregido en `release.md:21,100-101`. El workflow `health-cron.yml` fija `APP_URL: https://cadeapp.online`; la tabla y el gate de operación ya no le atribuyen dependencia de `PRODUCTION_APP_URL`. El control pasa y mutar la URL o restaurar la condición vieja lo pone en RED.

## Scope y controles

- El diff del PR afecta solo `docs/runbooks/release.md` y `docs/tasks/log/T-312.md`, ambos en «Archivos permitidos» de `docs/tasks/T-312.md` leído desde `develop`. No se modificó la ficha ni contratos de código.
- Comparación API: `develop...3b681085` = 6 commits adelante, 0 detrás. PR reporta `mergeable:true`. No se pudo ejecutar `git merge-tree` por ausencia de clon.
- CI original `42429001614` **success**: lint, typecheck, unit, db-tests, build, audit, bundle-budget. Unit: 3755 tests en 199 archivos. DB: 3582 tests en 43 archivos en estado base final. Ver [`evidencia/comandos.md`](../evidencia/comandos.md).
- `e2e-preview` 42429745093 **cancelado** antes de instalar Playwright: no corresponde llamarlo aprobado ni fallido funcionalmente. No se exigió un nuevo CI por documentación de bitácora/revisión.
- Los asserts propios y mutaciones GREEN→RED son de coherencia documental/contratos entre runbook y workflows; **no** demuestran configuración remota efectiva, un deploy ni un cron real.

## Lo que NO debe confundirse con el cierre

Las casillas manuales para releases (simulacro de restauración T-310 todavía pendiente/no verificado, required reviewer de `production`, protección de ramas y evidencias de consolas/legal/guardia) **no quedaron hechas** por aprobar un runbook. No declarar la infraestructura protegida ni la release operativamente habilitada por esta revisión.

## No tocar / no usar como arreglo de esta ronda

- No mover health-cron ni cambiar reglas de rama dentro de T-312; D1/D2 tienen propietario/ámbito separado.
- No reintroducir dependencia de `PRODUCTION_APP_URL` en `health-cron-production`; el deploy **sí** sigue usando esa variable, lo que no es un defecto.
- No dar por válido un re-run que conserve el actor inicial.

**Acción de esta ronda:** publicar el informe y el prompt en **un comentario** de la PR; no aprobar ni mergear. El commit de carpeta de revisión no invalida el SHA `3b681085` verificado para los cambios documentales.
