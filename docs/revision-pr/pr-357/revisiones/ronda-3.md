# Revisión independiente — PR #357 / T-361 — Ronda 3

**Fecha:** 2026-10-15. **SHA de implementación revisado:** `ea33a97064985f1e062c80bd0ba93f9b8ee053f8`. **Último commit de código:** `5da667ce3e46585c718e868ae34aa3f9aacb343b`. **Resultado: SIN BLOQUEANTES DE CÓDIGO.** No se aprobó ni mergeó.

## Qué cambió desde R2 y alcance

Dos commits posteriores a la revisión R2 `ce251024`: 1) fix T-361 del CTA en `trip-courier-view.tsx`, `trip-merchant-view.tsx` y `components.test.tsx`; 2) bitácora `docs/tasks/log/T-361.md`. Diff R2→HEAD: solo estos cuatro archivos, todos permitidos por ficha T-361 leída desde develop. El autor no modificó `docs/revision-pr/**`. La comparación con develop indica ahead 14 y behind 0; GitHub informa mergeable=true. No se ejecutó merge-tree local. Decisiones **1-C y 2-A** preservadas y sin decisiones nuevas.

## Cierre por hallazgo

- **PR357-R01: verificado.** En ambos componentes, texto visible del CTA multi-drop = «Avisar por WhatsApp», nombre del destinatario solo en `aria-label`, single-drop conserva «Avisar a mi cliente»; tests nuevos validan nombre accesible, texto visible, teléfono correcto y estado por drop. Sin tocar `e2e/specs/multi-drop.spec.ts`. E2E run **38779673898** con checkout del último **código** `5da667c` confirmó T-340 lector `:41` PASS 42.4 s y escritor `:364` PASS 47.9 s (antes ambos fallaban).
- **PR357-H01:** verificado con 9 casos independientes sobre el cuerpo de la función del SHA actual, escenarios failed/delivered/pending/courier/merchant y mutaciones que hacen caer los controles; los callers pasan estado individual del drop. CI test unit completo verde.
- **PR357-H02:** dos emisores distintos y correctos, verificado en V8 independiente y E2E Flujo 5; mutación del emisor merchant produjo RED.
- **PR357-H03:** E2E Flujo 5 sobre `5da667c` pasó en 40.3 s y conserva checks del texto nuevo sin importe/pago.
- **PR357-H04:** E2E completo **78 Chromium + 3 global-settings, 0 errores** sobre `5da667c` en run 38779673898. No hubo cambios posteriores en código/tests, solo bitácora. **Run más reciente 38783885818 del SHA `ea33a97` seguía ejecutándose al consultar**: no atribuirle verde de otro run.
- **PR357-H05:** el contrato TS exige sender y tripStatus; fallback no anuncia «en camino» por defecto; comprobación estática y 9 ejecuciones aisladas.
- **PR357-H06:** bitácora de R2 reconoce que los logs RED históricos iniciales no se conservaron. No fueron reconstruidos ni se considera verificable esa afirmación histórica. Sin embargo existe RED E2E previo real de R01, GREEN E2E de corrección, RED→GREEN del autor con comandos precisos para nuevo CTA, y **batería propia del revisor** ejecutada sobre el cuerpo real de WhatsApp: **9 GREEN + 6 mutaciones RED**. Harness íntegro en `evidencia/comandos.md`. Límite: NO se ejecutó Vitest local ni se reprodujeron los logs históricos originales.

## CI/evidencia, sin confundir SHAs

- **CI HEAD documental `ea33a97`:** [run 38783727001](https://github.com/cadeApp/cadeApp/actions/runs/38783727001): typecheck, lint, unit, build, audit, db-tests, bundle-budget ✅. Job unit: **133 archivos / 2345 tests PASS**, además workflow/ADR. Job db: **Files=22, Tests=2205, Result: PASS**. No se levantó Supabase ni Docker.
- **E2E de código `5da667c`:** [run 38779673898](https://github.com/cadeApp/cadeApp/actions/runs/38779673898), job **116576394380**, `actions/checkout ref=5da667c`: **78 + 3 passed, 0 failed**. Flujo 5 T-361 PASS 40.3 s, multi-drop T-340 PASS en ambos casos. GitHub `repository_dispatch.head_sha` señala develop, no el SHA usado en el checkout: la atribución se hizo leyendo el **log del job**.
- **Nuevo E2E HEAD documental `ea33a97`:** [38783885818](https://github.com/cadeApp/cadeApp/actions/runs/38783885818), **in_progress** en la consulta. No se declara PASS.
- **Approval policy:** FAIL, el log dice «El PR requiere aprobación vigente de Lautaro073». No usarla como indicador de defecto de código. No forzar ni sustituir aprobación humana.
- **Batería del revisor:** se ejecutó en V8 aislado el **cuerpo extraído de la función real** `buildNotifyCustomerWhatsAppMessage` del SHA `ea33a97`, con 9 casos GREEN y 6 mutantes RED (cada mutante afecta un objetivo real). Se inspeccionaron 6 patrones estructurales en las dos vistas. **No equivale a ejecutar React/TypeScript/Vitest ni Playwright local**. Script íntegro y resultados en evidencia.

## Decisión de cierre

**SIN BLOQUEANTES de implementación conocidos.** **No mergear todavía automáticamente:** confirmar resultado verde del nuevo E2E sobre el HEAD documental y/o del nuevo HEAD que genere el commit de esta revisión; luego **Lautaro073 debe aprobar manualmente** para pasar approval-policy. Confirmar checks de último HEAD y recién después mergear. Ninguna autorización de aprobación/merge fue dada al revisor.