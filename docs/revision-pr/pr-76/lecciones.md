# Lecciones — PR #76 (T-113)

Numeración continua del proyecto. `AG-01`…`AG-63` están en las carpetas de las PRs anteriores.

---

## `AG-64` · Un mock de contrato de RPC debe tiparse contra el esquema canónico, no contra una interfaz imaginada

**Origen:** `PR76-H02`, `PR76-H03`

En `src/features/offers/actions.test.ts`, el test de `acceptOfferAction` inventó para `acceptOfferRpc` un valor de retorno `{ matched: true, requestId, offerId, courierId, matchedAt }` y un código de error `'INVALID_STATE'`.

Ninguno de los dos coincide con el contrato canónico fijado por T-102 en `src/domain/rpc-contracts.ts` (`acceptOfferOutputSchema` define `{ requestId, acceptedOfferId, status: 'matched', matchedAt, idempotent }` y el código canónico es `'INVALID_STATE_TRANSITION'`).

El costo de diseñar tests en fase roja contra contratos imaginados es doble:
1. `typecheck` falla inmediatamente con `TS2739` y `TS2322`.
2. Fuerza a que la implementación de la Server Action introduzca adaptaciones o transformaciones erróneas que contradicen la API del servidor.

> **Regla propuesta.** Cuando se escriben tests preliminares (fase roja) de una Server Action o componente que consume una RPC o función del dominio, los mocks **se tipan explícitamente con `RpcOutput<K>` y `RpcErrorCode<K>`** importados de `@/domain/rpc-contracts`. Si el tipo del mock no compila contra el contrato canónico, el test está equivocado antes de escribir la primera línea de código de producción.

---

## `AG-65` · Probar tiempo real con un prop callback (`onRegisterRealtime`) es un proxy tautológico que no verifica la suscripción

**Origen:** `PR76-H05` (pariente de `P08-control-no-cubre-lo-que-dice` y `AG-62`)

El DoD de `T-113` pide: *"la oferta nueva aparece sin recargar"*. Para cubrirlo, el test de UI introdujo un prop de prueba en `<RequestOffersList onRegisterRealtime={...}>` y llamó manualmente a la función inyectada con un payload simulado.

Ese control mide que el componente tiene un `useState` que responde a un callback. Es **completamente ciego** a todo lo que hace que el tiempo real funcione en el producto:
- Si el cliente de Supabase llama a `supabase.channel(...)` con el nombre correcto de canal.
- Si escucha los cambios de Postgres (`postgres_changes`) en `event: 'INSERT'`, `schema: 'public'`, `table: 'offers'`.
- Si aplica el filtro por `request_id = eq.<id>`.
- Si el canal se suscribe al montar y se remueve (`supabase.removeChannel(channel)`) al desmontar el componente para evitar fugas de memoria y listeners zombis.

Si se remueve toda la integración de Supabase Realtime del componente y se conserva únicamente el prop callback, el test sigue en **verde**.

> **Regla propuesta.** Un test de reactividad en tiempo real debe mockear el cliente de suscripciones (`@/lib/supabase/browser` o el hook de realtime correspondiente) y afirmar la interacción real: canal abierto, tabla y filtro correctos, despacho del evento al estado, y limpieza (`removeChannel`) al desmontar. Nunca debe introducirse un prop espurio en el componente de producción exclusivamente para alimentar datos desde el test.
