# Lecciones — PR #358 / T-356

**Fuente:** 2 bloqueantes de arquitectura detectados **antes de implementación** (solo lectura estática del contrato anterior). No se reportan regresiones reales ni pruebas RED→GREEN funcionales; no se añaden lecciones AG numeradas sin contraste con las ramas remotas.

## Patrón observado
Una Server Action puede bloquear una operación en la UI, pero **no** protege una tabla cuya RLS permite la misma operación por API directa. En datos versionados, permitir inserts sin una identidad SQL de «vigente» hace que las consultas de distintas superficies puedan interpretar versiones distintas.

## Acciones para el CC #363
1. Modelar vigencia única y bypass por INSERT/UPDATE en el contrato y sus pruebas DB, sin romper el alta inicial.
2. Crear motivo de rechazo público controlado separado de auditoría privada.
3. Diseñar ciclo Storage -> DB -> retención/purga con idempotencia y errores de red, además de consulta admin/courier coherente.
4. En la próxima ronda, exigir mutaciones independientes del revisor, no reutilizar exclusivamente las del autor.

**Advertencia:** esta PR es inusual porque el diff es únicamente la bitácora; los hallazgos califican una propuesta y su dependencia de CC, no código defectuoso introducido.