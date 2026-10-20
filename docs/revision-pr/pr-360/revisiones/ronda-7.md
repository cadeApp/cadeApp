# Informe revisar-pr — T-359 · PR #360 · ronda 7

**Fecha:** 2026-10-16. **SHA de autor revisado:** `6d2c433711ed7a8aa562dfd75099029edf82c888`. **Resultado: SIN NUEVOS BLOQUEANTES DE IMPLEMENTACIÓN DE T-359; R03 y H05 tienen E2E auténtico GREEN. Queda revalidar integración con develop actual antes del merge.** No aprobar ni mergear desde la revisión.

## Diferencia desde ronda 6
Dos commits y únicamente dos archivos de autor: `e2e/specs/main-flow.spec.ts` (13 líneas cambiadas) y `docs/tasks/log/T-359.md` (22 líneas cambiadas). Ningún cambio de app, SQL, fixtures, mocks, CI o carpeta de revisión por el autor. La bitácora documenta la corrección, RED previo y chequeos locales declarados.

**PR360-R03:** las dos búsquedas monetarias amplias fueron reemplazadas por un locator desde `h2 Repartidor asignado`, dos niveles padre hasta Card, luego `getByText(formatArs(acceptedOffer.amountArs), {exact:true})` con `toHaveCount(1)` y `toBeVisible()`, tanto antes como después de `reload()`. Esta es la resolución precisa del error anterior (monto en Card y mensaje de cliente), sin cambiar oráculo DB, prueba de dos contextos, contacto, pago, Back ni redirección.

## Evidencia real contrastada en GitHub Actions
- **RED anterior:** [run 38694202782](https://github.com/cadeApp/cadeApp/actions/runs/38694202782), SHA `ceb1161b`, 75 PASS / 1 FAIL; `strict mode violation` en locator monetario (dos coincidencias).
- **GREEN:** [run 38945199224](https://github.com/cadeApp/cadeApp/actions/runs/38945199224), job E2E `117122539233`, SHA probado `6d2c4337`: **76 Chromium passed (19.2m)**, **3 global-settings passed (58.6s)**. El test de dos sesiones `main-flow.spec.ts:89` pasó en 33.9s, incluyendo los asserts posteriores al importe. El job `report-preview-status` publicó `e2e-preview=success` en el commit exacto. `resolve-preview` reconoció PR interna #360 y Preview válido.
- **CI mismo SHA:** run `38945110606`: `unit` 136 archivos/2435 tests, 79 tests de workflows y 6 ADR; `db-tests` 26 archivos/2341 pruebas con `Result: PASS`; typecheck/lint/build/audit/bundle-budget success. Los RED de mutaciones observados dentro del job DB corresponden a otras tareas, NO certifican controles independientes para T-359.
- **Aprobación:** Lautaro073 aprobó el SHA `6d2c4337`, y `approval-policy` pasó en run `38946219097`. La revisión no suplantó su aprobación.

**Estados estructurados:** H05 y R03 cambian a `arreglado-sin-verificar`: el RED→GREEN de E2E está acreditado, pero esta revisión no ejecutó mutaciones independientes. `verificado_en_sha` permanece null; los demás hallazgos conservan su estado. No afirmar que correr Playwright equivale a mutar independientes controles.

## Integración con develop actual
`develop` observado `af0cf1d72e9e33524cde5db138d940fee33ce6f6`, 36 commits por encima de la sincronización `cba78a2945a12074bc42233e89dfec93534c97be` de la rama. Incluye contratos CC-025/026/027/028 y ediciones de `e2e/specs/main-flow.spec.ts`, `src/features/trips/components/trip-merchant-view.tsx` y `src/lib/whatsapp.ts`.
Las modificaciones E2E de develop afectan otra zona del archivo de las dos aserciones de T-359, y el DOM relevante de Card con `Repartidor asignado` y monto aún se observa en develop. **GitHub reporta `mergeable:true`; no se observó conflicto de Git**, pero el conjunto nuevo NO fue objeto del E2E verde del SHA antiguo. Es un riesgo de compatibilidad sin defecto reproducido, no un hallazgo inventado. Recomendación técnica: `git fetch origin && git merge-tree --write-tree origin/develop HEAD`; incorporar `origin/develop` mediante merge normal, sin rebase/force y correr CI + E2E en la nueva punta antes de mergear.

## Limitaciones y decisión
No se ejecutó pnpm, git merge-tree local ni mutaciones independientes: no hay clon y el contenedor no puede resolver github.com. Los resultados reportados provienen de lectura directa de logs del runner. No se modificó el producto ni secretos. No hay decisión nueva del usuario; se mantiene la Decisión B de tarjetas terminales.
El body del PR contenía números antiguos y E2E `[ ]` pese al GREEN actual. Corregir esos datos documentales sin certificar mutaciones no hechas. El commit de revisión moverá HEAD y probablemente requerirá renovar la aprobación de Lautaro073.