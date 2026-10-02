# Ronda 1 — PR #181 / CC-015

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `da5f02c0238271c7e41b6e0aba9671bdda098189`  
**Resultado:** **CON BLOQUEANTES (6)**

## Preflight

- Rama: `cc/CC-015-admin-cancel-requires-incident`.
- develop actual: `298a365184adfe95ac33b3549302695af6b61f91`.
- merge-base: `1457072a7cac1ae9e2a8a92abe9253d45b745082`.
- La rama está **32 commits detrás** de develop.
- GitHub no muestra comentarios, reviews ni threads previos.
- Diff funcional: 8 archivos.
- El autor no tocó `docs/revision-pr/pr-181/**`.
- CI no consultado porque la ronda ya tiene bloqueantes.

## H01 · La rama está 32 commits detrás de develop · BLOQUEANTE

La PR fue creada desde `1457072a7cac1ae9e2a8a92abe9253d45b745082`, mientras develop ya está en `298a365184adfe95ac33b3549302695af6b61f91`.

Aunque los 32 commits nuevos no pisan directamente los archivos funcionales de CC-015 según el compare actual, una revisión final de un contract-change compartido no puede cerrarse sobre una rama desactualizada: el SHA revisado no contiene el estado actual de develop y los checks posteriores podrían cambiar al integrarlo.

**Corrección:** mergear `origin/develop` en la rama, sin rebase ni force-push, resolver cualquier conflicto preservando la semántica de CC-015 y volver a ejecutar todas las pruebas.

## H02 · Se modifican migraciones históricas; staging/producción ya migrados no recibirían CC-015 · BLOQUEANTE CRÍTICO

La PR agrega el gate de incidente a:

- `supabase/migrations/20260924010124_rpc_requests_v1.sql:131`
- `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:801`

Eso hace que una base creada desde cero vea el cambio, pero un entorno que ya aplicó esas versiones **no vuelve a ejecutar migraciones antiguas modificadas**. Por lo tanto, el cambio podría quedar verde en db-tests desde cero y no existir en staging.

El propio contrato refuerza el error en `docs/contracts/CC-015.md:51`, donde declara “actualización” de una migración ya existente.

**Corrección:**

1. restaurar ambas migraciones históricas exactamente a `origin/develop`;
2. crear una **migración nueva de CC-015** posterior a todas las existentes;
3. en esa migración hacer `CREATE OR REPLACE FUNCTION app_private.request_cycle(...)` usando la definición vigente de develop (la versión endurecida por CC-007) y agregar únicamente el gate de incidente en la precedencia aprobada;
4. mantener `SECURITY DEFINER`, `SET search_path = public, pg_temp`, firma, grants/revokes y toda la lógica vigente;
5. hacer que pgTAP demuestre el comportamiento con la migración nueva aplicada al final.

## H03 · El contract-change no tiene issue y referencia la tarea equivocada · BLOQUEANTE

`docs/contracts/CC-015.md:3` usa `#181` como “Issue / PR”, pero #181 es la PR. No existe un issue abierto de CC-015 con label `contract-change`.

Además, `docs/contracts/CC-015.md:5` dice:

`T-304 (#153, PR #179)`

pero T-304 es el **issue #36**. El issue #153 pertenece a T-319.

La skill `contract-change` exige un issue con label `contract-change` y marcar las tareas afectadas como bloqueadas. En este momento #36 sigue con label `en-curso`.

**Corrección humana obligatoria:** crear el issue de CC-015 con label `contract-change`, y en #36 reemplazar `en-curso` por `bloqueada`. Después, actualizar contrato y PR con el número real.

## H04 · El contrato contradice el código de error real para courier · BLOQUEANTE

`docs/contracts/CC-015.md:42` afirma que tanto merchant como courier al intentar cancelar `in_transit` siguen rechazados con `INVALID_STATE_TRANSITION`.

Pero el contrato canónico de `cancel_request` rechaza al courier en el chequeo de rol, por lo que devuelve `UNAUTHORIZED_ACTOR`. La propia prueba pgTAP ya lo reconoce en `supabase/tests/rpc_requests.sql:482`.

**Corrección:** documentar exactamente:

- merchant dueño sobre `in_transit` → `INVALID_STATE_TRANSITION`;
- courier sobre `cancel_request` → `UNAUTHORIZED_ACTOR`;
- admin solo puede continuar si estado, AAL2, motivo e incidente son válidos.

No cambiar el código para hacerlo coincidir con la prosa equivocada.

## H05 · No hay evidencia RED reproducible para los tests nuevos · BLOQUEANTE

La regla de testing exige demostrar que toda prueba nueva puede fallar al romper la regla.

El primer commit de CC-015 (`84cda507...`) ya incorpora implementación y tests juntos. El cuerpo del PR no registra:

- un SHA/fase RED;
- comando ejecutado;
- test exacto que cayó;
- salida;
- mutación concreta;
- reversión.

Los commits posteriores corrigen tests/migraciones, pero tampoco documentan una batería de mutación RED → GREEN.

**Corrección:** tras sincronizar la rama y restaurar las migraciones históricas, demostrar RED de forma reproducible:

- sin la nueva migración CC-015, los pgTAP “admin sin incidente” deben fallar contra el comportamiento anterior;
- con la migración nueva, GREEN;
- mutar temporalmente el gate de incidente en la migración nueva para que deje pasar sin incidente y demostrar que el test vuelve a rojo;
- quitar temporalmente el gate del fake/dominio y demostrar que los unitarios correspondientes caen;
- revertir todas las mutaciones antes del commit final.

Registrar comandos, tests y resultados en la evidencia del PR/contract-change. No fabricar tests ni modificar expectativas para producir verde.

## H06 · El body no sigue el template obligatorio ni contiene auto-revisión · BLOQUEANTE

El body actual reproduce el contrato, pero no la estructura obligatoria de `.github/pull_request_template.md`.

Faltan como mínimo:

- `Closes #<issue CC-015>`;
- DoD/criterios verificables;
- evidencia de checks;
- checkbox de RED;
- informe completo de `revisar-pr` del autor;
- rutas de otra zona;
- dependencias;
- checklist de seguridad;
- rollback.

**Corrección:** una vez creado el issue y cerrados H01-H05, reemplazar el body por el template adaptado a CC-015 y pegar la auto-revisión literal del autor.

## Lo correcto observado

- La precedencia propuesta AAL2 → motivo → incidente respeta la decisión P1 2-A.
- El criterio “cualquier incidente del mismo request, sin exigir status=open” coincide con la decisión tomada.
- Fake y dominio distinguen `hasIncident` y cubren incidente de otro request.
- pgTAP incluye caso sin incidente, incidente ajeno, AAL1, motivo vacío, delivered y actores no autorizados.
- No se agrega un error de dominio nuevo.

## Decisiones

No hay decisiones nuevas pendientes para Lautaro073. La semántica funcional ya fue fijada en PR #179: **2-A**.

## Criterio para Ronda 2

No pedir nueva revisión hasta que:

- la rama esté sincronizada con develop;
- las migraciones históricas queden intactas;
- exista una migración nueva CC-015 desplegable;
- exista el issue `contract-change` real y T-304/#36 figure bloqueada;
- contrato y códigos de error coincidan;
- RED → GREEN quede reproducible;
- body/autorrevisión estén completos;
- los checks finales estén verdes.
