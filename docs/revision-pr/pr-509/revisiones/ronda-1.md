# Ronda 1 — PR #509 / T-392 — 2026-10-22

**Generado por:** revisión independiente (OpenAI). **HEAD revisado:** `a03a4179532f13ccec32b666859037cb7305a50b`. **Base:** `c24927c0598905a37ce48bd1e77f9f1383f4a24d`. **Resultado:** CON BLOQUEANTES (1).

## Alcance y mérito comprobable

Los tres archivos del diff están permitidos por `docs/tasks/T-392.md` leída desde `develop`, y no se modificó la ficha. No aparecen contratos, dependencias ni secretos nuevos. La corrección en `.github/workflows/health-cron.yml` elimina el `if: vars.PRODUCTION_APP_URL != ''` y asigna `https://cadeapp.online`, mientras conserva `environment: production`, guarda por `CRON_SECRET`, `curl --fail`, cabecera Bearer, programación `*/10 * * * *` y concurrencia sin cancelación.

## BLOQUEANTE

**PR509-H01 · P08-control-no-cubre-lo-que-dice (medio; bloqueante por DoD).**
Archivo: `.github/workflows/verify-workflows.test.mjs:607`.

El test agregado solo rechaza `if` de una línea si menciona `vars.`. La ficha exige que el job `production` quede **sin `if`** y que corra en **cada schedule**. El mismo archivo mantiene `condition: null` pero solo comprueba presencia cuando `condition` es truthy; por lo tanto, no comprueba ausencia.

Demostración independiente sobre las expresiones exactas del test con el YAML original como fixture, sin escribirlo en disco: la regresión actual acepta ambos mutantes:
- `if: github.event_name == 'workflow_dispatch'` colocado a nivel `production`: en cada evento `schedule` el job vuelve a quedar `skipped`.
- `if: >-` con `vars.PRODUCTION_APP_URL != ''` en la siguiente línea: el patrón de una sola línea no lo detecta.

Resultados del harness aislado: HEAD PASS/PASS; condición vieja FAIL/FAIL; mutación evento PASS/FAIL; mutación multilinea PASS/FAIL. La primera columna es el control actual, la segunda es el guard propuesto que prohíbe todo `if` a nivel de job. El harness reproducible está completo en `evidencia/comandos.md`. Esto **no equivale** a haber corrido los 81 tests del repositorio.

**Arreglo acotado:** en el test `T-392` (y, preferentemente, en la aserción del test de uptime cuando `condition === null`), recorrer `staging` y `production` y verificar `assert.doesNotMatch(body, /^ {4}if\s*:/m, mensaje)`. No tocar `health-cron.yml` para hacerlo pasar. Exigir mutaciones separadas RED→GREEN con los dos ejemplos anteriores y el caso original `vars.PRODUCTION_APP_URL`, en memoria y restaurados al terminar. No adulterar tests, expectativas ni CI.

## MEJORAS / observación operativa

No hay otra mejora que justifique bloquear. La rama predeterminada del repositorio es `develop` (comprobación por API). GitHub Actions ejecuta `schedule` únicamente sobre la rama predeterminada: la primera validación operativa del YAML podrá hacerse después del merge a `develop`, aunque la ficha/bitácora pida esperar también a la promoción a `main`. Esto es una precisión del procedimiento, no un fallo del parche.

## Comprobaciones y límites

- PR abierta, `mergeable: true` en GitHub, sin threads de review previos ni carpeta `pr-509` existente.
- Se inspeccionó diff completo (3 archivos), ficha desde `develop`, bitácora, prueba, workflow y deploy.
- Mutaciones ejecutadas contra el predicado del test cargado desde el HEAD; salida en `evidencia/comandos.md`.
- **Checks locales:** typecheck no ejecutado · lint no ejecutado · test completo no ejecutado · test:db n.a. El entorno de revisión no pudo clonar el repositorio (DNS); la bitácora del autor declara 81/81 y lint verde, **no reproducidos independientemente**.
- **CI del HEAD:** no se toma como aprobación ni se evalúa en profundidad mientras haya un bloqueante; la regla de revisión lo reserva para la ronda candidata a cerrar. No se forzó ninguna ejecución de CI.
- **Operación real:** no comprobada; requiere schedule posmerge y evidencia posterior. No inspeccionados secretos ni settings de environments.
- **Decisiones del usuario:** ninguna 🔵. La corrección es una exigencia explícita del DoD y no requiere ampliar alcance.

**No aprobar ni mergear** con PR509-H01 abierto. El commit que guarda esta revisión modifica solo documentación, no es un nuevo SHA de código validado.
