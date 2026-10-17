# Informe revisar-pr — PR #384 / T-357 — Ronda 4

**Fecha:** 2026-10-17 (Argentina)
**SHA de código revisado:** `523b49896b495e5faea4e6ef7fae577e249cf874`
**Versión anterior inspeccionada:** `25a0a5ea48f8d3d3b052c9eeced8e6c8f619cb68`
**Resultado:** **CON BLOQUEANTE RESIDUAL H04; R01 arreglado-sin-verificar. NO APROBAR NI MERGEAR.**

## Comprobación de alcance / precedencia

Entre R3 (commit de revisión `7fa2a132`) y el SHA final de R4, el agy cambió solo `e2e/specs/courier-onboarding.spec.ts`, `src/features/courier-onboarding/actions.test.ts` y `docs/tasks/log/T-357.md`, todos dentro de archivos permitidos. `25a0a5ea` añadió el E2E de viaje y negativos; `523b4989` corrigió **una línea** del locator Playwright. No modificó `docs/revision-pr/**`, contratos, base SQL, RLS, CI ni secretos.

GitHub muestra `mergeable=true` pero `mergeable_state=unstable`; `develop` avanzó a `293c3a2756509a5fb6e82ee6bc841197c143f9c9` (a la última comprobación, aprox. 48 commits detrás). El merge de develop más reciente al PR aún no se hizo. No afirmar que el código combinado haya pasado CI/E2E ni que detrás implique conflicto.

## Progreso real de H04

**Código agregado de prueba en `courier-onboarding.spec.ts:1077-1213`:**
1. Repartidor de fixture sembrado como `approved,moto,AB 123 CD` y solicitud `matched` real con `assignedCourierId` y comercio dueño.
2. `merchantClient.rpc('get_trip_details')` comprueba `moto/AB 123 CD`.
3. Navegación `/trips/{requestId}` en sesión aislada `browser.newContext()` de comercio.
4. Courier desde su perfil cambia a `car/ELA 666`, comercio recarga y compara `Auto`/patente y RPC actualizada.
5. Courier cambia a bici, comercio recarga y comprueba `Bicicleta`, patente ausente y RPC `bike/null`.
6. Bloque `finally` cierra contexto y restaura vehículo de courier; además fixture base posee cleanup segregado.

**Negativo del test :998-1072:** auth courier A intenta cambiar B por PostgREST y RLS devuelve 0 filas; snapshot DB de B es idéntico. **Esa prueba pasó en Preview**. `actions.test.ts:1641` agrega caso de la Server Action de A con mocks que comprueba el filtro de propietario. No es una invocación directa de la Server Action en una sesión real de courier incompleto, y no debe describirse como tal. La separación de roles y la guarda de la acción no presentan fallo nuevo demostrado.

El E2E nuevo está bien planteado, pero **aún no se comprobó su éxito real**.

## R01 — Regresión test Playwright de locator ambiguo: arreglado sin verificar

**RED runtime comprobado (SHA 25a0a5ea):** run https://github.com/cadeApp/cadeApp/actions/runs/39011316740 / job `117334308478`.
- El test `:1077` falló en `:1134`, **tres veces** (inicial y dos reintentos).
- Playwright: `strict mode violation: getByText('Repartidor asignado') resolved to 2 elements`: h2 «Repartidor asignado» y div de texto de coordinación de WhatsApp.
- Resumen de Chromium: **82 passed, 1 failed**. No llegó a `global-settings` porque la etapa Chromium devolvió código 1.
- El error es del selector y **NO demuestra defecto funcional del vehículo**.

**Corrección publicada en SHA 523b4989:** `getByRole('heading', { name: 'Repartidor asignado' })` en la misma aserción. El cambio es acotado y semánticamente acertado. **No existe GREEN del nuevo E2E para ese SHA**, porque su run https://github.com/cadeApp/cadeApp/actions/runs/39014666112 terminó `cancelled`, y el estado `e2e-preview` quedó `error`. No confundir cancelación con FAIL por assertion ni con PASS.

**Robustez adicional recomendada si surge nueva colisión:** localizar el Card desde el heading (`heading.locator('xpath=../..')`) y ejecutar `card.getByText` para Moto, Auto, Bici y patente. Nunca `.first()`, `.nth(0)`, `.skip`, `.fixme`, waits arbitrarios ni expectativas recortadas.

## H01/H02/H03/H05

Se mantienen `arreglado-sin-verificar`: el código correctivo de R2 está presente y los unit tests ejercitan las guardas de alta incompleta, rechazo de documentos editables, update con 0 filas y error en lectura. Los E2E previos de perfil y RLS pasaron. No se ejecutaron mutaciones independientes runtime propias del revisor por falta de un checkout ejecutable; por regla del proyecto no completar `verificado_en_sha`.

## CI verificada

**SHA 25a0a5ea:**
- Run https://github.com/cadeApp/cadeApp/actions/runs/39011253559 — SUCCESS.
- Unit job 117334079752: **136/136 suites, 2528/2528 tests PASS**.
- DB job 117334079726: PgTAP **26 files, 2341 tests PASS**; los RED deliberados de otros CC en ese job no cuentan como T-357.
- Typecheck/lint/build/audit/bundle-budget/approval-policy y Vercel: PASS.
- Preview E2E: **FAILURE** por R01.

**SHA 523b4989:**
- Unit, typecheck, lint, build, audit, bundle-budget, approval-policy y Vercel: SUCCESS comprobado en las verificaciones de esta ronda.
- `db-tests` aún no finalizado al último chequeo.
- `e2e-preview: error` debido a workflow CANCELLED. No existe run GREEN para este SHA.

## Resultado y criterio de cierre

**No mergear.** La próxima revisión necesita E2E Preview `SUCCESS` completo para el HEAD final, con evidencia de que el nuevo caso de viaje merchant alcanzó y pasó los oráculos UI + RPC tras cambios, y la integración de `develop` actualizada mediante merge normal con checks reejecutados. No hay una nueva decisión del dueño: 1-A y 2-A siguen vigentes. Se preparó un comentario conjunto de revisión + prompt para agy en la PR. No se alteró código de producto en esta ronda.
