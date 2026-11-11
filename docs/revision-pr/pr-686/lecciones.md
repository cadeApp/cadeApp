# Lecciones — PR #686

## Patrón dominante

Un contrato puede expresar correctamente la restricción nominal (RLS con `status='draft'`) y, a la vez, prometer más de lo que sus mecanismos y pruebas demuestran. Distinguir «fila actualizada» de «sentencia sin excepción» y contemplar la concurrencia de lecturas RLS sobre una tabla distinta.

## Reutilización de lecciones existentes

- **pr-68/AG-74:** condición de carrera: una comprobación no sustituye a un mecanismo que coordine los locks y el momento de la escritura. Aplicación H01: guarda de `status='draft'` en contactos legacy debe compartir lock del padre con `publish_request`.
- **pr-56/AG-37:** enumerar toda la clase, no solo un caso. Aplicación H01: cubrir INSERT y UPDATE sobre `draft`, `published` y `matched` y dos órdenes de adquisición.
- **P08-control-no-cubre-lo-que-dice:** H02, `lives_ok` no garantiza modificación real. El test de éxito debe cambiar valor y comprobar número de filas y timestamp.

No se asigna un número AG nuevo: no se verificó el máximo de todas las ramas remotas y estos patrones ya están descritos. No se recomienda modificar `AGENTS.md` por una sola PR documental.

## Para la siguiente ronda

1. Releer desde el nuevo head el CC, ficha y su diff mecánico.
2. Exigir que el nuevo alcance de pruebas concurrentes esté en `Impacto exacto`, DoD y «Archivos permitidos», sin tocar scripts CI salvo autorización.
3. En la implementación, revisar log del job db-tests del SHA exacto y corroborar RED→GREEN sin fabricar mocks ni modificar expectations.

