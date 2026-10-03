# Lecciones — PR #233

## Ronda 1 — validar comportamiento efectivo, no solo forma del config

Para un gate de autodiscovery, comprobar que existe `testDir` y un `testIgnore` correcto no garantiza que el proyecto realmente descubra todos los specs esperados. Un filtro adicional válido de Playwright puede estrechar silenciosamente el conjunto y dejar verdes los tests estructurales.

Cuando la propiedad protegida es “todo archivo que cumpla esta clasificación entra automáticamente”, la prueba más fuerte compara el conjunto efectivo descubierto con el conjunto de archivos de entrada, no solo fragmentos del archivo de configuración.

## Ronda 2 — una línea base ejecutable evita enumeraciones que vuelven a quedar viejas

La reparación de H01 no agregó una lista paralela de specs al test. Construye una línea base sin filtros usando el propio Playwright y la compara contra la configuración real. Así el control cambia automáticamente cuando aparece un spec nuevo y, al mismo tiempo, falla si un filtro futuro recorta el conjunto.

La mutación independiente de Ronda 2 confirmó la propiedad: la app/unit siguió verde, pero el guard específico quedó RED exactamente por los archivos omitidos.
