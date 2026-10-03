# PR #236 — T-333 · Cerrar carreras de Realtime y reconexión real en ofertas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/236 |
| **Tarea** | T-333 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-333-realtime-reconnect` → `develop` |
| **Base revisada** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **HEAD revisado** | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` |
| **Estado** | **BLOQUEADA — PR236-H01** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` | 1 bloqueante | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR236-H01 | El test de reconnect salta la frontera navegador → `onlineManager` que sigue roja en el E2E real | alto | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué está bien

- La rama está al día con `develop`: 3 commits adelante, 0 atrás y merge-base = `bc6329d941a510cc37d23827f5e3798e3839c065`.
- Los cinco archivos del diff están permitidos por T-333.
- El catch-up de Realtime usa el callback de `subscribe()`, solo actúa en `SUBSCRIBED`, invalida las keys del canal y conserva la prohibición de `setQueryData`.
- Los controles de readiness cubren: antes de readiness, `SUBSCRIBED`, estados no listos y callback tardío tras unmount.
- La fila T-333 del plan quedó sincronizada con el primer ítem del DoD sin modificar la ficha.
- CI del SHA revisado: unit `114/114` archivos y `1743/1743` tests; typecheck/lint/build/db-tests/bundle verdes. El `audit` rojo por `braces` es un problema externo que ya pertenece a T-332.

## Qué queda por hacer

1. Cerrar PR236-H01 en `src/app/providers.tsx`: el navegador real emite `offline/online`, pero la query activa no recibe una transición efectiva que produzca una GET nueva.
2. Agregar `src/app/providers.test.tsx` para la integración global, sin agregar `refetch()`, `invalidateQueries()`, `router.refresh()` ni listeners por hook.
3. Conservar el test determinista de `useRequestOffers` que conduce `onlineManager` directamente: prueba la mitad TanStack → query y debe seguir detectando `refetchOnReconnect: false`.
4. Reproducir las mutaciones RED y ejecutar checks completos.
5. Después del merge de T-333, sincronizar PR #180 y exigir el trusted Preview verde como manda el DoD. No tocar `e2e/specs/notifications.spec.ts`.

## Para el análisis posterior

No se agrega AG nuevo. H01 refuerza `pr-82/AG-77` y `P08-control-no-cubre-lo-que-dice`: un control que entra directamente por `onlineManager.setOnline()` prueba TanStack desde adentro, no la frontera del navegador que falló en producción/E2E.
