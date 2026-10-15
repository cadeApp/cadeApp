# Evidencia y comandos — PR #359 · hasta ronda 3

## Ronda 3 — SHA `0aa411eb6731c8113718cc363190ad24d76d6820`
- Fuente GitHub: metadata PR #359, comentario del autor pidiendo ronda 3, HEAD y diff de especificación T-360.
- Código de referencia en develop: `src/features/requests/components/request-offers-list.tsx` usa `<Card>` con `offer.courierName` en heading h4; `src/ui/card.tsx` define Card como `<div>`; no existe data-courier-id en ese componente.
- Selector nuevo en test de SHA actual: `article:has-text(...), [data-courier-id=...]` más fallback a `merchantPage.acceptOfferButton.first()`. Inspección confirma que el selector específico no puede alcanzar una tarjeta real.
- CI unit SHA: [job](https://github.com/cadeApp/cadeApp/actions/runs/38684472429/job/116256072286) SUCCESS; log muestra `Test Files 130 passed (130)`, queries.test.ts 18 tests, use-active-trips.test.tsx 11 tests.
- [approval-policy](https://github.com/cadeApp/cadeApp/actions/runs/38684470425/job/116256068026) FAIL, mensaje `Falta el informe completo de revisar-pr sin bloqueantes.`.
- [db-tests](https://github.com/cadeApp/cadeApp/actions/runs/38684472429/job/116256072353) IN PROGRESS en momento de lectura.
- e2e-preview: status no disponible en commit status API del SHA evaluado; Vercel Preview Ready separado. Sin run Playwright demostrable.

## Verificación independiente pendiente
NO se ejecutaron tests o mutaciones en este revisor; solo GitHub CI y análisis estático. No atribuir RED/GREEN de M1–M8 o H03–H07 a revisor.

## Comandos sugeridos en clon limpio (NO ejecutados aquí)
```bash
git fetch origin
git show 0aa411eb6731c8113718cc363190ad24d76d6820:e2e/specs/main-flow.spec.ts
git show develop:src/features/requests/components/request-offers-list.tsx
git show develop:src/ui/card.tsx
pnpm exec vitest run src/features/offers/hooks/use-active-trips.test.tsx src/features/trips/queries.test.ts src/features/offers/courier-panel.test.tsx
pnpm typecheck && pnpm lint && pnpm test
git diff --check
```
El E2E Playwright se ejecuta vía gate e2e-preview de confianza en environment develop, sin exponer variables/secretos al revisor. Se debe capturar PASS/FAIL por SHA + URL.

## Mutación H07 requerida (pendiente)
Primero control Playwright GREEN en Preview contra SHA real; modificar temporalmente selector del spec para elegir al repartidor 1 (no dueño) y exigir que el assert de actor caiga RED; restaurar copia segura fuera del repo y volver a GREEN. No desplegar ni commitear mutación en el repo; si el gate no permite mutación remota segura, reportar NO EJECUTADO y usar el mecanismo confiable existente e2e-mutation, si soporta la propiedad, sin cambiarlo.

## Ronda 4 — comprobaciones observadas sobre `361317a17b9b99d0c3bdc3d9366966eb898064a0`
**Evidencia de salida remota real, NO simulada:**
- E2E [run 38686292491](https://github.com/cadeApp/cadeApp/actions/runs/38686292491), job 116261838001, checkout `HEAD is now at 361317a`; Preview Develop health+environment PASS.
- `✓ 34 [chromium] › e2e/specs/main-flow.spec.ts:544:7 › T-360 ... (44.7s)`.
- `75 passed (19.5m)`; `3 passed (1.0m)`; commit status `e2e-preview: success` sobre `361317a17b9b99d0c3bdc3d9366966eb898064a0`.
- CI [unit](https://github.com/cadeApp/cadeApp/actions/runs/38686225890/job/116261575917): `Test Files 131 passed (131)`, `Tests 2204 passed (2204)`.
- CI [db-tests](https://github.com/cadeApp/cadeApp/actions/runs/38686225890/job/116261575856): `Files=22, Tests=2205, Result: PASS`.
- Ejecutadas por agente de revisión: consultas de código/metadata/log de Github y contraste exacto de SHA; no `pnpm` local ni clon ejecutable, **mutaciones independientes NO EJECUTADAS**.
- Verificación original H07: fuente de Card renderiza `<div>`, spec corregido usa `div.rounded-xl.border-border.bg-card` y `heading h4` exacto; test integrado PASS.
**Comandos opcionales para futura mutación independiente no ejecutada:** `pnpm exec vitest run src/features/offers/hooks/use-active-trips.test.tsx src/features/trips/queries.test.ts src/features/offers/courier-panel.test.tsx`; instrumentar cambios temporales EN MEMORIA de callback, dropsError y perDropSuffix y exigir RED, restaurar desde copia segura y GREEN. No afirmar ejecución sin salida.
