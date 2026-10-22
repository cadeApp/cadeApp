# Informe revisar-pr — T-339 / PR #314 — Ronda 1

**Resultado: SIN BLOQUEANTES DE CÓDIGO DETECTADOS.**

Revisión del commit `d42035c12df95bb24a3a70ce6d0baaf5157fe003` en `fix/T-339-e2e-role-sessions` frente a `develop` `24aad21f800f0d13fdeb082f9807b8eaf1f10fba`, realizada 2026-10-08/09 UTC. El usuario conserva aprobación/merge; **no se aprobó ni se mergeó la PR**.

## 1. Alcance real y corrección

El diff de la PR modifica solo:
1. `e2e/specs/fixed-price.spec.ts` (+123/-86) — tres flujos de UI segregan explícitamente sesión de courier de merchant mediante `newCourierContext(browser,testInfo)` y `courierContext.newPage()`, con `finally { await courierContext.close(); }`; los dos flujos de toma esperan `await expect(courierBrowserPage.getByText('¡Pedido tomado con éxito!')).toBeVisible();` antes del oráculo de BD.
2. `docs/tasks/log/T-339.md` (+38) — historial con dos correcciones y runs RED→GREEN.

Ambos son archivos permitidos en la ficha `docs/tasks/T-339.md` leída **en develop**, sin alteraciones de contrato, RPC, RLS, migraciones, producción, fixtures, LoginPage, `waitForFormHydration`, workflows ni tests ajenos. No `.skip`, `.only`, sleep, fixture falso, expectativa debilitada o timeout inflado en el diff. La herramienta de hidratación de T-337 sigue sin cambios.

**Defecto 1 real:** en el run posmerge #313 `37860963530` tres tests fallaron tras publicar la solicitud, porque `loginAsCourier(0,page)` reutilizaba cookies del merchant. `GET /login` redirigía al dashboard del merchant y el botón de login no aparecía. El mensaje de timeout se atribuía a hidratación, pero el fallo real era sesión/redirect (causa razonada por comportamiento y evidencia de artifact reportada por autor; el artifact en sí no fue abierto por este revisor). La corrección cambia solamente la `Page` del courier y le asigna `BrowserContext` propio.

**Defecto 2 real:** tras segregar roles, run `37864378329` pasó el tercer flujo UI y las cuatro H05, pero los dos escenarios con precio fallaron porque el oráculo leyó `published` o 0 ofertas mientras la toma estaba en progreso. El paso nuevo espera el copy real `¡Pedido tomado con éxito!` que existe en `src/features/offers/copy.ts` y que la hoja presenta después de completar la toma; luego revalida el estado DB existente. El revisor comprobó los dos fallos en logs y el GREEN posterior; no atribuye falsamente a la app un bug de asignación por una aserción de test prematura.

## 2. Evidencia E2E real, con comparación de SHAs

| Run / código | Resultado | Verificación |
|---|---|---|
| [37860963530](https://github.com/cadeApp/cadeApp/actions/runs/37860963530) sobre PR de QA #313, versión anterior | **RED**: 53 PASS, 3 FAIL | Los tres flujos de UI fallan con `locator.evaluate: Timeout 15000ms exceeded` buscando botón de login; H05.1-4 PASS |
| [37864378329](https://github.com/cadeApp/cadeApp/actions/runs/37864378329) sobre `8795e6a35685c3525c9bb1edc0a3ce63ca3f1d44` | **RED**: 54 PASS, 2 FAIL | `matched` esperado pero `published` recibido, y 0 ofertas esperándose 1; tercer flujo y H05 PASS |
| [37866089620](https://github.com/cadeApp/cadeApp/actions/runs/37866089620) sobre `cad7f7eacfba215ac03256f0e3493b5606ea0dfd` | **GREEN REAL** | Job `113613109964` ejecutó siete E2E T-339 sin retries: 3 UI + H05.1, H05.2, H05.3, H05.4, además de 49 specs Chromium restantes: **56 passed (12.1m)** y `global-settings` **3 passed (1.1m)**; job resolve-preview y report-preview-status success |
| HEAD `d42035c12df95bb24a3a70ce6d0baaf5157fe003` | **mismo código probado** | `compare cad7f7e...d42035c` cambia únicamente 38 líneas en `docs/tasks/log/T-339.md`, ninguna del E2E. El run de HEAD `37867592142` estaba EN EJECUCIÓN al reunir la evidencia, no se anota falsamente como verde |

## 3. CI sobre HEAD actual `d42035c12df95bb24a3a70ce6d0baaf5157fe003`

[Run de CI 37867478855](https://github.com/cadeApp/cadeApp/actions/runs/37867478855) **success**:
- `unit` PASS: 125 archivos / **2013 Vitest**, cobertura de ramas `src/domain/testing/rpc-fake.ts=90.04%` ≥90%.
- `db-tests` PASS: 20 archivos / **1903 pgTAP**; `rpc_offers.sql`, `rpc_requests.sql`, `t339_fixed_price.sql` PASS; tipos `db:types --local` generados y `git diff --exit-code` sin error.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success.
- Vercel Preview READY.
- `approval-policy`: inicialmente FAIL porque el cuerpo de la PR traía solo un placeholder en la sección de informe. El algoritmo `.github/workflows/approval-policy.mjs` exige un reporte completo en el **cuerpo** para PR de Lautaro073. El revisor incorporará un informe independiente en el cuerpo sin tocar el workflow; el estado del check deberá verificarse después del evento edited.
- `e2e-preview`: E2E de código `cad7f7eacfba215ac03256f0e3493b5606ea0dfd` GREEN real. No asimilar un job pendiente del HEAD a green.

## 4. Controles propios de revisión y negativa

Sin descargar ni inspeccionar material binario de artifact; sí se inspeccionaron blobs de GitHub, logs completos de las corridas RED/RED/GREEN, la ficha de `develop` y el diff completo. Sin Docker, Supabase local ni despliegues. El revisor realizó un detector estructural sobre blob del SHA `d42035c12df95bb24a3a70ce6d0baaf5157fe003`, con caso base **13/13 GREEN** y cuatro mutaciones independientes confirmadas RED al reutilizar página, eliminar el toast, no cerrar contexto y debilitar aserción de DB. Una quinta mutación injecta `.skip` y falla el guard, no se ejecutan pruebas de Playwright contra código mutado. Código del detector y cómo repetirlo: [evidencia/comandos.md](../evidencia/comandos.md). **El control estructural no sustituye el E2E real**, que efectivamente corrió y pasó en `cad7f7eacfba215ac03256f0e3493b5606ea0dfd`.

## 5. Evaluación

**BLOQUEANTES:** ninguno detectado.

**MEJORAS:** ninguna que justifique modificar el alcance de esta PR. No agregar refactor de fixtures ni tocar `board-sync` aquí: el diff de dos archivos resuelve ambos fallos, hay ejecución GREEN auténtica y una modificación adicional perdería la trazabilidad de la evidencia.

**No revisado / dudas para Lautaro073:** no se afirma que los siete E2E hayan sido reejecutados sobre el HEAD documental `d42035c12df95bb24a3a70ce6d0baaf5157fe003` mientras el run de ese commit siga pendiente. El defecto de proceso `board-sync` que marcó #257 hecha al mergear #299 permanece en un flujo separado y necesita seguimiento sin reabrir automáticamente la tarea.

**Próximos pasos:** publicar informe de revisión + comentario único, comprobar `approval-policy`; Lautaro073 puede decidir mergear si los checks del nuevo HEAD están correctos. Tras merge de #314, confirmar CI Develop y conservar la evidencia E2E. El revisor no realiza merge salvo petición explícita.
