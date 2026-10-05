# PR #251 · T-313 — Ronda 2

- **SHA revisado:** `79c6985e8c9717cf00f28c1baa6e7e4fbd38e726`
- **Fecha:** 2026-10-05
- **Resultado:** CON BLOQUEANTES (1)
- **Sincronización:** 6 ahead / 3 behind frente al `develop` actual.

## H01 · ARREGLADO Y VERIFICADO
La tabla del caso `Un courier no entra a (merchant)` cubre las 7 rutas canónicas actuales y los 4 aliases,
incluidos representantes `e2e-denied` para ambos segmentos `[id]`. Cada entrada pasa por
`expectMerchantPanelBlocked`, que verifica destino y ausencia de `Mis solicitudes`.

Se reenumeró `src/app/(merchant)` sobre `develop` actual y coincide con la tabla.

## H02 · ARREGLADO Y VERIFICADO
`registrationContext` conserva `testError`; si cleanup también falla, lanza `[E2E Lifecycle Error]` con
ambos mensajes y `cause: testError`. Si solo falla cleanup, relanza `cleanupErr`.

## H03 · ARREGLADO Y VERIFICADO
El cuerpo dejó el checkbox general desmarcado y la bitácora registra los resultados reales. El CI integrado
`37350422473` está verde: lint, typecheck, unit, db-tests, audit, build y bundle-budget.

Dentro de unit:
- 119 Test Files passed;
- 1899 Tests passed;
- `tools/verify-fichas.test.ts`: 7/7.

Por eso el fallo local atribuido a T-336 no se reproduce como defecto del árbol integrado actual. H03 queda cerrado
porque ya no existe la declaración falsa que lo originó.

## H04 · SIGUE ABIERTO
`e2e/AGENTS.md` exige demostrar una vez que cada aserción del DoD falla al romper la regla.

Kira hizo bien en no fabricar esa evidencia. El Preview ya existe y el trusted resolver del run `37350595553`
reportó:
- `PR interna #251 contra develop.`
- `Preview listo para E2E.`

El job `e2e-preview` está ejecutándose. Aun si termina GREEN, la demostración RED comportamental sigue pendiente.

## P3
La solicitud se publicó en el comentario `5999858656`. Al cierre de esta ronda no hay review ni visto bueno P3.

## Sincronización
La rama quedó 3 commits detrás de `develop`. Antes de la ronda final debe sincronizarse según regla 50, rerun de
`pnpm typecheck && pnpm lint && pnpm test`, push normal y nuevo Preview/E2E sobre el nuevo HEAD.

## Veredicto
**CON BLOQUEANTES (1): H04.** Además: rama al día y visto bueno P3 pendientes.
No apruebo ni mergeo.
