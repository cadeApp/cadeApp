# Lecciones — PR #364 / CC-025

**7 hallazgos por inspección; no verificados aún mediante ejecución de SQL sobre escenarios fallidos.** No crear números `AG-xx` a partir solo de develop: los rangos se solapan entre ramas; consultar máximo de todas las ramas remotas antes de proponer una nueva regla.

## Patrones que se repiten
- **P08 control no cubre lo que dice**, relacionado con **pr-64/AG-62** y **pr-68/AG-75**: una suite pgTAP secuencial y un índice único no prueban dos conexiones ni ausencias de deadlock.
- **P17 campos de privilegio** y **pr-56/AG-32, AG-33, AG-37**: al introducir campos de estado/vigencia en una tabla con policy `FOR ALL`, enumerar operaciones y actores, no solo INSERT del courier. No confundir política `WITH CHECK` con congelamiento de valores.
- **pr-63/AG-66 y AG-68**: una afirmación documental de privacidad o de idempotencia necesita un control sensible a su mutación, no un título con la palabra "garantiza".
- **Compatibilidad y retención**: el backfill debe iniciar plazos desde el evento que causa obsolescencia, no un timestamp de subida que no registra ese evento. Un índice único también cambia la semántica de los escritores anteriores con reintentos.

## Recomendación de proceso
La próxima ronda debe comprobar los RED auténticos en mutaciones del **código** con mismos tests/fixtures, no aceptar solo la declaración del agente. Especial atención a H01 (bucket vacío), H02 (orden de locks) y H05 (UPSERT repetido). No confundir resultado GREEN de 2231 pgTAP previos con verificación de una propiedad que ninguno ejercita.

**Advertencia:** la PR está diverged de develop; antes de atribuir fallos al CC, cotejar versión efectiva de las políticas tras el merge de develop.

## Lecciones tras ronda 2

- R01: revisar TODOS los escritores al revocar permisos SQL; PostgREST UPSERT requiere UPDATE incluso cuando no hay conflicto. El mock del writer puede ocultar un fallo que el SQL real garantiza (pr-56/AG-37).
- R02: una política INSERT debe congelar campos nuevos reservados a RPC, además de proteger UPDATE (pr-56/AG-38 y AG-33).
- H06: copiar manualmente el SQL de producción en un test no demuestra que la migración original funcione; usar prefixture + ejecución real del artefacto (pr-63/AG-68).
- H02: una transacción pgTAP no prueba ausencia de deadlock multisesión (pr-64/AG-62).

Sin asignar AG nueva sin examinar ramas remotas, donde existe numeración duplicada.
