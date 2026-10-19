# Lecciones — PR #389, ronda 1

No se asigna un AG nuevo porque las deficiencias corresponden a patrones existentes; no se presume el máximo de AG de ramas remotas sin git fetch.

- **AG-37 / P06:** enumerar toda la matriz actor × estado antes de creer que una única prueba positiva representa ambos roles. T-362 tenía merchant matched sin viaje E2E.
- **AG-60 / P08:** un resultado esperado como "not visible" no demuestra que la aplicación llegó a la ruta autorizada. Agregar oráculos positivos del estado previo.
- **AG-75 / P08:** la batería del autor no reemplaza las mutaciones de revisión. Una mutación que introduce ReferenceError no prueba validación semántica; usar un cambio compilable y observar qué aserción funcional falla.
- **P03:** marcar DoD requiere evidencia del SHA y del entorno; "test escrito" y "test ejecutado" son estados distintos.

No modificar AGENTS.md por una sola ronda. Revalidar estos criterios después de los arreglos en un SHA nuevo.


## Ronda 2 — lecciones nuevas

- P03: el E2E puede añadir texto plausible pero inexistente; comparar exactamente con el componente existente antes de escribir una expectativa.
- P08: para demostrar una denegación por actor, el recurso debe estar en un estado elegible; si falla antes por estado, el negativo es un falso positivo.
- P15: ERROR MÍO en el instrumento de ronda 1. M1 coincidía tres veces pero el harness exigía exactamente una. Se detectó en R2 por conteo directo, antes de concluir que el autor falseó resultados. Se requiere variante real y logs para corroborar ejecución.
- La evidencia pnpm test y E2E Preview debe pertenecer al SHA posterior a los arreglos, no al commit anterior.

No asignar AG nuevo ni alterar AGENTS.md sin validar máximo de todas las ramas y reincidencia.


## Ronda 3

- La cancelación de e2e-preview no significa RED ni GREEN. Revisar jobs y estado del SHA; identificar que no corrió antes de acusar defectos de pruebas.
- El CI verde sobre un commit funcional puede conservarse aunque un commit posterior modifique únicamente documentación: NO exigir un CI nuevo por la bitácora de revisión.
- Separar rama atrasada (hecho confirmado) de conflicto de merge (no confirmado sin merge-tree).
- Con mutantes reportados por autor pero no reproducidos independientemente, usar arreglado-sin-verificar, no arreglado-verificado. No sospechar falsificación sin evidencia.

## Ronda 4

- Tras mergear develop comparar blobs antes y después de T-362, no confundir cambios ajenos incorporados automáticamente con desvíos de alcance.
- Dos runs sucesivos CANCELLED con resolve-preview success y Playwright sin log sustentan un gate operativo pendiente, no un fallo de aserción. El grupo de concurrencia compartida podría influir, pero sin evidencia de cola no atribuirle causalidad.
- Cuando unit/DB CI del SHA integrado están verdes, el paso mínimo para cerrar es una ejecución E2E real del mismo SHA, no modificar producción ni provocar un commit vacío.
- Approval-policy es control de aprobación de P2 por P1, no un defecto a reparar debilitando checks.

## Ronda 5

- Diferenciar el éxito **observado** de todos los Chromium (87/87, incluyendo T-362) del resultado final del job con `global-settings` rojo. No resumir como E2E global verde ni como fallo de la tarea.
- Las cifras declaradas en bitácora pueden diferir del log real (77 vs 87 Chromium); usar siempre el dato del run, SHA y job.
- Cuando el último SHA probado y HEAD nuevo difieren SOLO en bitácora, el E2E probado sigue representando el mismo código funcional. No pedir otro CI green por docs.
- No inferir bypass de subscripción por falta de alerta: el test falla antes del oráculo SQL; abrir issue separado con traza y RCA pendiente (#405), sin modificar T-362 ni reducir el gate.


## Ronda 6 — gates tras integrar tarea ajena

- Que un arreglo de E2E global haya pasado y se haya mergeado en develop NO convierte automáticamente en PASS a un Preview de otra rama: exigir run target SHA y resultado real de su propio workflow, o documentar que se carece de él.
- Comparar los hashes de todos los archivos funcionales originales del feature antes/después de integrar develop evita pedir refactors ficticios o imputar cambios ajenos a KiraK72.
- El status `e2e-preview=error` con `RESULT: cancelled` solo significa que Playwright NO concluyó; no se puede diagnosticar fallo de test ni asegurar causa sin log. No arreglar E2E mediante `.skip` ni alterar mocks.
- Aunque una nueva ronda documental cambie HEAD, la regla 10 prohíbe exigir otra CI GREEN por ese único cambio.


## Ronda 7 — evidencia final

- Un workflow `repository_dispatch` puede tener en su metadata `head_sha` de develop mientras el checkout y el target status son el HEAD de la PR. Confirmar el `HEAD is now at ...` real en logs para no atribuir E2E al commit equivocado.
- La suma de tests crece al integrar develop: para el HEAD final fueron 90 chromium + 6 global-settings, **no** los 87+3 de la ronda previa ni las 142 suites unitarias de la bitácora antigua. Comparar contra log, no contra una cifra previa.
- Una PR puede ser `mergeable=true` y estar detrás de develop; la cifra behind por sí sola no prueba conflicto. Comparar nombres de archivos, policy y resultados antes de forzar otra integración.
- Evitar CI repetido solo por registrar la revisión; vigilar que la aprobación P1 no quede stale luego del commit documental de R7.
