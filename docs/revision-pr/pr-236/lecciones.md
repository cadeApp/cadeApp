# Lecciones de la PR #236 para `AGENTS.md` y las reglas

**Fuente:** 1 hallazgo en Ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

`PR236-H01` es otra instancia de `P08-control-no-cubre-lo-que-dice`: el test corregido ya no puede pasar por el fetch inicial, pero conduce `onlineManager` directamente y por eso salta la frontera que estaba roja en el navegador real.

## Lecciones

No se asigna AG nuevo.

- Refuerza **`pr-82/AG-77`**: los tests de TanStack deben reproducir la configuración y el evento que existe en producción, no una versión más barata del contrato.
- También aplica la distinción de **`pr-82/AG-88`**: «el mecanismo interno puede refetchear» y «la pantalla real obtiene un refetch por el evento externo» son propiedades distintas.
- La enumeración mostró que `useAvailableRequests`, `useRequestOffers` y `useTrip` comparten la misma frontera global. Si se arregla, debe arreglarse una vez en `Providers`, no tres veces en hooks.

## Qué cambiar, en orden de impacto

1. Cerrar browser offline/online → `onlineManager` en `Providers`.
2. Añadir test de la integración global y conservar el test directo de reconnect del hook.
3. Repetir mutaciones RED; no crear tests nuevos que solo afirmen estructura sin efecto.
4. Tras merge, usar PR #180 como control externo real sin tocar su spec.

## Advertencia

El catch-up nuevo de `SUBSCRIBED` puede generar una GET adicional y contaminar el contador del E2E de reconnect. Un futuro verde del spec externo sigue siendo necesario, pero no reemplaza la prueba separada de la frontera global.
