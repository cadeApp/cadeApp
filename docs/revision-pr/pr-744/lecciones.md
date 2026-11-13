# Lecciones de la PR #744 para las reglas

**Fuente:** 2 hallazgos por inspección en R1; 1 alto bloqueante, 1 medio de mejora.

## Patrón dominante: P08, un control que mide menos que la funcionalidad

El contrato en SQL está mejor instrumentado que su representación de prueba y que su UI consumidora. La matriz pgTAP y su RED del autor sí abarcan el rechazo de aprobaciones. En cambio, la simulación de subsanación omite la existencia de Storage, y la prueba de UI observa la tarjeta aislada sin comprobar el estado del perfil.

## Refuerzo de lecciones existentes (sin asignar AG nueva)

- **AG-75 — Batería independiente:** la mutación de #745 mide la guarda SQL y es útil; no demuestra que el fake tenga la misma conducta para ausencia de Storage. Añadir una prueba negativa propia que falle en el fake actual y pase después del arreglo.
- **AG-37 — Enumerar clase completa:** para una operación que atraviesa Storage, RPC, fake, server action y UI, recorrer cada etapa y verificar la misma propiedad (objeto existente, no mutación en rechazo, dato actualizado tras éxito). La prueba de la tarjeta sola no basta para el perfil.

No se crea un nuevo AG porque ambos hallazgos refuerzan reglas existentes y no se dispuso del catálogo consolidado de **todas** las ramas remotas para asignar un identificador libre sin colisiones.

## Qué cambiar, en orden de impacto

1. Exigir en tests de fake un par de pruebas sobre Storage: path existente permite crear; path ausente devuelve `NOT_FOUND` sin efectos.
2. Para un cambio de estado en un componente hijo reutilizado, comprobar también el estado visible del consumidor y su invalidación/refresh.
3. Mantener la distinción «CI del autor observado» frente a «mutación propia ejecutada», y «E2E BLOCKED» frente a «E2E PASS».

## Advertencias

La base fue verificada en CI, no por un Docker local de revisión. La batería RED de guardas es del autor y no debe presentarse como reproducción independiente. La mejora H02 tampoco se verificó con navegador y requiere ejecución posterior.
