# Informe de revisión independiente — PR #746 / T-437 / CC-052 — Ronda 1

- **Fecha (Argentina):** 2026-11-13.
- **HEAD verificado por lectura:** `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152`.
- **Base `develop`:** `1a231dfa00ad35fd1e51c0079925767d9dc15f5e`.
- **Resultado:** **SIN BLOQUEANTES DE CÓDIGO; post-merge E2E sin verificar**.
- **Autor del informe:** revisión independiente (no autor de la implementación).

## 1. Alcance y condición de integración

GitHub confirmó `feat/T-437-e2e-reason-locator` a 1 commit por delante de la base (sin commits por detrás), con 2 archivos cambiados: `docs/tasks/log/T-437.md` (+29) y `e2e/specs/courier-onboarding.spec.ts` (+4/-2). Ambos están en Archivos permitidos de `docs/tasks/T-437.md` leído desde `1a231dfa00ad35fd1e51c0079925767d9dc15f5e`. No se editó la ficha. La PR figura `mergeable: true`; este dato no equivale a ejecución de E2E ni a aprobación.

## 2. Diagnóstico del fallo previo (evidencia de GitHub Actions)

En el job `132254179912`, run [43532734795](https://github.com/cadeApp/cadeApp/actions/runs/43532734795), el control de `t437-ui-approve-guard` falló antes de `toBeDisabled()` porque `page.getByText(ADMIN_COPY.detail.requiredDocumentsPending)` resolvió dos `<p id="required-documents-reason">`. El log identifica uno dentro de `getByRole('toolbar', { name: 'Acciones sobre el postulante' })` y un segundo párrafo homónimo. Aparece además un diagnóstico `[T-429 streaming] segmento huérfano`.

La causa **confirmada** es ambigüedad del selector global por dos nodos. La afirmación de que el duplicado proviene exactamente del streaming es **hipótesis plausible**, no causalidad demostrada. La fase mutante falló en `toBeDisabled`, pero el clasificador informó `CONTROL_NOT_GREEN`, correctamente: no puede acreditarse RED sin control verde.

## 3. Revisión del arreglo

- `e2e/specs/courier-onboarding.spec.ts:941-948`: `toolbar = page.getByRole('toolbar', { name: ADMIN_COPY.detail.actionsBarLabel })`; la aserción de texto pasa a `toolbar.getByText(...)` y la de aprobación a `toolbar.getByRole('button', { name: ...approve })`.
- El DOM del componente en base (`src/features/admin/components/applicant-detail-view.tsx:798-830`) tiene un `role="toolbar"`, un párrafo de motivo como hijo y el botón `Aprobar repartidor` como hijo, con `disabled={!docsReady}`. Otro E2E ya localiza el toolbar con el mismo nombre (`courier-onboarding.spec.ts:1083`).
- Se mantienen `toBeDisabled()`, el título literal buscado por el manifest, la RPC directa AAL2 con `DOCUMENTS_NOT_VERIFIED`, el estado `pending` y el conteo cero de auditoría.
- La comparación de archivos a los dos SHAs confirmó idénticos `e2e/mutations/manifest.json` y `e2e/mutations/t437-ui-approve-guard.patch`; no se tocó producto ni catálogo.

**Juicio:** el selector nuevo apunta al control que la prueba dice proteger. No se usa `.first()`, `nth()`, un mock, una espera fija ni se cambian expectativas para forzar GREEN. Si la UI produjera múltiples toolbars accesibles, Playwright todavía podría fallar: precisamente por eso el control post-merge es obligatorio.

## 4. Controles e independencia

| Control | Resultado y alcance |
|---|---|
| Estructural: motivo dentro de toolbar | PASS por inspección del SHA; mutación propia `selector_motivo_global` lo vuelve FAIL en el oráculo estructural |
| Estructural: botón dentro de toolbar | PASS por inspección del SHA; mutación propia `selector_boton_global` lo vuelve FAIL en el oráculo estructural |
| Estructural: `toBeDisabled` intacto | PASS por inspección del SHA; mutación propia `sin_disabled` lo vuelve FAIL en el oráculo estructural |
| Título literal, manifest y patch | Comparados byte a byte entre base y HEAD; PASS |
| CI sobre `3da9a12e` | Run 43534547830: lint, typecheck, unit, build, audit y bundle-budget PASS; db-tests en curso al inspeccionar |
| Playwright control nuevo sobre HEAD | **NO EJECUTADO**; no llamar GREEN a un chequeo estático |
| Playwright mutante aprobar sobre HEAD | **NO EJECUTADO**; requiere nuevo dispatch después del merge |

La batería propia es **estructural**, no una demostración RED→GREEN funcional del navegador. El script completo, más el procedimiento para verificar el E2E real, están en `evidencia/comandos.md`. No hubo worktree local: el contenedor no puede resolver `github.com`; lectura y contraste efectuados a través del conector GitHub. No se levantó Supabase ni Docker ni se dispararon workflows.

## 5. Contraste de mutaciones anteriores

- Reactivación: run [43532735200](https://github.com/cadeApp/cadeApp/actions/runs/43532735200), control 1 passed, mutante `toBeDisabled()` esperado 1 failed, `RED_CONFIRMED`.
- Reconsideración: run [43532737982](https://github.com/cadeApp/cadeApp/actions/runs/43532737982), intento 2, control 1 passed, mutante `toBeDisabled()` esperado 1 failed, `RED_CONFIRMED`. El primer intento tuvo un problema de build/`next/font`, no fue RED válido.
- Aprobación: run [43532734795](https://github.com/cadeApp/cadeApp/actions/runs/43532734795), `CONTROL_NOT_GREEN`; el cambio actual **no** acredita todavía `RED_CONFIRMED`.

## 6. Hallazgos y decisiones

- **BLOQUEANTES:** ninguno nuevo.
- **MEJORAS:** ninguna necesaria dentro del alcance estrecho de este follow-up.
- **DECISIONES 🔵:** ninguna nueva. Se mantienen las decisiones de CC-052 y la propiedad de merge en P1.
- **NO TOCAR:** manifiesto, patch, `expectedFailure`, título del caso, código de producto, ficha de T-437; sin evidencia de defecto nuevo en ellos.

## 7. Cierre y condición posterior

El diff es razonable para corregir el selector y no introduce una regresión apreciable por inspección. **No certificar el E2E de aprobación hasta volver a correr `e2e-mutation` contra el merge en `develop` y obtener control GREEN + mutante RED por `toBeDisabled()`**. El incidente de streaming merece seguimiento separado si la prueba continúa fallando, no una explicación causal asumida. La E2E de subsanación tampoco se declara verde en Develop.

**Sin aprobación ni merge por parte del revisor.**
