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


## Ronda 3

- R03: en carrera de SELECT/INSERT un rechazo de RLS (42501) por fila ya creada es distinto de unique violation (23505). Cubrir ambos sin tratar denegación genuina como éxito.
- R04: compatibilidad es orden de despliegue real DB/app, no solo CI del SHA final con ambas capas nuevas.
- H02: scripts de CI multisesión ya existen para T-340/CC-024; no declarar imposible comprobar otra RPC.
- H06: un test que vuelve a escribir el backfill después de migrar no verifica SQL original.


## Ronda 4
- R05, patrón P11: cualquier promesa de compatibilidad app-nueva/DB-vieja debe enumerar explícitamente las columnas y RPC consumidas y probarlas en el esquema previo.
- R04, patrón P05: leer workflows reales de promoción, no aceptar un plan Markdown que los contradiga. migrate.yml ejecuta antes que deploy.yml para staging/main; publicar app y SQL desde un único SHA no constituye una entrega expand/contract.
- H02/H06: los logs ahora sí muestran dos sesiones reales y migración original con mutación RED→GREEN. No negar la evidencia; distinguir SQL cruzado artificial del mutation-test de la definición de RPC.
- R03: simulación de interleaving mediante mocks puede validar rama de código, pero no reemplaza el comportamiento PostgREST/RLS bajo sesiones simultáneas.


## Ronda 5
- R06/P07: LIKE trata '_' en nombre del kind como wildcard. Comparar prefijos literalmente y probar objeto real malnombrado.
- R07/P08: UNIQUE vigente no impide primer INSERT directo sin objeto. Con writer RPC B0 + replace, revocar INSERT authenticated es mejor; decisión humana A explícita.
- R04: gate staging exige desplegar y verificar B antes que C; migraciones corren antes que deploy y un E2E bloqueado no es verde.


## Ronda 6 — 2026-10-17
- R06 / P07: comparación literal de prefijo de Storage evita comodín de LIKE; la prueba de mutación sobre la RPC debe demostrar aceptación indebida real (licenseX...) y restored GREEN, no solo detectar el texto del SQL.
- R07 / P08: al mover INSERT documental exclusivamente a RPCs, las suites RLS antiguas positivas deben volverse negativas 42501 **con conteo cero**, conservando pruebas positivas RPC autenticadas y control de roles.
- R04: no convertir CI efímero/Preview con migración bloqueada en permiso para aplicar C sobre un staging legacy; reservar referencia B-only y comprobar deploy real antes de contracción.


## Ronda 7 — 2026-10-17
- R04 (gate de release): la verificación independiente de `migrate-staging`, checkout de SHA exacto, Vercel alias real y E2E sobre URL de staging es distinta del CI efímero. Registrar **SHA del ambiente realmente desplegado**, no usar SHA del PR de contracción como si fuera el del deploy.
- No inferir ausencia universal de escritores legacy por un `git grep` del código publicado: eso demuestra sólo que la versión actual no los contiene. Los clientes antiguos en caché requieren observabilidad o una política de transición.
- Una ronda que integra develop sin alterar SQL C no exige repetir correcciones ya comprobadas por CI del autor, pero sí contrastar diff final, base, pruebas del HEAD y fuentes del despliegue real.
- SHA inventado completo en comentario debe corregirse por copia del HEAD remoto exacto; la trazabilidad del check depende del hash completo.
