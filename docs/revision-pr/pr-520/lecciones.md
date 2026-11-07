# Lecciones de la PR #520

**Estado:** no se incorpora un nuevo número AG en esta ronda; no hubo un defecto de producción demostrado que justifique cambiar `AGENTS.md`.

## Hallazgos de proceso

1. La existencia de un documento CC en la misma rama **no equivale** a que el contrato esté mergeado en `develop`. El orden pactado D01=A lo soluciona.
2. Los resúmenes de TAP son fáciles de exagerar: `Failed 30/30` con `Bad plan` puede provenir de una sola aserción antes de abortar; anotar también `Tests` efectivamente ejecutados.
3. Es correcto extender la lista de archivos permitidos de forma explícita cuando el control de mutación es un complemento necesario. H03 documenta esa autorización sin silenciar tests.

## Regla candidata, sin introducir cambio global por un solo caso

Antes de contar como evidencia RED, incluir SHA exacto, job, aserción esperada, aserciones efectivamente ejecutadas, motivo del fallo y comprobación de que las suites no relacionadas siguen verdes. Este caso puede compararse con PRs posteriores antes de actualizar reglas.

## Alcance

T-411 modifica una RPC de esquema, por eso el E2E contra Develop requiere la migración. Un aviso `REQUIRES DEVELOP MIGRATION` no demuestra que el E2E esté fallando.
