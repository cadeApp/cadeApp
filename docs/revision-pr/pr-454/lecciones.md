# Lecciones — PR #454 / T-384 · ronda 1

No se asignan números AG nuevos: los problemas observados ya encajan en reglas existentes.

- **AG-37 / P06:** barrer todas las variantes del mismo guard. Aquí el SQL acepta formas inválidas de entrada en más de un campo; el prompt solicita tabla completa `kind`, `storagePath`, `idempotencyKey` y comparación con fake.
- **AG-58, AG-75 / P08:** medir el contrato real y no el proxy. `has_function` no comprueba ninguna transición, y stubs `rpc()` que ignoran argumentos no detectan nombre equivocado.
- **AG-59 / P11:** SQL, fake y wrapper deben compartir precedencia de validación para las mismas entradas, no solamente nombres de errores.
- **AG-70 (referido en pr-82):** el mutante debe fallar por la aserción pertinente, no por TypeError o error del arnés.
- **Regla T-384 y user rule:** no fabricar RED/GREEN ni bajar coverage para lograr CI verde.

**Advertencia de proceso:** esta PR fue revisada mientras era Draft explícitamente incompleto. Los hallazgos registran ese estado, no un cierre funcional; los cambios del agy solo se consideran arreglados tras una nueva ronda independiente. No se fingieron mutaciones locales ni ejecución de Docker.

No proponer reglas nuevas para AGENTS.md solo por esta PR.

## Ronda 2

- **P11 / AG-59:** mantener case sensitivity igual en SQL y fake. Aquí CI verde y 90,63 % branch coverage no detectan la bandera `/i`. Agregar mutación dirigida `.PNG`.
- **P08 / AG-37:** enumerar clase completa: actores con consentimiento inactivo, combinatoria kind/estado elegible y código SQLSTATE exacto. No reemplazar por porcentaje de coverage.
- **Proceso H07:** el commit 46114f51 del agy de implementación solo quitó tres espacios al final de la ronda 1. Comparados los blobs, no cambió ninguna afirmación. La carpeta pertenece al revisor: futuros arreglos no deben tocarla.
- No se asignan AG nuevos ni se declara mutación independiente RED/GREEN donde solo hay logs CI del autor.

## Ronda 3

- **P08 / AG-37**: los casos contractuales que faltaban fueron añadidos con observación de estado (`getDocument`, estado courier y auditoría), en vez de conformarse con cobertura porcentual. El job final prueba la suite, pero no suplanta una mutación independiente.
- **P11 / AG-59**: la regex del fake ya coincide en case sensitivity con SQL. Se demostró por comparación de expresiones extraídas del blob, incluido mutante `/i`; no atribuir al ejercicio aislado el peso de ejecutar Vitest mutado.
- **Rollout E2E:** no confundir workflow de dispatch `SUCCESS` con check `e2e-preview SUCCESS`: el gate publica `ERROR / BLOCKED` y saltea E2E cuando detecta migración. T-384 es aditivo y sin UI; el despliegue de la migración a Develop debe comprobarse posmerge antes de T-376. Si el contexto bloqueado es requerido para merge, revisar la compatibilidad de la política sin fabricar un verde.
- **Proceso:** no reescribir informes previos ni marcar hallazgos como verificados a partir de mutaciones autodeclaradas. No se asignan AG nuevos.
