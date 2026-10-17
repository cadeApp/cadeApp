# Informe revisión independiente — PR #389 / T-362 — ronda 4

Fecha: 2026-10-17.
SHA funcional inspeccionado: dfe467ada888fe5893e9216842ecb06ca8c12a7d.
Base develop consultada: fec1e7e1ecbead7a24dc631a5f07ec285f8e7eb6.
Resultado: CON BLOQUEANTE DE GATE (1: E2E Preview no ejecutado). Sin nuevos hallazgos de código ni conflictos de integración. Sigue faltando aprobación humana de Lautaro073; la PR sigue Draft.

## Método y alcance

Se releyeron las reglas cargadas para Review PR, documentos obligatorios en develop, ficha de T-362 desde develop, bitácora, comentarios e informes de rondas anteriores. Se obtuvo el HEAD remoto, diff develop...HEAD y CI/job logs sobre SHA funcional. GitHub responde behind=0, ahead=9 y mergeable=true en la consulta actual. La bitácora del autor indica merge de origin/develop sin conflictos y merge-tree limpio. La rama integró muchos cambios ajenos desde develop; no tratarlos como cambios propios de T-362.

Se contrastaron los hashes de blobs funcionales antes del merge (059270f) y después del merge (dfe467a). TripCancelDialog, TripCourierContainer, TripCourierView y trip-cancel-dialog.test.tsx son idénticos. TripMerchantContainer cambió únicamente en el éxito de reportar no-show: router.refresh() pasa a router.push hacia el detalle de solicitud. TripMerchantView añadió visualización de medio de pago en una entrega y por drop en múltiples, conservando la guarda de cancelación en matched. request-states.spec.ts cambió únicamente una aserción anterior ajena a T-362 alrededor de la línea 1013. No hay evidencia de regresión en las garantías de cancelación por rol.

No se corrieron Vitest, Playwright, mutaciones ni git merge-tree en un clon del revisor; el entorno no dispone de un clon con dependencias. La evidencia runtime aquí es la CI de GitHub leída por el revisor, no una ejecución local pretendida.

## Revalidación de los ocho hallazgos históricos

| ID | Resultado | Fundamento |
|---|---|---|
| H01 | arreglado-sin-verificar | Flujo de commerce matched / courier matched conservado; E2E aún no ejecutado |
| H02 | arreglado-sin-verificar | In transit usa oráculos positivos y ausencia de cancelación simple, sin cambios tras merge |
| H03 | arreglado-sin-verificar | Matriz literal de razones, hash de test y diálogo preservados |
| H04 | arreglado-sin-verificar | Wires actor y validación Otro preservados; no mutación independiente del revisor |
| H05 | parcial | DoD de E2E permanece desmarcado correctamente; falta resultado de Playwright |
| R01 | arreglado-sin-verificar | El título y descripción merchant de E2E coinciden con diálogo conservado |
| R02 | arreglado-sin-verificar | El actor ajeno se comprueba antes de cancelar sobre matched |
| R03 | arreglado-sin-verificar | Variante de mutación del autor documentada con RED M1–M5 y GREEN; no reejecutada independientemente |

No agregar hallazgos ficticios por la integración ajena ni falsificar verificado_en_sha. Los tests del SHA integrado corrieron en GitHub, pero el flujo Playwright sigue pendiente.

## Evidencia GitHub CI sobre SHA dfe467a

- CI run 39061791920, conclusion success.
- unit job 117481086796: Test Files 142 passed (142); Tests 2685 passed (2685). Workflows 79/79 y ADR 6/6.
- db-tests job 117481086777: última batería limpia Files=29, Tests=2735, Result: PASS; pasos finales del job exitosos. Los errores de mutaciones SQL deliberadas en logs son internos del ensayo y están restaurados.
- typecheck, lint, audit, build, bundle-budget y Vercel: success.
- approval-policy run 39061789281: fail por mensaje exacto El PR requiere aprobación vigente de Lautaro073. No alterar la política.
- e2e-preview run 39061870840, evento repository_dispatch, target SHA dfe467a: resolve-preview success y mensaje Preview listo para E2E; e2e-preview cancelled; report-preview-status success. Commit status e2e-preview = error con descripción E2E no corrió (cancelled): re-ejecutar el run.
- El job Playwright cancelado carece de log accesible (BlobNotFound). No se observó ningún fallo de aserciones ni un GREEN.
- La definición .github/workflows/e2e-preview.yml usa el mismo concurrency group cadeapp-develop-e2e para PRs y cancel-in-progress false. Que otros runs hayan desplazado uno pendiente es una hipótesis operativa razonable, NO causa confirmada sin historial de cola. El revisor NO altera workflow.

## Único gate técnico restante

**G1 — E2E Preview real GREEN.** El operador con permisos debe reejecutar desde GitHub Actions el run 39061870840 (Re-run all jobs) cuando el grupo de pruebas compartido esté libre, o utilizar el mecanismo autorizado del repositorio que reevalúe exactamente el SHA dfe467a. Debe registrar run, target SHA, resultado, paso Chromium, motivo/actor/estado y cleanup. Si vuelve a cancelarse, es un bloqueo de ejecución, no prueba de fallo funcional. No resolver introduciendo skip, falsos tests, cambios en .github ni un commit vacío para disparar CI.

Si la reejecución completa PASS para el mismo SHA funcional, registrar el resultado de E2E en la bitácora. Un cambio solo documental de la bitácora no requiere otro CI GREEN. Sí requiere nueva validación cualquier cambio de código/merge futuro.

## Acción humana posterior

La PR está Draft. Una vez que E2E esté GREEN, Lautaro073 debe colocarla Ready for review y otorgar su aprobación vigente para que approval-policy pase. El revisor NO aprueba ni mergea. No hay decisiones de producto o arquitectura pendientes.

## Conclusión

Implementación T-362 lista por inspección e integración/CI, pero no apta para merge hasta un E2E Preview efectivo y aprobación manual. Resultado: CON BLOQUEANTE DE GATE (1), sin defectos nuevos de código.
