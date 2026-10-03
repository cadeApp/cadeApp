# Lecciones — PR #233

## Ronda 1 — validar comportamiento efectivo, no solo forma del config

Para un gate de autodiscovery, comprobar que existe `testDir` y un `testIgnore` correcto no garantiza que el proyecto realmente descubra todos los specs esperados. Un filtro adicional válido de Playwright puede estrechar silenciosamente el conjunto y dejar verdes los tests estructurales.

Cuando la propiedad protegida es “todo archivo que cumpla esta clasificación entra automáticamente”, la prueba más fuerte compara el conjunto efectivo descubierto con el conjunto de archivos de entrada, no solo fragmentos del archivo de configuración.
