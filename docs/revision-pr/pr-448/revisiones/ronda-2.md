# Revisión independiente — PR #448 / fichas T-379..T-383 / CC-034/CC-035 — Ronda 2

**Fecha:** 2026-10-20. **Revisión del arreglo del autor:** `b47f2c6d436f199719624d872faeec22f3cdf515`. **SHA verificado tras integrar develop:** `e06cb606651f0c94e4ae00eca12758eb9b2b8b53`. **Base:** `develop@b35b0aef48608d0f3dd767460c65eccf56aed9f0`.

## Resultado: SIN BLOQUEANTES

Los cinco hallazgos de la ronda 1 se cerraron al leer las fichas/contratos **y ejecutar** controles documentales adversariales sobre este SHA. La revisión no ha ejecutado las pruebas funcionales de cada tarea (todavía no existe la implementación). Las pruebas `verify-fichas 7/7` y `git diff --check` son **declaradas por la bitácora del autor**, no ejecutadas aquí; no deben rotularse como verificación independiente.

| Hallazgo | Archivo y línea | Arreglo comprobado | Verificación |
|---|---|---|---|
| H01 | `docs/tasks/T-379.md:32-45,85-90` | `accepted` cruzado con `matched/in_transit/delivered/cancelled/null`; `cancelled/null` van a «Otras» y el segundo carece de enlace. Se exigen pruebas por rama y CTA. | Lectura + controles H01 2/2 GREEN; mutación accepted-cancelled → RED |
| H02 | `docs/tasks/T-382.md:33-45,75,99-103` | La cuenta autenticada confirma estado mediante `POST /api/push/subscriptions/status`, filtrado `auth.uid()`; `PUSH_STORAGE_KEY` no es autoridad; pruebas A→B, fallos y rutas autorizadas. | Lectura + H02 2/2 GREEN; mutación ruta sin prefijo → RED |
| H03 | `docs/contracts/CC-034.md:38-51,172-174` | Unión `previousStatus = suspended|rejected|approved` más ejemplo idempotente y prueba de contrato/fake/wrapper/pgTAP. | Lectura + H03 GREEN; mutación sin approved → RED |
| H04 | `docs/tasks/T-379.md:3-5,110-113`, fila T-379 del plan | T-378 (#440) está documentada como **bloqueante pendiente**, fuera de la lista «mergeadas». #440 continuó abierta en la revisión. | API GitHub + H04 GREEN; mutación que la declara mergeada → RED |
| H05 | `docs/tasks/T-381.md:39-50,75-87` | Tres disparadores diferenciados; E2E de vuelta al panel mediante navegación interna sin focus/visibility/Realtime; mutación dedicada. | Lectura + H05 GREEN; mutación que elimina navegación interna → RED |

**Matriz de 7 comprobaciones:** `7/7 GREEN` sin mutación. Para H01, H02, H03, H04 y H05, cada mutación en memoria produjo `6/7 RED`, exactamente en su afirmación correspondiente. Se restituyó el documento original en memoria para cada nueva mutación. No se ejecutó un harness de producto, ni SQL, ni E2E.

## Fe de erratas del revisor — H02 (sin nueva tarea para el autor)

La mutación H02 diseñada en la ronda 1 reemplazaba `/api/push/subscriptions/status` por `/api/push/subscriptions/status_REMOVED`. Dado el `includes` del control, el reemplazo contenía la cadena original: **el script del revisor era defectuoso**. El autor lo detectó y dejó registro honesto; no cambió los tests. Corregí mi instrumento para mutar a `/api/push/subscriptions/disabled`; la prueba ahora entra en RED. [Código, comandos y evidencia](../evidencia/comandos.md). Esto no es una regresión de T-382.

## Desfase y conflicto de rama, resuelto durante la revisión

Antes de integrar `develop`, GitHub indicó `mergeable_state=dirty`: `docs/implementation-plan.md` había incorporado filas T-376/T-377 upstream después de que la PR creó T-379..T-383. Se hizo un merge de `develop@b35b0ae` con el HEAD `b47f2c6d436f199719624d872faeec22f3cdf515`, sin rebase ni force. Se conservaron **las 7 filas** T-376, T-377, T-379, T-380, T-381, T-382, T-383 y el resto de la PR. GitHub luego informó `mergeable=true`, `behind_by=0` y 14 rutas exclusivamente documentales en el diff.

## CI y criterios de merge

- Sobre el merge commit `e06cb606651f`, GitHub inicialmente registró `typecheck`, `lint`, `audit`, `build` y `bundle-budget` en verde, mientras `unit` y `db-tests` estaban en ejecución al consultar. **No adelantar un resultado final sin verificar el run**.
- `approval-policy` estaba rojo por **«Falta el informe completo de revisar-pr sin bloqueantes.»**: faltaba el bloque literal del informe en el body de la PR. El comentario de revisión no basta. Al publicar el informe de esta ronda, debe agregarse el bloque a la sección `### Informe de revisión de agy` en el body; el workflow `pull_request_target: edited` vuelve a evaluarlo automáticamente. No relajar el checker, y no disparar workflows manualmente.
- El análisis del contenido de las cinco fichas, los dos CC y el plan queda **sin bloqueantes**. La implementación de CC-034/035 y T-379..383 permanece en otras ramas/tareas: **esta PR solo documenta**.
- No se aprueba ni mergea aquí. Las acciones humanas posteriores (si las hay) se indican en el mensaje de cierre.

## No tocar / evidencias pendientes

- CC-035 decisión 3-A está cerrada (reasignar con RPC segura y riesgo de endpoint de capacidad documentado). T-380 y T-383 quedan bloqueadas por sus CC implementados, no por esta PR.
- No es defecto que `e2e-preview` y `db-tests` se cancelen para PRs documentales si CI lo hace conforme configuración; verificar el resultado real, no inferirlo.
- El código de aplicación no se tocó; no declarar `pnpm typecheck/lint/test` ejecutados localmente por el revisor, ni falsificar logs o resultados RED/GREEN.
