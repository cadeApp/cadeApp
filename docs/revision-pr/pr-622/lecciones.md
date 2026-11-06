# Lecciones — PR #622 (T-422)

Fuente: dos mejoras documentadas en [hallazgos.jsonl](hallazgos.jsonl); ningún defecto de implementación bloqueante del hotfix.

## P08 — Control con cuantificador universal y conjunto cerrado (PR622-H01)

Un test que se titula `every job` pero recorre tres pares fijos no es a prueba de incorporación de jobs: la mutación `phantom-e2e` demuestra GREEN falso. **Reutilizar la lección AG-37 (enumerar la clase entera)**, sin asignar un AG nuevo por una sola instancia.

> Regla operativa propuesta para tests de workflows: si se promete un invariante sobre **todos** los jobs que cumplen una condición, descubrir los jobs desde los archivos y su contenido real; no listar solo los que existían al escribir el test. Probar agregando un nuevo job que viola el invariante: el test debe dar RED.

El cambio de test queda para el seguimiento [#623](https://github.com/cadeApp/cadeApp/issues/623) al ampliar Playwright. No es razón para retrasar la restauración de los tres jobs actuales.

## P03 — Documentación de alcance contradictoria (PR622-H02)

En la misma ficha conviven «Archivos permitidos» ampliados y «Fuera de alcance» sin actualizar. La autorización explícita del hotfix resuelve la decisión operativa, **no** la contradicción editorial. En la próxima edición de la ficha, armonizar ambas secciones en un solo cambio.

## Decisión técnica reusable

- Hotfix A: pin `ubuntu-24.04` en instalaciones Playwright 1.55.1; evita sustituir CI por un parche de pruebas.
- Evolución B: actualizar Playwright con validación real sobre 26.04 y retirar el pin; seguimiento #623.
- Evitar C: `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` para usar builds de un SO distinto, salvo experimento aislado expresamente autorizado.

Sin propuesta de modificación inmediata de `AGENTS.md`: hay antecedente directo en AG-37 y se debe acumular evidencia transversal antes de agregar reglas.
