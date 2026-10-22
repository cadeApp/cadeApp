# Revisión independiente — PR #389 / T-362 — ronda 6

Fecha: 2026-10-17.
SHA integrado inspeccionado: `476ff4dbee7bf0e6fc43b4b507a1e772e27c62f4`.
Base develop efectiva: `0488f8a98f44b67101c7c520696c356d46c161ff` (merge de T-371 PR #407).
Resultado: **SIN HALLAZGOS NUEVOS DE IMPLEMENTACIÓN; CON BLOQUEANTE DE GATE E2E (cancelado), MÁS ACCIONES HUMANAS DE APROBACIÓN Y SALIDA DE DRAFT**. No apta para merge en este momento.

## Alcance, cambios y sincronización

- Se releyeron los documentos obligatorios desde develop y reglas del proyecto, ficha T-362 en develop, comentarios, bitácora, informe R5 y registro estructurado.
- PR #407 / T-371 efectivamente mergeada a develop el 2026-10-17, commit `0488f8a`; issue #405 cerrado. Eliminó el fallo real ajeno de T-306 que afectaba al E2E global; E2E #39075847138 del SHA de T-371 terminó GREEN contra Preview, con resolve-preview, e2e-preview y report-preview-status en SUCCESS.
- Desde R5 el autor sincronizó #389 con origin/develop mediante merge commit de dos padres `53a375ea`, sin modificar manualmente el código de T-362; después actualizó `docs/tasks/log/T-362.md` en HEAD `476ff4d`.
- Comparación actual develop..PR: ahead 15, behind 0. GitHub API marca mergeable=true, sin conflicto indicado. No se ejecutó git merge-tree local por falta de clon accesible; la bitácora del autor declara merge-tree limpio, como evidencia atribuida a él.
- Hashes de blobs T-362 en `ae05b35` (SHA con T-362 E2E PASS) y `476ff4d` son **idénticos**: `trip-cancel-dialog.tsx`, `trip-cancel-dialog.test.tsx`, `trip-courier-container.tsx`, `trip-courier-view.tsx`, `trip-merchant-container.tsx`, `trip-merchant-view.tsx` y `e2e/specs/request-states.spec.ts`. No se alteró la funcionalidad ni el test específico de T-362 al integrar T-371.
- La carpeta `docs/revision-pr/pr-389/` anterior permanece inalterada por la autora: hashes de README, JSONL, lecciones, evidencia y ronda-5 iguales a la ronda 5. No hay autorrevisión espuria.

## CI verificada sobre el SHA actual

- GitHub Actions CI run **39079233749** sobre `476ff4d`: **conclusion=success**.
- Unit job 117532620740: **142 Test Files PASS / 2687 Tests PASS**; verificadores de workflows **79/79 PASS** y ADR **6/6 PASS**.
- DB job 117532620761: último ciclo de pgTAP **Files=29, Tests=2735, Result: PASS**, generación y comparación de tipos success. Los RED de mutaciones SQL internas intencionales no son un fallo final.
- typecheck, lint, audit, build, bundle-budget y Vercel Deployments: **success**.

## E2E Preview — bloqueo único técnico restante

- Run auto `39079295420` del deployment `dpl_9EpouvuavkzVtKXKQmYYffkBkxXJ`, target SHA `476ff4d`. `resolve-preview` SUCCESS con mensaje Preview listo para E2E; job `e2e-preview` **CANCELLED** antes de producir salida Playwright; `report-preview-status` SUCCESS y publica `RESULT: cancelled`, `TARGET_SHA: 476ff4d`. Commit status `e2e-preview=error` con descripción `E2E no corrió (cancelled): re-ejecutar el run`.
- El log del job cancelado devuelve BlobNotFound. **No hubo test E2E PASS ni FAIL para este SHA.** No atribuir a falla de aserciones ni diagnosticar causa de cancelación sin evidencia.
- E2E funcional anterior de T-362, SHA `ae05b35`, run `39064324483`: caso T-362 **PASS (44.9 s)** dentro de **87 Chromium PASS**; aquel gate global cayó por T-306, ahora reparada fuera de la PR. E2E global del fix de T-371, run `39075847138` = GREEN; **no equivale a E2E GREEN del HEAD integrado de T-362**, porque los objetos de ambas ramas eran distintos. Debe completar la ejecución del propio SHA de #389.
- Acción humana requerida: el operador autorizado reejecuta el run E2E cancelado en GitHub Actions usando los controles normales, conservando el target SHA y evitando lanzar mientras el entorno de concurrencia compartida esté ocupado. Si concluye GREEN, registrar run/attempt/SHA/oráculos en bitácora. Si vuelve a CANCELLED, tratarlo como gate operativo pendiente sin adulterar tests, ni crear commits vacíos para disparar CI.

## Hallazgos de revisión

| ID | Estado R6 | Motivo |
|---|---|---|
| H01, H02, R01, R02 | arreglado-verificado (evidencia previa, SHA ae05b35) | Código y spec de T-362 conservan blobs idénticos; E2E real propio ya pasó entonces. |
| H03, H04, R03 | arreglado-sin-verificar | No se reprodujeron por el revisor las mutaciones unitarias históricas; no inventar una ejecución. |
| H05 | **parcial** | T-362 E2E específico pasó previamente; DoD del gate global del SHA actual sigue pendiente por `CANCELLED`. |

El reviewer no ejecutó tests/mutaciones locales: la evidencia runtime procede de logs y checks GitHub inspeccionados. No se marca ninguna verificación propia no ejecutada. No hay hallazgo nuevo de código y no se requieren cambios en producción o tests.

## Approval-policy y Draft — pendientes humanos

- Check `approval-policy` del SHA `476ff4d` **FAIL**: log dice `El PR requiere aprobación vigente de Lautaro073.`. Es una PR P2. No modificar la política ni falsificar informes: **Lautaro073 debe aprobar** después de validar el gate E2E.
- La PR permanece **Draft**. KiraK72 o el dueño debe pasarla a **Ready for review** cuando el gate esté verde y luego Lautaro073 debe aprobar, antes del merge.
- No se aprueba ni mergea en esta ronda.

## Regla décima

La documentación de ronda-6 va a la rama de #389. **NO exigir nuevo CI GREEN únicamente por actualizar la carpeta de revisión ni la bitácora**. Sí hay que obtener un E2E efectivo del SHA funcional ya probado por CI, sin alterar código.

### Veredicto

Integración de T-371 comprobada. Código T-362 intacto y CI verde. Único bloqueante técnico: E2E Preview `CANCELLED` del HEAD actual. Pendientes humanos: salida de Draft y aprobación P1. **No está habilitada para merge todavía**.