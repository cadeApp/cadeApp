# Informe revisar-pr — PR #360 / T-359 — Ronda 6

**Fecha:** 2026-10-15. **SHA revisado:** `ceb1161b07f1419992e764bbe17db9a28ea2fc2e`. **Autor:** asako669 (P2). **Resultado: CON BLOQUEANTES — PR360-R03 (alto), y PR360-H05 parcial.** No aprobar ni mergear.

## Material revisado

1. Reglas del proyecto, guía `COMO-ENTREGAR.md` (con excepción de ubicación según instrucción humana vigente), skill `revisar-pr`, catálogo de patrones, ficha `docs/tasks/T-359.md` **desde develop**, bitácora `docs/tasks/log/T-359.md`, PR #360 y comentarios; rondas 1–5.
2. Merge `ceb1161b` respecto a `235559ec` y `cba78a29`: preserva test concurrente T-359 y añade test feed T-360. El componente `MerchantRequestsList` conserva navegación a `/trips/[id]` y cancelación T-364, con ambas suites de tests. Verificado por inspección de ambos lados y commit padre; **no se ejecutó checkout/merge-tree local**.
3. `develop` avanzó después del merge: SHA `3b9f409048e2b3555377108cc29765c091fc995a`; incorpora CC-026, validaciones y pruebas adicionales. Los archivos enumerados cambiados no solapan directamente los tres del merge T-359/T-360/T-364; no afirmar conflicto ni compatibilidad final sin volver a comparar.
4. GitHub reporta PR abierta y `mergeable:true`, **no equivale a CI E2E verde**.

## PR360-R03 — ALTO — fallo auténtico de E2E por selector de monto ambiguo

**Archivo:** `e2e/specs/main-flow.spec.ts:248` y la repetición posterior a `winnerPage.reload()` (`getByText(formatArs(acceptedOffer.amountArs))`).

**Evidencia real:** en [run 38694202782](https://github.com/cadeApp/cadeApp/actions/runs/38694202782), job `116286928820`, contra el SHA `ceb1161b07f1419992e764bbe17db9a28ea2fc2e`, Playwright ejecutó el spec en Chromium (resultado **75 passed, 1 failed**, con reintentos). El `expect(...).toBeVisible()` falla por **strict mode violation**: `getByText('$ 1.500')` devuelve dos resultados, el **span visible con la tarifa en la Card de repartidor** y el **mensaje al cliente** que incorpora el mismo importe. Retry con `$ 2.000` produce lo mismo. Se trata de un fallo verificable del test **no** del match en RPC.

**Causa y corrección exacta:** no cambiar el producto, la tarifa, el seed, los datos de pago o la aceptación. El componente `TripMerchantView` muestra una Card con `<CardHeader><h2>Repartidor asignado</h2>…`, dentro de ella un `span` con `formatArs(trip.amountArs)`. Buscar la Card desde ese h2 (`getByRole('heading', {level:2, name:/repartidor asignado/i}).locator('..').locator('..')`) y dentro `getByText(formatArs(acceptedOffer.amountArs),{exact:true})`; exigir `toHaveCount(1)` **y** `toBeVisible()` **antes y después de reload**. Reusar locator lazy de Playwright si no hay ambigüedad. **Prohibido** usar `.first()`, `.nth()`, `count>0`, modificar datos, saltar control, o aumentar timeout como solución. Esto distingue el importe del viaje del mensaje informativo sin reducir el requisito real.

**Cobertura que aún no llegó a ejecutarse en ese caso:** el fallo interrumpe la aserción anterior a las de medio de pago, enlace de WhatsApp, `reload`, `goBack`, redirección canónica y dashboard. Que otras 75 pruebas pasaran no valida esas partes de H05; conservar estado `parcial`.

**RED/GREEN:** tenemos un RED concreto y auténtico del Preview, no una mutación independiente. Exigir nueva corrida completa posterior al fix contra SHA nuevo y su resultado real (no solo unit). No autorizar E2E mutation insegura ni suplantar evidencias.

## CI contrastado del HEAD

| Check | Resultado real |
| --- | --- |
| `unit` | SUCCESS · Vitest 132 suites, workflow verification 79, ADR 6 |
| `db-tests` | SUCCESS · `Files=22, Tests=2205, Result: PASS` |
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | SUCCESS |
| `e2e-preview` | **FAILURE** · 75 PASS / 1 FAIL · [run 38694202782](https://github.com/cadeApp/cadeApp/actions/runs/38694202782) |
| `approval-policy` | FAIL · requiere aprobación vigente de Lautaro073 (no suplir) |

No se ejecutaron mutaciones ni pnpm local por el revisor. La prueba e2e sí se ejecutó en CI de forma auténtica; nunca declararla GREEN.

## Decisiones y cierre

**No hay decisión humana nueva de producto:** la B histórica de los terminales sigue cerrada. La solución de R03 es una corrección objetiva de selector conforme al DoD. No ampliar alcance ni modificar otra tarea. Próximo agy debe pullear el commit de informe, corregir exclusivamente el spec, conservar los tests reales, registrar bitácora y pedir nueva ronda. Cuando Playwright pase completo y el HEAD siga actualizado con develop, Lautaro073 decidirá la aprobación y merge.
