# PR #617 — T-407 — Ronda 4 / D06 (2026-11-06)

**SHA revisado:** `7411c8656f1001738431ff9f4d7d8b66438a516a`. **Resultado: sin bloqueantes funcionales nuevos; H04 corregido por inspección, pendiente E2E real.** No aprobar ni mergear.

## Gate que motivó D06: verificación del revisor

- [Run E2E 42145295195, intento 3](https://github.com/cadeApp/cadeApp/actions/runs/42145295195) aparece bajo `develop` porque es `workflow_run`, pero el job `e2e-preview` 127658313008 hizo **checkout explícito del PR `e6894f1601afe00d15ba816d26f2e5b70adc0d3c`**.
- El log confirmó `admin-audit-filters.spec.ts` **PASSED** (25.0 s). Resumen: **116 passed, 1 failed**. La única falla fue `admin-courier-reinstate.spec.ts:100`, tres veces (original y retries 1/2).
- `strict mode violation: getByText('Aprobado', { exact: true }) resolved to 2 elements`. Uno identificado por Playwright como `getByRole('main').getByText('Aprobado')` y otro adicional fuera del sector buscado. Fallo preexistente del test de T-380, no una regresión de T-407.
- Los reportes sobre Ubuntu 26.04, `next/font/google` y otros gates previos provienen de la bitácora del autor; aquí se cotejó **solo** el error de selectores del intento 3.

## H04 / D06 — origen y alcance

- **D06 autorizada por Lautaro073.** La ficha ampliada introduce `e2e/specs/admin-courier-reinstate.spec.ts` como archivo permitido exclusivamente para las tres aserciones de estados. La fila T-407 del plan se amplió del mismo modo. La frase de ficha «decisión del agente» no cambia la ratificación explícita de Lautaro073.
- Diff respecto del commit del revisor `e6894f16`: únicamente `docs/implementation-plan.md`, `docs/tasks/T-407.md`, `docs/tasks/log/T-407.md` y `e2e/specs/admin-courier-reinstate.spec.ts`, todos del alcance aprobado. `docs/revision-pr/**` quedó intacto antes de esta ronda.
- El E2E sustituyó exactamente **tres** `page.getByText('Aprobado'/'Suspendido',{exact:true})` por `page.getByRole('main').getByText(...)`. Se preservaron las tres aserciones `.toBeVisible()` en el orden `Aprobado / Suspendido / Aprobado`, y el resto del test íntegro, incluidas comprobaciones RPC, auditoría, motivos y disponibilidad. No hay `.first()`, `.nth()`, mocks falsos ni skip.
- La comparación automática de los dos archivos E2E, normalizando esas tres sustituciones y el comentario nuevo, dio **igualdad byte a byte** con la versión anterior.
- **Batería independiente del revisor (estructural, NO Playwright):** baseline con 3/3 aserciones acotadas, y tres mutaciones temporales en memoria detectadas: volver a selector global; sustituir `main` por `complementary`; eliminar la última aserción. Son controles sobre el texto fuente: **no certifican GREEN runtime**.

**Estado de H04: `arreglado-sin-verificar`.** El RED real está confirmado en el SHA anterior; el GREEN de `7411c8656f1001738431ff9f4d7d8b66438a516a` todavía no llegó. P07-coincidencia-demasiado-amplia. No se imputa su origen al cambio A06.

## Checks y cierres

- CI [run 42150888547](https://github.com/cadeApp/cadeApp/actions/runs/42150888547) del nuevo SHA: **en progreso**. Otro control `pull_request_target` 42150888799 terminó success, pero no sustituye CI oficial.
- E2E Preview **sin GREEN confirmado para `7411c8656f1001738431ff9f4d7d8b66438a516a`**. Un status Vercel success derivado de deployment ignorado no sirve como gate.
- La rama diverge del `develop` actual `c4d579ad` (tres commits del lado develop), pero GitHub muestra `mergeable:true`. No se ejecutó `git merge-tree` local sin clone con DNS.
- H01/H02/H03 siguen `arreglado-verificado` en sus SHAs originales; no se tocaron sus archivos. D01=B sigue diferida a T-408.
- **Cuando llegue el gate:** inspeccionar logs completos y SHA de checkout en workflow E2E (que se dispara desde develop); si todo pasa, hacer ronda de cierre y cambiar H04 a `arreglado-verificado`. Si falla, describir el error real antes de tocar código. No aprobar ni mergear desde esta revisión.
