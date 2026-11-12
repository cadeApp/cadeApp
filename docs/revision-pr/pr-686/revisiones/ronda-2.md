# Revisión independiente — PR #686 / T-430 / CC-048 — ronda 2

**Fecha:** 2026-11-11. **SHA de código revisado:** `a91e8e405ab19e5bb6f70759761d118b95c98df9` (incluye `c1be9e71`).
**Referencia histórica:** `develop@f33acf8a2a03e5c54f7da3fe6926464cc1dcbe10`. **Estado del develop actual durante la ronda:** `af023d3099e9e2ea15e3b78bf0cf5937e699058a`.
**Resultado:** **CON BLOQUEANTES** — H03 alto de diseño por riesgo de deadlock en legacy + I01 bloqueo operativo de merge. No aprobar ni mergear.

## Cómo se revisó

Lectura de la PR, comentario de ronda 1, bitácora, diff entre `78a89356..a91e8e40` y contra `f33acf8a`, ficha T-409 desde develop antiguo, CC-023, CC-026, CC-047, trigger T-340, `request_cycle` y runner de integración T-340. Comparación de RLS con la documentación oficial PostgreSQL de `CREATE POLICY` y el orden de bloqueo del `BEFORE UPDATE`. Control documental independiente en memoria: **GREEN + siete mutaciones RED**; ver comandos. No se ejecutó PostgreSQL, `pnpm` ni CI en esta sesión. Declaración del autor: `pnpm exec vitest run tools` 10/123 en verde, `git diff --check` limpio. Los resultados de DB/concurrencia son especificaciones futuras, no pruebas ya pasadas.

## Hallazgos de la ronda 1

| Hallazgo | Estado de contrato | Evidencia |
|---|---|---|
| PR686-H01 (falta serializar contactos legacy) | **parcial**, pendiente la inversión real de locks de H03 | CC-048:64-77,96-109; T-430:84-95. Trigger y pruebas multisesión ya listados, pero faltó el caso legacy sin drops y un orden de locks demostrable |
| PR686-H02 (H07 pasa con 0 filas) | **corregido y verificado documentalmente** en `a91e8e40` | CC-048:165-170, T-430:80-83,93-95. DoD exige 1 fila, valor persistido, `updated_at` controlado y dos mutaciones independientes; control de contratos + mutaciones GREEN/RED |
| M01 (insert vs update fuera draft) | **corregida** | CC-048:177-179, T-430:75-77: insert → excepción; update posterior a publicación → 0 filas sin excepción |
| M02 (T-409) | **correcta** | La ficha T-409 no fue modificada; fila 436 del plan coincide con su primer DoD |

## Fallback sin lock del helper: OK para su propósito

**CC-048.md:70-77** es técnicamente consistente con la base. PostgreSQL aplica policies de UPDATE también a `SELECT FOR UPDATE` (documentación oficial: https://www.postgresql.org/docs/current/sql-createpolicy.html). Con `delivery_requests_update_merchant USING(... status='draft')`, un pedido `published` propio deja de aparecer en la lectura bloqueante del helper. El fallback posterior `SELECT status,merchant_id` **sin lock** puede clasificar `INVALID_STATE_TRANSITION` si pertenece al comercio y está fuera de `draft`, o `NOT_FOUND` si no es suyo/no existe. `delivery_requests_select_merchant` (rls_v1.sql:273-275) y el GRANT de `id,merchant_id,status` en CC-023 (private_columns.sql:12-18) permiten leer esas columnas. El fallback solo decide qué excepción lanzar: no autoriza ni ejecuta una escritura; por ello el hecho de no bloquear esa lectura es aceptable para esa clasificación de error.

**Límite:** los SQLSTATE y mensajes aún requieren pgTAP sobre la migración real; la revisión verifica el diseño documental, no una ejecución. El fallback no resuelve por sí mismo la inversión de locks que sigue.

## BLOQUEANTE PR686-H03 — El trigger propuesto invierte los locks en la publicación legacy

**Severidad:** alto. **Categoría:** correctness/concurrencia. **Ubicación:** `docs/contracts/CC-048.md:64-69,98-105`; `docs/tasks/T-430.md:87-90`. **Método:** [ANÁLISIS, NO reproducido en PostgreSQL].

**Camino real:**
1. El UPDATE directo de una fila existente de `delivery_request_contacts`, ejecutado como `authenticated`, puede tomar el lock de su propia tupla antes de ejecutar `BEFORE UPDATE`; el trigger entonces intenta bloquear `delivery_requests` con `FOR UPDATE`.
2. La RPC `request_cycle` bloquea primero la solicitud en `supabase/migrations/20261009200000_t340_multi_drop.sql:643`.
3. En `publish_request` **sin drops**, el puente legacy intenta bloquear la misma fila de contacto con `FOR UPDATE` en `t340_multi_drop.sql:723-727`.
4. Intercalación plausible: sesión B bloquea primero la solicitud, sesión A toma la fila de contacto y espera por B en el trigger, sesión B avanza a la lectura bloqueante de ese contacto y espera por A → ciclo A↔B, posible `40P01`. La frase «mismo orden ... no agrega riesgo de deadlock» de CC-048:98-100 es demasiado fuerte. Ref. PostgreSQL source `src/backend/commands/trigger.c`: `GetTupleForTrigger` toma lock de la tupla en BEFORE UPDATE; documentación: https://www.postgresql.org/docs/current/trigger-definition.html y https://www.postgresql.org/docs/current/explicit-locking.html.

**Brecha en el DoD:** `supabase/tests/integration/t340_concurrency.mjs:161-186` usa `createDraftFixture(initialDrops=1)`; las ocho pruebas actuales ejercitan drops. El contrato exige carreras de contactos pero **no especifica el fixture crítico con 0 drops**, de modo que podría satisfacer la prueba elegida sin cruzar `request_cycle:727`. La nueva aserción `no 40P01` no basta si la rama de ejecución con inversión no se alcanza.

**Corrección exigida en el contrato y ficha, SIN implementar todavía código SQL:** añadir caso de concurrencia específico con borrador legacy (0 drops, contacto completo, datos de publicación válidos), para UPDATE contacto (no solo INSERT), forzando por barreras el orden B bloquea parent → A intenta UPDATE child → B intenta publicar y bloquear child; comprobar ausencia de 40P01, resultado de la RPC y estado/datos. No apoyar la prueba solo en una publicación ya completada: eso no reproduce intercalación entre dos locks. Además definir un mecanismo de ordenación que evite el ciclo. Alternativa preferida **a validar con DB**: intentar que la policy `contacts_update_merchant USING` adquiera `FOR UPDATE OF r` sobre la solicitud padre **antes** de que el executor bloquee la fila hija, sin ampliar grants ni alterar RPC; tener en cuenta coste, revalidación RLS, semántica de 0 filas y el requerimiento de acceso UPDATE en el padre. No afirmar que esta solución sirve sin demostrarla con un test multisesión. Alternativas a contrastar: modificar lock del camino legacy de `request_cycle` (ampliación de contrato y pruebas de RPC), o eliminar UPDATE directo de contactos a favor de RPC (reabre D1=A). La solución final debe preservar `RPC` y fixtures, o declarar y aprobar el cambio de alcance.

**Mutación RED futura:** desactivar solo la adquisición anticipada del lock del padre en una copia efímera del arreglo y repetir la intercalación que lo requiere. Debe dar `40P01`, timeout de lock controlado o resultado incorrecto **por propiedad de concurrencia**, y la implementación íntegra GREEN. No fabricar sleeps ni adulterar expectations.

## Bloqueo operativo I01 — Conflicto con develop actual

**GitHub PR #686** en consulta de esta ronda: `mergeable=false` y `mergeable_state=dirty`. `origin/develop` avanzó desde `f33acf8a` a `af023d3`, commit de T-431 (#687): modifica `docs/implementation-plan.md`, incluye ya la misma sincronización de T-409 y añade la fila T-431 a la sección donde la rama añade T-430. Necesario resolver vía **merge de develop en feat** (no rebase), conservando **T-409, T-430 y T-431**, sin modificar `docs/tasks/T-409.md`. Ejecutar `tools/verify-fichas.test.ts` y comprobar merge-tree limpio antes de pedir la siguiente ronda. Este bloqueo no implica error de seguridad del contrato.

## MEJORAS

- **M03 (baja, claridad de cita):** `CC-048.md:73` y `:182-184` dicen `t340_multi_drop.sql:175`, que es ambiguo porque hay migración y test con ese basename. La expectativa concreta de `INVALID_STATE_TRANSITION` está en **`supabase/tests/t340_multi_drop.sql:175`**; la migración homónima en línea 175 no contiene la aserción. Referenciar ruta completa.
- **M04 (baja, modalidad de error):** `CC-048.md:104-105` dice «insert o update espera y falla con INVALID_STATE_TRANSITION», mientras §Pruebas `:177-179` distingue UPDATE posterior a publicación: cero filas, sin excepción. Aclarar expresamente la diferencia entre UPDATE concurrente que ya seleccionó la fila estando en draft y UPDATE que comienza cuando la publicada es visible; y adecuar la expectativa al mecanismo de ordenación finalmente elegido.

## NO TOCAR

No tocar el `SELECT` simple del fallback por seguridad aparente ni pasarlo a `SECURITY DEFINER`: su función es clasificar el error sin escribir. No cambiar la ficha T-409, el catálogo de CC ni ampliar a otras tablas por D3. No romper suites existentes de drops/drop_contacts. No editar la carpeta `docs/revision-pr/pr-686` desde la sesión del autor.

## Checks / cierre

**Realizado independiente:** repositorio leído por GitHub, control documental GREEN y 7 mutaciones RED en memoria, comparación contra base; evidencia de probable deadlock por camino de código. **No realizado:** pgTAP, runner multisesión, CI oficial, Typecheck/lint. Con bloqueantes vigentes no se revisó el color CI. CI del SHA movido por este commit de revisión no se exige de nuevo solo por docs.

**Cierre:** No mergear ni aprobar. Resolver diseño H03, conflicto I01 y dudas menores, registrar bitácora y solicitar ronda 3 sobre nuevo SHA.
