# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **HEAD al reabrir** | `5847daf744f5bc6168af11365b6731520f4c4c5c` |
| **Estado** | **Ronda 4 · BLOQUEANTE MANUAL REABIERTO (1)** |

## Estado

- PR248-H01 → arreglado-verificado
- PR248-H02 → arreglado-verificado
- PR248-H03 → arreglado-verificado
- PR248-H04 → **reabierto / bloqueante**

## Motivo de reapertura

Después del cierre técnico, Lautaro073 reprodujo personalmente el flujo en navegador:

1. login courier exitoso → `/courier/feed`;
2. misma validación abre una URL inexistente;
3. aparece el 404;
4. «Ir al inicio» apunta a `/login`;
5. al activarlo, la URL final queda en `/login`, no vuelve a `/courier/feed`.

El caso anónimo sí termina correctamente en `/login`.

La lógica pura de `evaluateRouteGuard('/login', courierSession)` es correcta; por eso el problema está en la frontera navegador → gateway/middleware o en la persistencia/reconocimiento de sesión, no en el destino calculado por el guard.

## Hipótesis a confirmar

`NotFoundView` y `ErrorView` usan `next/link` hacia `/login`. El usuario ya visitó `/login` antes de autenticarse. Una posible causa es que la navegación cliente reutilice estado/cache del login anónimo y no fuerce el round-trip de middleware que resuelve la sesión.

Esto **no se da por probado** hasta observar:
- cookies antes/después del 404;
- si el click hace request al servidor;
- qué pasa con una navegación/reload de documento a `/login`.

## Resultado

No mergear hasta cerrar PR248-H04 con una prueba browser-level reproducible.
