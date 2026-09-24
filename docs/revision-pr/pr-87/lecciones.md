# Lecciones de la PR #87 para AGENTS.md y las reglas

**Fuente:** 12 hallazgos abiertos de la ronda 1.

## Patrón dominante

Se repite el patrón de control que mide un proxy barato del invariante: se revisa un page.tsx aunque la UI prohibida vive en la hoja que renderiza, y se prueba un rol/destino sin enumerar la clase completa. En paralelo, la integración visual se cerró sin comprobar estados reales de datos ni adjuntar la evidencia de browser que la ficha exige.

## Lecciones propuestas

No se agrega número AG nuevo. Ya aplican:
- AG-37: enumerar la clase completa.
- AG-58 / AG-61: el control estático debe estar anclado a la unidad real y demostrar rojo por mutación.
- AG-36: evidencia solo sobre SHA publicado.
- AG-60: desconfiar de una batería verde si el control no toca la propiedad.

## Qué cambiar, en orden de impacto

1. Endurecer route-integrity para seguir destinos reales y hojas renderizadas.
2. Automatizar piso tipográfico/touch targets y loading/error boundaries en tareas visuales.
3. Exigir links de capturas antes de permitir cerrar el DoD visual.
4. Mantener cuerpo de PR en plantilla y bitácora atada a SHAs remotos.

## Advertencias

- H02/H03/H04 son defectos de producto, no solo huecos de test.
- H08 requiere contract-change; no debe ampliar T-118 hacia src/ui informalmente.
- CI no se abrió en esta ronda porque ya había bloqueantes.
