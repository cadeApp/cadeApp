# Revisión independiente — PR #686 / T-430 / CC-048 — ronda 3

**Fecha:** 2026-11-11. **Revisor:** ChatGPT (independiente).
**SHA de código revisado:** `c777bf3a81b7b21ecc0546a224f702fc0762d570`. **Base actual:** `develop@af023d3099e9e2ea15e3b78bf0cf5937e699058a`.
**Resultado:** **CON BLOQUEANTES (1 nuevo, H04).** No aprobar ni mergear antes de corregir el contrato de pruebas de INSERT.

## Método y límites

Se leyeron la guía y skill obligatorias, las discusiones y bitácora, la PR y su comparación desde `17778fab` y desde `develop@af023d3`, CC-048, T-430, el plan, T-409/T-431 desde develop, migración SQL de esquema, función `request_cycle` y runner T-340. El merge con develop es genuino (rama no diverge; GitHub `mergeable_state=clean`). No se detectaron ediciones del autor en `docs/revision-pr/pr-686/`.

**Ejecutado independiente:** control documental GREEN sobre contenidos del SHA y 12 mutaciones aisladas RED en memoria, más comprobación por código fuente de la imposibilidad de usar el mismo fixture válido para ambos órdenes de INSERT (H04). Se escribió un harness de Node y su sintaxis se comprobó con `node --check`; no hubo clon local disponible para ejecutar el harness sobre archivos del repo. **No se ejecutaron** `pnpm`, PostgreSQL, Docker, pgTAP, tests concurrentes ni CI. Autor declara `pnpm exec vitest run tools` → 123 passed y `git diff --check` limpio; el color de CI no fue gateado porque hay un bloqueante documental.

## Verificación de las correcciones

- **H01 (parcial; diseño ampliado):** `CC-048.md:64-97,116-138` separa INSERT mediante trigger y UPDATE mediante policy que intenta tomar lock del padre. Tiene fallback sin lock para clasificar `INVALID_STATE_TRANSITION` / `NOT_FOUND`; el fallback sigue siendo correcto para su función de clasificar excepciones y no habilita escritura. Faltan pruebas SQL de ejecución en T-430.
- **H02 (mantenido):** `T-430.md:80-83,95-99` exige 1 fila, persistencia, `updated_at` previo controlado y mutaciones RED futuras. No se cambió ni debilitó en esta ronda.
- **H03 (arreglado en diseño, no verificado en PostgreSQL):** `CC-048.md:67-73` cambia `trg_lock_draft_contacts` a solo INSERT; `:82-97` pide `contacts_update_merchant USING EXISTS (... FOR UPDATE OF r)` y plantea helper `security invoker` si la variante SQL no se acepta. `:118-135` y `T-430.md:87-99` exigen fixture legacy sin drops, concurrencia adversa, comprobación de lock y RED al quitar el prelock. El contrato exige frenar y volver al CC si la prueba no demuestra el mecanismo; no se hace pasar el diseño por prueba runtime. El detalle de INSERT tiene una contradicción nueva, H04.
- **M03:** cita correcta `supabase/tests/t340_multi_drop.sql:175`. **M04:** se distingue UPDATE tras publicación y UPDATE concurrente (0 filas) de INSERT, con resultado explícito.
- **I01:** resuelto: `develop@af023d3` fue mergeado, la PR es mergeable/clean, las filas T-409, T-430 y T-431 del plan coinciden literalmente con el primer DoD de las tres fichas; ninguna ficha T-409/T-431 alterada frente a develop. El diff respecto de develop incluye solo CC-048, T-430, su log, fila T-430 y carpeta exclusiva de revisión; no hay desvío de alcance.

## BLOQUEANTE PR686-H04 (MEDIO, plan de prueba no ejecutable)

**[`docs/contracts/CC-048.md:118-132`] — la frase «todas con solicitud legacy de 0 drops y contacto completo» se aplica también a «insert en ambos órdenes», una combinación sin camino legítimo para publicación primero.**

**Fuente de verdad verificada:**
1. `supabase/migrations/20260922031435_schema_v1.sql:111-112` define `delivery_request_contacts.request_id uuid PRIMARY KEY`. Solo hay **una** fila de contacto legacy por solicitud.
2. `supabase/migrations/20261009200000_t340_multi_drop.sql:723-735` exige que `publish_request` con 0 drops encuentre esa fila completa, de lo contrario aborta con `MISSING_REQUIRED_FIELDS`.
3. El runner existente `supabase/tests/integration/t340_concurrency.mjs:161-172`, incluso con `createDraftFixture(0)`, **ya inserta** un contacto incompleto de pickup y tampoco completa los campos obligatorios de la solicitud para el puente legacy.
4. `CC-048.md:121-132` pide todos los escenarios con contacto completo, pero también que un INSERT sea una operación real antes/después de publicar.

**Contradicción exhaustiva:** si el fixture contiene contacto, otro INSERT para el mismo `request_id` ya es inválido incluso en draft (PK). Si aún no contiene contacto, `publish_request` de cero drops no puede publicar primero (`MISSING_REQUIRED_FIELDS`). Por tanto ningún fixture legacy válido reproduce «publicación primero, luego INSERT» como dos operaciones del flujo reales y legítimas. Un test de excepción podría pasar por unicidad y dar **falso verde**, sin probar la serialización ni el error de la policy/trigger. Este hallazgo se detectó por enumeración de los dos estados posibles (contacto presente/ausente); es un defecto de la especificación, no una falla pgTAP ejecutada.

**Corrección documental exacta (SIN editar SQL ahora):**
- Conservar los **dos órdenes de UPDATE** sobre legacy con contacto completo y 0 drops. El update adverso de H03 no cambia.
- **INSERT primero:** fixture independiente `draft` con 0 drops y **sin contacto inicial**, con todos los campos obligatorios de `delivery_requests` listos; A realiza el primer INSERT con contacto **completo**, conserva abierta la transacción; B intenta `publish_request`, queda bloqueada por el lock del padre, A confirma, B publica con el contacto insertado. No usar `createDraftFixture(0)` sin cambiarlo; ya inserta un contacto placeholder.
- **INSERT sobre no draft / publicación primero:** no presentarlo como carrera legítima con `publish_request` de cero drops. Separar una prueba de guarda con fixture **sintético** de una solicitud propia ya publicada **sin contacto** creado por owner, intentando el primer INSERT como merchant; debe fallar con `INVALID_STATE_TRANSITION` (precisar SQLSTATE `P0001` y mensaje de dominio si el contrato los preserva) y persistir sin contacto. Para ejercitar una espera, B podría adquirir lock en parent y cambiar status a published como owner sin invocar `publish_request`; A intenta INSERT y espera, y tras el commit fracasa. Etiquetar como carrera de transición sintética, **no** como RPC real. Mantener además pruebas de policy `WITH CHECK` de INSERT.
- **Mutaciones RED:** quitar el trigger de INSERT para la carrera sintética controlada, sin inventar una segunda fila que caiga por PK; si se afirma que la prueba demuestra el fallo de carrera, exigir que el resultado sin trigger sea observable como violación del invariante, no solo mensaje/PK. Para la prueba de publicación real con INSERT primero, quitar el lock serializador y confirmar qué invariante protege (orden real de locks, publicación válida, datos persistidos) antes de declararla RED.
- Reflejar estas distinciones en `CC-048.md` «Concurrencia», «Impacto exacto» y `T-430.md` DoD/mutaciones. No cambiar D1 ni RPC ni grants.

### MEJORA M05 (BAJA; coherencia contractual)

`CC-048.md:52-55` describe `contacts_update_merchant USING` como simple `EXISTS` sin lock, mientras §Propuesto 6 exige `FOR UPDATE OF r`. Aclarar que **punto 6 sustituye el USING de UPDATE del punto 2**, y deja el EXISTS simple solo para `WITH CHECK` e INSERT. `CC-048.md:107` dice «sin funciones nuevas», incompatible con helper alternativo opcional del punto 6. Reemplazar por «sin función nueva en la opción principal; una función `security invoker` opcional solo tras verificar necesidad», con grants y cobertura exacta. `T-430.md:28-30` también puede citar §Propuesto 6.

## Decisiones y riesgo pendiente

No surgió una decisión de producto nueva para esta PR documental: H04 requiere corregir fixtures y sus aserciones. La decisión de cambiar RPC o D1 **solo ocurriría** si en la implementación falla la prueba real del prelock de §Propuesto 6; el CC ya exige frenar y consultar, sin decidirla por adelantado.

## Resultado y siguientes pasos

**CON BLOQUEANTES (H04).** Informe de H03 actualizado sin fingir una comprobación de PostgreSQL, I01 resuelto. No aprobar ni mergear. Emitir prompt de corrección acotada: solo `docs/contracts/CC-048.md`, `docs/tasks/T-430.md`, `docs/tasks/log/T-430.md`; no tocar la fila T-430 ni otras fichas si el primer DoD no cambia; no editar carpeta de revisión. Pedir nueva ronda independiente sobre SHA actualizado.

