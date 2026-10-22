# Lecciones — PR #489, ronda 1

- **Documentación también falla CI.** La comparación **literal** del primer DoD contra la sexta celda de `docs/implementation-plan.md` atrapó 8 errores al mismo tiempo (H01). No reescribir la prueba: enseñar al agente el contrato exacto.
- **Un mockup no es el esquema.** T-403 llama «Enviado» a `created_at`, T-404 narra eventos inexistentes y T-406 renombra `closed` como `resolved` aunque incluye `dismissed`. Cada texto de UI necesita una fuente definida y su semántica (H03/H04/H06).
- **Diseños postlanzamiento deben dejar dependencias CC explícitas.** Las decisiones de producto C se registraron en issues #498 y #499; están separadas de esta PR solo documental (H02/H03).
- **El botón «Ver todo» también es contrato de consulta.** Un destino de enlace filtrado requiere parámetros, parser, validación y filtros en query, no solo `href` (H05).
- **Los E2E prescritos deben caber en «Archivos permitidos».** T-402 y T-403 documentaban pruebas nuevas pero no sus specs (H09).
- **Reutilizar antes de reimplementar.** El visor A02 ya cuenta con zoom/rotación/pestañas y debe mantenerse, no duplicarse (H11).
- **No crear número AG sin enumerar todas las ramas remotas.** En esta sesión sin clon remoto utilizable no se certificó un máximo AG global; por eso las lecciones quedan narradas sin nuevo identificador, evitando colisiones. Pueden numerarse en una siguiente revisión con `git fetch origin`.
