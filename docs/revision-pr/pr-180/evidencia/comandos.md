# Evidencia de revisión independiente — PR #180 / ronda 1

SHA funcional revisado: `a62abb26d5fbde522f7cf41a2363e0b2e0b30126`.

## 1. Sincronización

Consulta de refs vía GitHub:

```text
develop: 01f8fb20587beb5b43b606103051deb49e1c01d1
PR head: a62abb26d5fbde522f7cf41a2363e0b2e0b30126
compare develop...head: diverged · ahead_by=5 · behind_by=9
```

El delta de develop posterior al merge-base no modifica `e2e/specs/notifications.spec.ts` ni la ficha T-307. GitHub reportó la PR mergeable; igual se exige merge de `origin/develop` antes de la próxima ronda.

## 2. Autoría de la carpeta de revisión

Historial del PR:

```text
f584d36076850f5dfef94dd8adec265d3e7a1f75
docs(review): record PR 180 round 1 [T-307]
author: asako669
```

La autorrevisión quedó preservada como `revisiones/autorrevision-agy-r1.md`.

## 3. Auditoría focal de falsos positivos

Harness completo ejecutado fuera del repo:

```js
import assert from 'node:assert/strict';

// H01: reproduce el control actual sin UI ni Realtime.
let offerDelivered = false;
const fakeRoute = () => offerDelivered
  ? { data: [{ courierName: 'Repartidor Ágil Aguilares', amountArs: 2500 }], nextCursor: null }
  : { data: [], nextCursor: null };
assert.equal(fakeRoute().data.length, 0);
offerDelivered = true;
const updated = fakeRoute();
assert.equal(updated.data.length, 1);
assert.equal(updated.data[0].courierName, 'Repartidor Ágil Aguilares');
assert.equal(updated.data[0].amountArs, 2500);
console.log('H01 CONTROL VERDE sin UI ni Realtime: direct fetch/mock basta');

// H02: reproduce el detector actual sin refetch de una query de la app.
let refetchOccurred = false;
function onRequest(url) {
  if (url.includes('/api/') || url.includes('_rsc')) refetchOccurred = true;
}
onRequest('https://cadeapp-staging.vercel.app/api/health');
assert.equal(refetchOccurred, true);
console.log('H02 CONTROL VERDE sin refetch de TanStack: /api/health autogenerado basta');
```

Comando:

```text
node /tmp/pr180-control-audit.mjs
```

Salida:

```text
H01 CONTROL VERDE sin UI ni Realtime: direct fetch/mock basta
H02 CONTROL VERDE sin refetch de TanStack: /api/health autogenerado basta
```

Interpretación: no es una reproducción del navegador completo; es una demostración aislada de que la lógica de aceptación del control actual es independiente de las propiedades que declara medir. La inspección del spec confirma que el primer caso permanece en `/login` y usa `page.evaluate(fetch)`, y que el segundo genera explícitamente `/api/health`.

## 4. Implementación real contrastada

- `src/features/requests/hooks/use-request-offers.ts` configura `refetchOnReconnect: 'always'` y usa `useRealtimeInvalidation`.
- `src/features/requests/components/request-offers-list.tsx` es la UI que debe reflejar las ofertas.
- `src/app/providers.tsx` configura TanStack Query con refetch al reconectar.
- `src/features/notifications/offline/use-offline-status.ts` usa `/api/health` solo como probe del botón de reintento cuando `navigator.onLine` sigue false; ese probe no es la query de ofertas.

## 5. Evidencia del DoD general

El body adjunta typecheck, lint y E2E focal. La bitácora dice:

```text
test ❌ (1579 passed, 2 preexistentes en develop ajenos a la tarea)
```

Mientras la ficha marca el comando completo `pnpm typecheck && pnpm lint && pnpm test` como `[x]`. Se exige reconciliarlo con una corrida exacta en la corrección.

## 6. Decisión D01

`docs/implementation-plan.md §8` lista T-307 con dependencias `T-301, T-204, T-202, T-206`; `docs/tasks/T-307.md` omite T-206.

Lautaro073 eligió **1-A**: agregar T-206 a la ficha. T-206 / PR #118 ya está mergeada, por lo que es sincronización documental.

## 7. Batería completa

No se levantó Docker ni Supabase local. Tampoco se usó CI completa para cerrar esta ronda porque existen bloqueantes; el protocolo reserva esa inspección para la ronda que esté en condición de aprobar. El entorno local de revisión no pudo clonar desde github.com por resolución DNS, por lo que no se atribuyen `pnpm typecheck/lint/test` como ejecutados por esta revisión.
