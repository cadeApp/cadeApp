# Lecciones de PR #323

Dos puntos sin nueva regla AG automática:

- La corrección estructural de una ruta puede tener aserciones unitarias GREEN y seguir sin certificar un DoD de **rendimiento medido y E2E**; no confundir ambas evidencias.
- En Next.js App Router puede haber varias solicitudes RSC. Contar los requests y correlacionar sus tiempos antes de prometer «exactamente una cadena menos» o «1427 ms ahorrados».
- El checkpoint de la PR #320 exige una verificación independiente separada después del merge de T-352.

No se agregan reglas a AGENTS.md a partir de una sola PR sin comprobar recurrencias.

## Ronda 3: dependencia circular en checkpoints

Separar el gate de las dos PR originales del experimento de compatibilidad: una PR temporal de integración con blobs exactos prueba el acoplamiento entre fixtures de #320 y redirect de #323 **sin aceptar que la evidencia de una reemplace la revisión independiente de la otra**. La evidencia de un Preview no se reduce al estado del workflow: validar SHA objetivo, cobertura, flakiness, global-settings y efectos en Develop. Un E2E cancelado en la suite general no valida un DoD, aunque los tests específicos hayan pasado.
