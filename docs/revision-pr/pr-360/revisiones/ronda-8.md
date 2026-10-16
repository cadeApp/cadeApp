# Informe revisar-pr — T-359 · PR #360 · ronda 8

**Fecha:** 2026-10-16. **SHA inspeccionado:** `fc5b0a0152b48c7d6716b3b0a0c975746e504ebc`. **Resultado: SIN NUEVOS BLOQUEANTES DE IMPLEMENTACIÓN POR INSPECCIÓN; MERGE BLOQUEADO POR E2E DEL HEAD POST-MERGE NO EJECUTADO.** No aprobar ni mergear.

## Alcance e integración
- Se verificó el merge normal de `develop` commit `1c8182ed` (padres `cb9b7848` de esta PR y `af0cf1d7` de develop), seguido de commit de bitácora `fc5b0a01` del agy. La rama incorporó CC-025/026/027/028 sin que agy reescribiera manualmente código productivo de esas tareas. La carpeta de revisión `docs/revision-pr/pr-360` no fue modificada por agy.
- En `e2e/specs/main-flow.spec.ts` siguen los dos contextos, oráculo DB de única aceptación, comprobación estricta del monto en la Card (antes y después de reload), medio de pago y contacto, Back y redirección. Se conserva el E2E de T-360 y las nuevas aserciones de privacidad de WhatsApp incluidas desde develop. En `TripMerchantView` la Card `Repartidor asignado` continúa mostrando el monto. **Correcto por inspección**, no prueba del navegador actual.
- GitHub indica `mergeable:true`. `develop` avanzó luego un commit a `01054b14` en áreas de onboarding/admin/courier, sin conflicto directo demostrado con T-359. No se ejecutó merge-tree en clon propio.

## Evidencia de CI — SHA exacto fc5b0a01
- `unit`: 136 archivos / 2435 tests Vitest, 79 tests de workflows, 6 ADR; SUCCESS (job 117141673496).
- `db-tests`: 26 archivos / 2341 pgTAP, resultado final PASS (job 117141673428). Hubo RED intencionales de mutaciones para otras tareas en logs; **no son fallas finales ni mutaciones T-359**.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: SUCCESS. [Workflow CI 38950890801](https://github.com/cadeApp/cadeApp/actions/runs/38950890801).
- `approval-policy`: SUCCESS [run 38963478649](https://github.com/cadeApp/cadeApp/actions/runs/38963478649), aprobación real vigente de Lautaro073 sobre el SHA.

## Bloqueo del E2E — CANCELLED, no FAIL de Playwright
El [run 38951040659](https://github.com/cadeApp/cadeApp/actions/runs/38951040659) fue generado automáticamente por el Preview de `cadeapp-develop` para PR #360, SHA `fc5b0a01`; `resolve-preview` reconoció identidad del proyecto y PR. Sin embargo los tres intentos de job Playwright terminaron `cancelled` con **cero steps ejecutados**: jobs `117142273870`, `117176406615` y `117184161515`. El job de reporte publicó `e2e-preview=error` sobre el SHA exacto. **No existe 76/76 nuevo para este HEAD**: el GREEN [38945199224](https://github.com/cadeApp/cadeApp/actions/runs/38945199224) era para `6d2c4337`, previo a integrar develop.

El workflow usa grupo de concurrencia global `cadeapp-develop-e2e`, `cancel-in-progress:false`, sin FIFO. T-327/#205 decisión P1 5-A **ya aceptó** la limitación nativa de 1 running + 1 pending y re-run para cancelados. Que haya cancelaciones frecuentes es compatible con esa cola, **pero no se obtuvo una causa exacta por los logs internos del scheduler**; no pedir tocar `.github` ni alterar T-359 por inferencia.

## Hallazgos y siguiente paso
- **PR360-H05** queda `parcial` exclusivamente por la ausencia de Playwright nuevo del HEAD integrado; los asserts y la cobertura están presentes por inspección. **PR360-R03** sigue `arreglado-sin-verificar`: el selector está bien acotado; su evidencia RED→GREEN histórica existe, pero la nueva combinación no ejecutó E2E. Otros hallazgos sin prueba nueva mantienen estado. Ningún `verificado_en_sha` nuevo: no se hicieron mutaciones independientes.
- **Acción efectiva recomendada:** conservar SHA (salvo commit de revisión), evitar más cambios y re-ejecutar un run E2E legítimo del mismo commit cuando no haya competencia en la cola; no crear dispatch manual, no saltar checks. La revisión documental vuelve a mover HEAD; exigir E2E Preview `success` para la punta final antes de autorizar merge. Si la cancelación se repite, documentar los jobs sin declararlos FAIL funcional o SUCCESS.
- **Sin decisiones de producto:** sigue vigente la elección B para terminales. No se encontraron defectos funcionales nuevos. La aprobación en GitHub es del usuario, no de la revisión. La ronda se registra exclusivamente en docs, sin tocar app, fixtures, SQL, workflows, ni settings.

**Limitaciones:** revisión por GitHub conectado y logs auténticos; sin clon local para pnpm, git merge-tree o mutaciones independientes. No levantar Docker/Supabase local.