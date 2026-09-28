# PR #119 — T-117

- **Tarea:** T-117 — Mapa de recorrido y botón "Abrir en Google Maps" en vista de viaje
- **PR:** #119
- **Rama:** `feat/T-117-mapa-recorrido`
- **Autor:** asako669 (P2)
- **Ronda actual:** 1
- **SHA revisado:** `28707af32610eb215ccc305086773aee8029de32`
- **Base observada al revisar:** `develop` avanzó a `c5d2612d211469468ec1ee465939c4b46fa9a6ba`; la rama estaba 1 commit por detrás y 1 por delante, sin conflicto reportado por GitHub.
- **Resultado:** CON BLOQUEANTES (4)

## Resumen

La fase roja existe y CI reproduce 9 fallos de 11 pruebas, pero la batería todavía permite implementaciones que violan el DoD y quedarían verdes. Los cuatro bloqueantes son de cobertura/instrumentación:

1. el control del feed no cubre toda la superficie que afirma y falla abierto si falta un archivo;
2. no prueba "exactamente dos pines unidos por una traza";
3. no prueba que mapa/navegación sigan disponibles en `in_transit`;
4. captura `APIProvider.onError` pero nunca lo dispara.

No hubo decisiones 🔵 para Lautaro073 en esta ronda.
