# Informe independiente — PR #359 / T-360 — ronda 4
**Fecha:** 2026-10-15 · **SHA de código revisado:** `361317a17b9b99d0c3bdc3d9366966eb898064a0` · **Base de PR:** `develop` @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b`.
**Resultado: SIN BLOQUEANTES detectados en código, pruebas y CI.** No es una aprobación GitHub ni un merge. La PR seguía Draft al concluir.
## Diferencial desde ronda 3
- `e2e/specs/main-flow.spec.ts`: se eliminó el fallback `article/[data-courier-id]` → `.first()`, se identifica heading h4 exacto del courier 0, se limita a la Card real `div.rounded-xl.border-border.bg-card`, se exige unicidad de tarjeta y botón, y se verifica `acceptedOffer.courierId === targetCourier.id` con la inspección real. H07 resuelto.
- `docs/tasks/log/T-360.md`: el autor documentó cambios, pruebas y límites. Ningún otro código cambió después de ronda 3.
## Evidencia independiente en GitHub para SHA 361317a17b9b99d0c3bdc3d9366966eb898064a0
- **Workflow E2E:** [run 38686292491](https://github.com/cadeApp/cadeApp/actions/runs/38686292491) completado SUCCESS. Checkout del run: `HEAD is now at 361317a`. URL Preview leída en job: `https://cadeapp-develop-qtau0l07f-lautaroj073.vercel.app`. Health check y control de Supabase Develop pasaron.
- **Playwright Chromium:** `Running 75 tests using 1 worker`; **`75 passed (19.5m)`**.
- **Prueba T-360 exacta:** `e2e/specs/main-flow.spec.ts:544:7`, `✓ 34 ... T-360: El feed del repartidor muestra viajes activos encima de Solicitudes abiertas y los oculta tras entrega (44.7s)`.
- **Global-settings:** `Running 3 tests using 1 worker`; **`3 passed (1.0m)`**. Estado publicado al SHA original: `e2e-preview: success`.
- **Unit:** [job](https://github.com/cadeApp/cadeApp/actions/runs/38686225890/job/116261575917): **`Test Files 131 passed`, `Tests 2204 passed`**; suites de query de viajes (18) y hook Realtime (11) verdes.
- **DB:** [job](https://github.com/cadeApp/cadeApp/actions/runs/38686225890/job/116261575856): **`Files=22, Tests=2205, Result: PASS`** (la suite contiene mutaciones SQL previstas, no confundir las fallas RED intermedias con falla del schema final).
- **Otros checks:** typecheck, lint, build, audit y bundle-budget success.
- **approval-policy sobre SHA implementado:** fallo documental (`Falta el informe completo de revisar-pr sin bloqueantes.`) en el cuerpo anterior de la PR. Se actualiza el body con este cierre para resolverlo; no es un error del código.
- **Alcance:** commit de agy `361317a17b9b99d0c3bdc3d9366966eb898064a0` cambia exclusivamente `e2e/specs/main-flow.spec.ts` y `docs/tasks/log/T-360.md`, ambos autorizados.
## Hallazgos
| Hallazgo | Resultado | Evidencia |
|---|---|---|
| H01 funcionalidad ausente en Draft | arreglado-verificado | código autorizado + E2E real de feed T-360 |
| H02 tests RED/GREEN/E2E ausentes | arreglado-sin-verificar | tests y E2E existen/pasan; falta batería propia de mutaciones |
| H03 test Realtime invalidaba manualmente | arreglado-sin-verificar | test actual usa callback capturado, 11 tests CI PASS; sin mutación propia |
| H04 E2E sin ejecución | arreglado-verificado | run `38686292491` exacto SHA `361317a17b9b99d0c3bdc3d9366966eb898064a0`, 75+3 PASS |
| H05 error de drops ignorado | arreglado-sin-verificar | guarda `dropsError` + tests unit PASS; sin mutación propia |
| H06 importe multi-drop ambiguo | arreglado-sin-verificar | `por entrega` + tests unit PASS; sin mutación propia |
| H07 selector de oferta inválido | arreglado-verificado | DOM real + E2E T-360 44.7s PASS |
## Limitación metodológica — no ocultarla
Se leyeron directamente el código, el diff y los logs de los jobs fiables, pero **no se ejecutaron localmente ni en worktree las mutaciones propias del revisor** por ausencia de clon con acceso a GitHub desde el ejecutor local. Se revisó la prueba independiente de extremo a extremo ejecutada por GitHub Actions, pero **no se declara RED/GREEN de mutaciones propias**. Los estados sin revalidación por mutación se conservan en `arreglado-sin-verificar` con `verificado_en_sha:null`.
Esta limitación se consigna como mejora de evidencia, no como bug funcional nuevo, pues no se identificó una condición rota tras las suites CI/E2E y la inspección.
## No revisado / dudas para Lautaro073
- Mutaciones propias de H02/H03/H05/H06: no ejecutadas en este entorno. La bitácora contiene afirmaciones del autor, no pruebas reproducidas por este revisor.
- Una actualización documental del revisor mueve HEAD y puede volver a ejecutar CI; comprobar nuevamente los checks del SHA resultante antes de mergear.
- No hay decisiones nuevas. Las 1-A / 2-A / 3-A / 4-A siguen vigentes.
