# PR #236 — T-333 · Cerrar carreras de Realtime y reconexión real en ofertas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/236 |
| **Tarea** | T-333 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-333-realtime-reconnect` → `develop` |
| **Base revisada** | `bc6329d941a510cc37d23827f5e3798e3839c065` |
| **HEAD revisado** | `7a0247af065864f3906887f54160542e977d04aa` |
| **Estado** | **BLOQUEADA — PR236-H01 parcial** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `371848d3ae7d25a2aaec1608f8ad16a64ef5afb7` | 1 bloqueante | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `7a0247af065864f3906887f54160542e977d04aa` | 1 bloqueante residual + 1 mejora | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR236-H01 | El control de reconnect todavía no demuestra la misma secuencia que falló en navegador real | alto | parcial |
| PR236-H02 | El cuerpo del PR contradice el HEAD actual | bajo | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Ronda 2 — qué quedó verificado

- El autor respetó el alcance pedido por R1: desde `47bd862` solo cambió `src/app/providers.tsx`, agregó `src/app/providers.test.tsx` y actualizó la bitácora.
- No tocó `docs/revision-pr/**`, `e2e/specs/notifications.spec.ts` ni los dos tests existentes protegidos.
- El nuevo HEAD está al día con `develop`, es mergeable y mantiene el catch-up de `SUBSCRIBED`.
- CI exact-head `7a0247af065864f3906887f54160542e977d04aa`: unit **115/115 archivos, 1744/1744 tests**, typecheck/lint/build/db-tests/bundle verdes.
- `src/app/providers.test.tsx` pasa en CI; `use-request-offers.test.tsx` 14/14 y `use-realtime-invalidation.test.tsx` 12/12.
- Preview E2E exact-head: 20/20 chromium + 3/3 global-settings.
- El único job rojo continúa siendo `audit` por `braces`, fuera de T-333 y ya canalizado por T-332.

## Por qué H01 sigue abierto

La implementación nueva instala un `onlineManager.setEventListener` explícito y sincroniza el estado inicial con `navigator.onLine`.

El problema es que TanStack Query v5 ya instala por defecto listeners de `window.online` / `window.offline`, y `QueryClientProvider` monta el `QueryClient` para escuchar esos eventos. Por lo tanto, para una página que **ya arrancó online**, el mapping `offline → false` / `online → true` del bridge nuevo duplica el comportamiento normal del framework.

La diferencia real introducida por #236 es la sincronización inicial de `navigator.onLine` al montar.

El trusted E2E que originó T-333 no arrancaba offline: cargó la página online, completó una GET 200, luego hizo `online → offline → online` y no obtuvo una segunda GET. El test nuevo comienza con `navigator.onLine = false`; su RED sin bridge se satisface por esa condición inicial y no demuestra que el listener personalizado sea necesario para la secuencia que falló.

Un contraejemplo importante: una implementación que solo ejecute `onlineManager.setOnline(navigator.onLine !== false)` al montar y deje los listeners online/offline por defecto de TanStack debería satisfacer el test actual completo. Esa mutación todavía no fue ejecutada.

## Próximo control obligatorio

1. Mutación de discriminación: reemplazar temporalmente el bridge por **solo** la sincronización inicial. Si `providers.test.tsx` sigue GREEN, el test no prueba la necesidad del bridge.
2. Agregar/ajustar un control de composición que replique la secuencia real:
   - empieza online;
   - hay query activa y fetch inicial terminado;
   - fija baseline;
   - navegador pasa offline;
   - navegador vuelve online;
   - exige una llamada adicional al queryFn.
3. Ejecutar ese control también sobre el padre de R1 (`47bd862`, agregando solo el import de React si el entorno lo necesita). Si ya era GREEN antes del bridge, no fabricar RED: documentar que navegador → TanStack no es la causa y continuar el diagnóstico.
4. No tocar el E2E externo ni agregar refetch manual.
5. PR #180 sigue siendo el control de navegador real post-merge, pero su contador puede quedar contaminado por el catch-up de `SUBSCRIBED`; por eso no reemplaza este control discriminante.

## Para el análisis posterior

No se agrega AG nuevo. H01 sigue reforzando `P08-control-no-cubre-lo-que-dice` y `pr-82/AG-77`: una prueba puede ejercer eventos correctos y aun así fallar por una precondición distinta de la propiedad que pretende demostrar.

R2 también corrige una sobreprescripción de la propia revisión: R1 ordenó un bridge global antes de demostrar que el listener por defecto de TanStack era insuficiente.
