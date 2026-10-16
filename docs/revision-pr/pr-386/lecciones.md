# Lecciones — PR #386 / T-363

## Patrones

- **H01 (P01, AG-37):** recorrer toda la clase de tamaños y plataformas, no un ejemplo: un enlace funciona con una o dos entregas pero incumple el límite documentado de 3 waypoints en navegadores móviles cuando se agregan 5. Además hay límite de 2048 caracteres; las direcciones libres pueden excederlo por percent-encoding.
- **H02 (P08):** un test que cuenta pines solo prueba que están en el árbol; no prueba que se vean dentro del viewport. Extremos válidos de bbox, cámaras y zoom deben ser parte del caso positivo.
- **D01:** documentar explícitamente excepción de privacidad para navegación externa post-match autorizada en D15 sin extenderla a URLs internas, analítica, logs o prematch.
- **AG-92:** el job `bundle-budget` puede informar >180 kB con resultado verde; leer métricas, no asumir cumplimiento.

## Propuesta de futuras reglas

Para enlaces de navegación multi-stop: cubrir límites por plataforma, orden de paradas, continuidad de tramos, longitud de URL y fallback si el enlace no cabe. Para mapas: probar ajuste de cámara real, no solo presencia del DOM.

No se adjudican IDs AG nuevos sin barrer **todas** las ramas remotas. Esta ronda no tuvo clone para mutaciones independientes; no inventar `verificado-runtime`. H02 es una deuda preexistente expuesta ahora por el DoD.
