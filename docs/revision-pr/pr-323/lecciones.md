# Lecciones de PR #323

Dos puntos sin nueva regla AG automática:

- La corrección estructural de una ruta puede tener aserciones unitarias GREEN y seguir sin certificar un DoD de **rendimiento medido y E2E**; no confundir ambas evidencias.
- En Next.js App Router puede haber varias solicitudes RSC. Contar los requests y correlacionar sus tiempos antes de prometer «exactamente una cadena menos» o «1427 ms ahorrados».
- El checkpoint y la revisión de #320 son independientes de T-352; el orden real se resolvió mergeando #320 primero, y luego validando #323 con los seeds corregidos.

No se agregan reglas a AGENTS.md a partir de una sola PR sin comprobar recurrencias.

## Ronda 3: dependencia circular en checkpoints

Separar el gate de las dos PR originales del experimento de compatibilidad: una PR temporal de integración con blobs exactos prueba el acoplamiento entre fixtures de #320 y redirect de #323 **sin aceptar que la evidencia de una reemplace la revisión independiente de la otra**. La evidencia de un Preview no se reduce al estado del workflow: validar SHA objetivo, cobertura, flakiness, global-settings y efectos en Develop. Un E2E cancelado en la suite general no valida un DoD, aunque los tests específicos hayan pasado.

## Ronda 4

Un fixture nuevo coherente no prueba que un entorno Develop compartido esté libre de filas publicadas antiguas sin drops. Como `getAvailableRequests()` falla cerrado al leer una fila inconsistente, una sola fila puede romper muchas pruebas no relacionadas con su creador. Diagnosticar por error SSR y consistencia de datos antes de suponer el origen, no degradar fail-closed ni subir timeouts. Medir el cambio de `redirectTo` separadamente del gate E2E general.

## Ronda 5 — cierre de dependencia y validez de evidencia

No hay causalidad automática entre un E2E que deja de ser flaky y el cambio de una redirección: `global-settings` DoD 2 pasó con #320 sin T-352 y después con #323. La mejora demostrada por T-352 es una navegación intermedia menos en trazas reales. El flujo de integración técnicamente sólido fue reparar y mergear los fixtures primero, luego incorporar Develop a la PR de aplicación por merge normal y ejecutar el gate real en esa PR. Una PR temporal RED permitió aislar fallas sin convertirse en código mergeado.

Importante: el `head_sha` del evento `repository_dispatch` pertenece a Develop; la verificación del código efectivamente probado requiere el checkout de los jobs y el status E2E asociado al SHA de la PR.
