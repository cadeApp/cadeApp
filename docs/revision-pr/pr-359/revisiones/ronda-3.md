# Informe independiente — PR #359 / T-360 · ronda 3
**SHA evaluado:** `0aa411eb6731c8113718cc363190ad24d76d6820` · **Base:** `develop` @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b` · **Fecha:** 2026-10-15.
**Resultado: CON BLOQUEANTES (2 vigentes): H04 E2E sin ejecución y H07 nuevo. NO MERGEAR.**

## Correcciones recibidas de ronda 2
- H03: los tests ahora guardan callbacks por tabla y los invocan en `act` en vez de invalidar manualmente. 11 tests del archivo pasaron en CI unit de este SHA. **Estado: arreglado-sin-verificar** hasta mutación independiente reproducida.
- H05: el lookup single-drop comprueba `dropsError` y lanza error sanitizado; hay nuevos tests de error/null. CI unit suite trips (18 tests) verde. **arreglado-sin-verificar**.
- H06: ActiveTripCard muestra «por entrega» en multi-drop y test de ausencia en single-drop. CI unit verde. **arreglado-sin-verificar**.
- H01: implementación presente pero sin E2E verificable; H02: cobertura existente pero aún parcial. No atribuir verificado_en_sha.

## H07 — ALTO — selector E2E apunta a etiquetas que el DOM real no tiene
**Archivo:** `e2e/specs/main-flow.spec.ts:571` y siguientes.
**Evidencia [ANÁLISIS DEL CÓDIGO, no ejecución]:** el test busca `article:has-text(...)` o `[data-courier-id=...]`. En `src/features/requests/components/request-offers-list.tsx` el listado es `<Card>` que `src/ui/card.tsx` renderiza como `<div>`, y no se define data-courier-id. El selector siempre da cero y cae en `merchantPage.acceptOfferButton.first()`. Si cambia el sorting, se acepta otro courier y la prueba falla por el assert posterior, en vez de seleccionar de forma determinista el actor definido en el fixture.
**Arreglo:** localizar heading h4 por `targetCourier.displayName` y su ancestro de tarjeta real, seleccionar su botón Aceptar, exigir unicidad y eliminar fallback; tras aceptación verificar ID del ofertante en el DB inspector. Mutación temporal RED deliberando elegir Courier 1 y assert de dueño; restaurar.
**Clasificación:** bloqueante ALTO, P08; el requisito es un test determinista del actor asignado.

## H04 — ALTO — prueba E2E aún no ejecutada
**Archivo:** `e2e/specs/main-flow.spec.ts` (flujo T-360).
**Evidencia [CI y bitácora]:** bitácora del autor describe E2E Preview como PENDIENTE. En GitHub existe check Vercel Ready pero no commit status e2e-preview para el SHA `0aa411eb6731c8113718cc363190ad24d76d6820`. El workflow `.github/workflows/e2e-preview.yml` confía en un `repository_dispatch` emitido por Vercel; el propio workflow publica status e2e-preview sobre el SHA testeado. No hay run ni URL de éxito recibidos.
**Arreglo:** correr el E2E automático permitido contra el SHA CORREGIDO y registrar URL/run/log. Si no se emite el repository_dispatch, diagnosticar configuración externa y dejar TAREA MANUAL visible, sin cambiar CI ni dar PASS falso.

## Checks confirmados en GitHub para SHA `0aa411eb6731c8113718cc363190ad24d76d6820`
| Check | Estado |
|---|---|
| unit | ✅ SUCCESS; 130 test files pasados; 18 tests queries y 11 de hook Realtime en log |
| typecheck, lint, build, audit, bundle-budget | ✅ SUCCESS |
| db-tests | En progreso en la consulta realizada (no afirmar PASS hasta conclusión) |
| approval-policy | ❌ FAIL: falta informe sin bloqueantes |
| Vercel Preview | Ready, no equivale a E2E |
| e2e-preview / Playwright T-360 | SIN RESULTADO para este SHA |

**Método:** inspección de código y lectura de CI, sin clon local ejecutable. NO corrí mutaciones, Vitest o Playwright en esta sesión, por lo que los hallazgos se registran como análisis; no se escribe `verificado_en_sha`. Las pruebas propias del autor tampoco prueban independencia.

## NO TOCAR
Se mantienen decisiones 1-A/2-A/3-A/4-A. No modificar contratos ni RLS, schema, servidor compartido, src/ui, fixtures globales ni workflows. Correcciones E2E limitadas a spec permitido. Informe y prompt completo juntos en un comentario de GitHub.