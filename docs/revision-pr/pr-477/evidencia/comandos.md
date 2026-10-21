# Evidencia — PR #477, ronda 1
Código auditado en SHA 620d92c04a95ebdee8e8c28f9f798c2a4e39bdc5. No se clonó ni ejecutó Vitest/E2E. No se inventan resultados.

## H01 — Prueba por inspección
- src/features/requests/queries.test.ts:2983 usa readFileSync y matchAll sobre fuente para representar tres lectores; no registra las llamadas reales de .select().
- src/server/live/t204.test.ts:1353 usa readFileSync + slice de texto; tampoco registra .select().

## H02 — Harness autocontenido ejecutado
Reproduce exclusivamente la aserción regex (NO es Vitest ni un test real de DOM):

~~~bash
node <<'NODE'
const regex = /approxDistanceLabel\(req\.approxDistanceKm\)/;
const original = '<span>{approxDistanceLabel(req.approxDistanceKm)}</span>';
const mutated = original.replace('{approxDistanceLabel(req.approxDistanceKm)}', '{req.approxDistanceKm}{/* approxDistanceLabel(req.approxDistanceKm) */}');
if (!regex.test(original) || !regex.test(mutated)) throw new Error('No se reproduce');
console.log('Original: true; mutado: true');
NODE
~~~

Salida verificada: `Original: true; mutado: true`. La llamada al helper quedó solo en un comentario.

## Batería independiente pendiente sobre el nuevo SHA
1. Baseline GREEN de tests modificados.
2. Mutación individual de proyección route_distance_m→approx_distance_m en getMerchantHistoryRequests, getMerchantRequests, getMerchantRequestWithOffers y getAvailableRequestsLiveServer. Cada test debe fallar por el campo incorrecto, no por mocks o TypeError.
3. Mutar el JSX de MerchantRequestsList a texto crudo: el test que monta la UI debe fallar.
4. Restaurar todas las mutaciones, revalidar GREEN y guardar líneas Test Files/Tests genuinas.

Comandos previstos:
~~~bash
pnpm exec vitest run src/features/requests/queries.test.ts src/server/live/t204.test.ts src/features/requests/components/merchant-requests-list.test.tsx
pnpm typecheck && pnpm lint && pnpm test
~~~

CI y E2E remotos pendientes de verificación sobre el SHA final. No se levantó DB, Docker ni servicios externos.
