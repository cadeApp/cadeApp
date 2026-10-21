# Revisión independiente — PR #477 / T-388 — ronda 2

**Fecha:** 2026-10-21  
**SHA funcional revisado:** `ea2aa9bfbd3862ac32a8da3f745c4e7b4dd24177`  
**Base develop:** `214404e0a2baca7ba7e4c87c35ef78c3de3d2109`  
**Resultado técnico: SIN BLOQUEANTES DE CÓDIGO.** PR477-H01 y PR477-H02 cerrados.  
**Aptitud para merge: TODAVÍA NO:** falta un `e2e-preview` oficial GREEN del SHA aprobado; último `e2e-preview` quedó `error` porque el job fue `cancelled`. `db-tests` continuaba en progreso al consultarlo. No aprobar ni mergear mientras permanezcan incumplidos los gates.

## Alcance
- Respecto del commit de revisión de ronda 1 `05b241b`, el autor modificó únicamente `src/features/requests/queries.test.ts`, `src/server/live/t204.test.ts`, `src/features/requests/components/merchant-requests-list.test.tsx` y `docs/tasks/log/T-388.md`.
- Ninguna migración, contrato, código de producción, ficha o dependencia adicional. GitHub reportó 0 commits detrás de develop, 6 delante y `mergeable=true`.
- La bitácora documenta 5 mutaciones RED con baseline GREEN 118/118; **no se reproducen como Vitest independientes** en esta revisión (sin checkout y sin pnpm).

## Cierre de hallazgos

### PR477-H01 — arreglado-verificado en ea2aa9bfbd3862ac32a8da3f745c4e7b4dd24177
Los tres tests de comercio ahora invocan `getMerchantRequests`, `getMerchantHistoryRequests`, `getMerchantRequestWithOffers` usando un mock cuya función `.select()` registra el argumento en llamadas reales a `delivery_requests`. Cada test exige `route_distance_m`, excluye `approx_distance_m` de esa tabla, y verifica `approxDistanceKm === '3,5'` cuando el fixture guarda 3500 m y el campo legacy está en null. La prueba de live usa `reqBuilder._calls.select[0]` tras ejecutar `getAvailableRequestsLiveServer()`. Las lecturas de `delivery_request_drops.approx_distance_m` no se prohíben.

Verificación propia: sobre los fuentes del SHA auditado, cuatro proyecciones concretas fueron comprobadas con script Node y se sustituyó por separado `route_distance_m` → `approx_distance_m` **en memoria**, de modo que la condición evaluada pasa en baseline y falla en cada mutante. La ejecución real de las mutaciones del autor bajo Vitest **no fue reproducida**; su RED figura solo en bitácora.

### PR477-H02 — arreglado-verificado en ea2aa9bfbd3862ac32a8da3f745c4e7b4dd24177
El test de `MerchantRequestsList` ya no inspecciona source con `readFileSync`: monta el componente con Testing Library y tres filas (3,5 / 0,0 / null). Aserciones de DOM para `≈ 3,5 km`, `Menos de 0,5 km`, `Distancia no calculada`. El componente de producción sigue usando `approxDistanceLabel(req.approxDistanceKm)`. El job unit oficial ejecutó la suite en CI verde; la mutación RED del JSX reportada por el autor no se reejecutó por la revisión.

## Evidencia automática sobre el SHA auditado
- CI: `unit` ✅, log examinado: **155 Test Files passed, 3165 Tests passed**, además de las verificaciones Node (80/80 + 6/6); `typecheck` ✅, `lint` ✅, `build` ✅, `audit` ✅ y `bundle-budget` ✅.
- `db-tests`: **in_progress** en la última consulta; falta comprobar su resultado y cifras exactas del log.
- Vercel Preview sobre `ea2aa9bfbd3862ac32a8da3f745c4e7b4dd24177`: READY. El status `e2e-preview` del commit es **error**: [run 39668076458](https://github.com/cadeApp/cadeApp/actions/runs/39668076458), `resolve-preview` success, `e2e-preview` job `cancelled`, `report-preview-status` success. No equivale ni a PASS ni a un fallo funcional del test.
- E2E manual reportado por el autor en la bitácora (contra un Preview previo): **8 passed / 1 failed**. El test T-388 de RPC real y el T-363 pasaron; el test antiguo T-314 `map-privacy.spec.ts:494` observó HTTP 500 `DATABASE_ERROR` en `/api/live/available-requests`. Se afirma reproducción en develop, pero no se verificó independientemente. La issue [#478](https://github.com/cadeApp/cadeApp/issues/478) rastrea el diagnóstico por separado.
- `approval-policy` estaba failure antes de la publicación de esta ronda. No se sustituye ni se falsea el gate; debe re-evaluarse con el comentario oficial.
- No se ejecutó `git merge-tree` local; GitHub reporta rama al día y `mergeable=true`.

## Dictamen
**Sin hallazgos funcionales o de tests pendientes en T-388.** La confirmación de CODE/UNIT no otorga permiso automático de merge. El DoD de `docs/tasks/T-388.md` exige CI y `e2e-preview` GREEN. Si el gate no completa o sigue en rojo, el merge permanece bloqueado. No se cambia el contrato ni se exceptúan gates sin decisión expresa de Lautaro073.

El 500 está registrado en #478 y su origen sigue **no demostrado**: que también ocurra en develop es un dato de la bitácora, no una absolución de este cambio. No corregirlo dentro de PR #477 por conjetura ni desactivar las aserciones de privacidad. No pedir nuevo CI completo **solo** por la documentación de esta ronda.

## Decisiones
Ninguna decisión nueva de producto/arquitectura; D15 y las decisiones previas 1B/2B permanecen. Se aplica el DoD existente sin aprobar excepciones.
