# Lecciones de PR #455 — T-385

**Fuente:** PR455-H01 y PR455-H02, ambos por inspección, no ejecutados independientemente.

## Patrón dominante

La RPC implementa aparentemente las transiciones del contrato, pero las pruebas protegen solo el estado normal (`available=false`) y los efectos visibles (respuesta y auditoría), no todos los invariantes literales. Esto deja espacio a divergencias entre fake y base, y a regresiones silenciosas del caso idempotente.

## Regla propuesta para próximas revisiones

- Para contratos que dicen **«no modificar X»**, sembrar explícitamente un X distinto del habitual antes de invocar la operación y comprobar que continúa igual.
- Para **«sin UPDATE»**, no conformarse con comparación de valores y recuento de auditoría: usar un oráculo de versión física de fila (`ctid` en PostgreSQL dentro de una transacción controlada) o un mecanismo independiente equivalente. Mutar introduciendo un UPDATE inocuo y verificar que la misma aserción cae RED.
- Hacer RED independiente antes de considerar un defecto reproducido; registrar `analisis` cuando la ejecución esté impedida.

No se asignó nuevo número AG sin poder contrastar el máximo en **todas** las ramas remotas. P05 y P08 ya están catalogados; no se proponen cambios inmediatos a `AGENTS.md` por esta sola ronda.

## Cierre de ronda 2

- **H01:** quedó la prueba con `rejected + available:true`, detectando la asignación indebida; el fake conserva el valor recibido. CI GREEN 8/8 del archivo. La evidencia RED puntual procede de la bitácora y no se presenta como reproducción propia.
- **H02:** la PR #456 aislada demostró en CI una diferencia `ctid` de `(0,74)` a `(0,75)` y dejó la aserción 38 en RED; en la rama real, la misma pgTAP está GREEN. La mutación no contaminó la PR principal.
- El commit de bitácora posterior al código es exclusivamente documental; la verificación relevante es el SHA de código.
- No se abre nueva lección AG ni se modifica `AGENTS.md`; basta conservar los patrones P05 y P08 y la evidencia.
