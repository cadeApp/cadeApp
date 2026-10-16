# Lecciones — PR #386 / T-363

## Patrones

- **H01 (P01, AG-37):** recorrer toda la clase de tamaños y plataformas, no un ejemplo: un enlace funciona con una o dos entregas pero incumple el límite documentado de 3 waypoints en navegadores móviles cuando se agregan 5. Además hay límite de 2048 caracteres; las direcciones libres pueden excederlo por percent-encoding.
- **H02 (P08):** un test que cuenta pines solo prueba que están en el árbol; no prueba que se vean dentro del viewport. Extremos válidos de bbox, cámaras y zoom deben ser parte del caso positivo.
- **D01:** documentar explícitamente excepción de privacidad para navegación externa post-match autorizada en D15 sin extenderla a URLs internas, analítica, logs o prematch.
- **AG-92:** el job `bundle-budget` puede informar >180 kB con resultado verde; leer métricas, no asumir cumplimiento.

## Propuesta de futuras reglas

Para enlaces de navegación multi-stop: cubrir límites por plataforma, orden de paradas, continuidad de tramos, longitud de URL y fallback si el enlace no cabe. Para mapas: probar ajuste de cámara real, no solo presencia del DOM.

No se adjudican IDs AG nuevos sin barrer **todas** las ramas remotas. Esta ronda no tuvo clone para mutaciones independientes; no inventar `verificado-runtime`. H02 es una deuda preexistente expuesta ahora por el DoD.

## Ronda 2 — evidencia de corrección y gate no atribuible

- El arreglo de H01 preserva continuidad mediante reuso del último stop y un tramo manual cuando no cabe ni el par: se verificó a través de nueve mutaciones propias que **no** son M1–M11 del autor. El test positivo de secuencia evita que aprobar solo «menos de 3 waypoints» permita borrar paradas.
- H02 ahora utiliza `fitBounds` y margen; no confundir el E2E que intercepta la llamada con una imagen de un mapa real. Confirmación de efecto en mock más contrato del SDK, con limitación expresa.
- El `build` puede fallar en `next/font` aunque TypeScript, unit, DB y E2E estén verdes. No cambiar CSS, config o package por intuición; demostrar recurrencia y causa. El check build fallido es gate de integración, no prueba de defecto de T-363.
- No se añade número AG sin conocer máximo de TODAS las ramas remotas; los patrones P01 y P08 ya catalogados bastan para esta ronda.

## Ronda 3 — lecciones operativas

- **El SHA comprobado importa más que el estado del workflow.** El E2E `repository_dispatch` anuncia `head_sha` de otra rama, pero el job de Playwright hizo checkout de `ddae874` y aprobó 81+3. Para trazabilidad, inspeccionar el log del job y el SHA real, no inferir de la cabecera.
- **La prueba verde no elimina una dependencia de integración.** #385 permanece abierta y `develop` avanzó. Un `mergeable=true` de GitHub no reemplaza la verificación de `merge-tree` y el E2E exacto tras integrar.
- **No perseguir un fallo transitorio de fuente sin evidencia de causalidad.** `next/font` falló en un commit previo sin cambios de layout; compiló en el siguiente y nuevamente en `ddae874`. No hay evidencia para introducir cambios de dependencias o builds solo por ese incidente.
- **No reciclar el `verificado_en_sha` como el último HEAD por conveniencia.** No hubo cambio de código: se conserva el SHA de la batería independiente de R2, mientras CI y E2E del HEAD documental quedan como evidencia nueva.
- **No se crea una nueva regla AG**: no se detectó un nuevo defecto de código ni se estableció un patrón transversal nuevo.
