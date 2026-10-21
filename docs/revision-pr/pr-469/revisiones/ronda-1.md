# Ronda 1 — PR #469 / CI-468

**Fecha:** 2026-10-20 (Argentina; 2026-10-21 UTC)  
**Revisión independiente:** asistente, distinto del autor del parche.  
**HEAD funcional verificado por inspección y mutaciones en memoria:** `c2a833dec6bcfe6bdd741cee3352886b67b42ce4`  
**Base:** `127a900bf489dabf319a4f02046c959689487774`  
**Estado:** SIN BLOQUEANTES **de código**, **no lista para merge** mientras los gates exigidos no estén verdes.

## Alcance

La incidencia https://github.com/cadeApp/cadeApp/issues/468 autoriza el cambio acotado en `.github/workflows/ci.yml` y `.github/workflows/verify-workflows.test.mjs`. La PR contiene exactamente esos dos archivos, sin cambios en pasos de `db-tests`, aserciones previas, bases, RLS, tipos ni dependencias.

`CI-468` es un incidente operacional y no tiene ficha T-xxx en develop; como ya se hizo para SEC-466 / PR #467, el alias `T-468` se usa **solo** por el parser actual de approval-policy, sin inventar una ficha. Se recomienda ajustar el parser en una tarea de proceso separada en vez de simular que existe T-468.

## Verificaciones de revisión

- Comparación `develop...c2a833d`: un commit, rama por delante 1/detrás 0; GitHub informa `mergeable: true`. Sin conflicto informado en esta captura; no se ejecutó `git merge-tree` local.
- Lectura de `job()` en `verify-workflows.test.mjs`: extrae exclusivamente el bloque de `db-tests`; la nueva expresión exige `timeout-minutes: 20` a nivel de job.
- Control independiente en memoria con el `ci.yml` real de ambos commits: **HEAD verde; develop rojo**. Mutaciones adicionales M01=10, M02=30, M03=sin límite, M04=20 en otro job solamente, M05=comentario 20: **5/5 rojas**. Se utilizó una réplica exacta de `job()` y la expresión del test existente, sin modificar ramas; la batería no fue creada por el autor.
- CI `unit` del SHA `c2a833d`, run `39525533747`: `verify-workflows.test.mjs` **80 tests / 80 passed / 0 failed**. También `typecheck`, `lint`, `build` y `bundle-budget` pasaron en ese run.
- No se ejecutaron `pnpm`, Docker, Supabase ni E2E localmente. No se atribuyen a revisión propia las 80 ejecuciones del runner oficial. `db-tests` y `e2e-preview` pendientes cuando se consultaron.
- Logs históricos de las ejecuciones asociadas a #464/#467 muestran pgTAP y comparación de tipos completos en verde antes del corte y repeticiones de `toomanyrequests: Data limit exceeded`: ampliar timeout reduce falsos negativos por duración pero no cura el límite de descargas.
- `audit` del run actual falló con `Severity: 5 moderate | 2 high (1 ignored)`, incluyendo `launch-editor`; el issue #466 y la PR #467 se ocupan de la vulnerabilidad de Vite. No la introduce CI-468, pero no corresponde declarar CI global verde.

## Hallazgos

**BLOQUEANTES:** ninguno demostrado en el diff.  
**MEJORAS no bloqueantes:** tratar por separado la causa raíz de rate limits del registry; no ampliar este PR de timeout.  
**DECISIONES:** ninguna nueva; el alcance está delimitado por el issue #468. La excepción documental `CI-468` sigue precedente de SEC-466 y no se presenta como ficha existente.

## Comprobaciones y límites

- No se corrió localmente `git merge-tree`, `pnpm test`, `pnpm lint`, ni el arnés de comandos desde un clon git; se consultó el diff/árbol publicado y se hicieron controles equivalentes en memoria contra el contenido de GitHub. No se afirma haber ejecutado la batería completa in situ.
- No se ejecutó directamente la suite sobre develop; su RED se infirió reproduciendo el mismo oráculo contra el archivo real obtenido de develop.
- La falta de `approval-policy` en la lista de CI es distinta a un check verde; se actualiza el cuerpo de la PR con este informe.
- No aprobar ni mergear hasta que se verifiquen los gates efectivos del HEAD final.

**Evidencia y comandos:** [evidencia/comandos.md](../evidencia/comandos.md).
