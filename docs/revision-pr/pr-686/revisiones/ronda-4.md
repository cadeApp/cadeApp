# Revisión independiente — PR #686 / T-430 / CC-048 — ronda 4

**Fecha:** 2026-11-11. **Resultado:** **SIN BLOQUEANTES DOCUMENTALES**; mejora no bloqueante M06.
**SHA de código revisado:** `cbcace19dbe99d972a5873725abe1a9e5430f615`.
**Base de comparación:** `develop@af023d3099e9e2ea15e3b78bf0cf5937e699058a`.
**Rama:** `feat/T-430-sec06-draft-only`. **PR:** #686, Draft y `mergeable_state=clean`.

## Método y límites

Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`, la PR y sus comentarios anteriores, la bitácora, el diff `32569dc0..cbcace19`, el diff a develop, CC-048, ficha T-430, plan de implementación, fichas T-409 y T-431 en develop, esquema legacy, `request_cycle` y runner T-340. Se contrastó RLS con [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html) y [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Control independiente realmente ejecutado en memoria**, con textos obtenidos por conector GitHub en SHAs inmutables: baseline **GREEN**, **15/15 mutaciones documentales RED**. Ver `../evidencia/comandos.md`. Esto comprueba consistencia textual y detectabilidad de cambios adversos en la especificación, **NO ejecución PostgreSQL**. No se ejecutaron `pnpm`, `git diff --check`, CI en local, pgTAP ni pruebas multisesión. Autor declara `pnpm exec vitest run tools` 10 archivos y 123 tests verdes, y `git diff --check` limpio. El workflow CI del SHA revisado estaba **queued / sin conclusión** al consultar, por lo que no se afirma CI verde.

## Ronda 3 → ronda 4: contrastes

- **PR686-H04 (MEDIO): ARREGLADO-VERIFICADO DOCUMENTALMENTE en `cbcace19`.** `CC-048.md:126-151` separa: UPDATE adverso/UPDATE primero en solicitud legacy con 0 drops y **contacto ya completo**; **INSERT primero** con fixture propio de 0 drops y **sin contacto inicial** (evita `createDraftFixture(0)`, que ya insertaba contacto); «publicación primero, INSERT después» ya no se presenta como carrera legítima de `publish_request` porque `request_id` es PK y la RPC exige contacto completo. Se exige guarda estática de una solicitud publicada sintética sin contacto y carrera de transición sintética de owner, ambas correctamente etiquetadas como no-RPC. `T-430.md:88-103` reconcilia estos casos en DoD y mutaciones. RED futura sin trigger INSERT exige observar contacto persistido en solicitud publicada; **la viabilidad exacta del interleaving y del RED queda condicionada a su ejecución real en T-430**. Control textual independiente GREEN y mutaciones RED para las seis precondiciones de H04.
- **M05: CORREGIDA.** `CC-048.md:52-56` declara que punto 6 reemplaza `contacts_update_merchant USING` del punto 2. `CC-048.md:108-113` indica que la opción principal no agrega función, y el helper alternativo `SECURITY INVOKER` solo se crea tras comprobar la necesidad, con `EXECUTE` exclusivo de `authenticated` y `has_function_privilege` para demostrar que `anon` no lo posee. `T-430.md:28-29` cubre puntos 1 a 6.
- **PR686-H01 (ALTO original):** diseño de serialización ampliado y verificado a nivel de contrato; ejecución real pendiente de la tarea T-430. No se marca el bug de runtime como verificado.
- **PR686-H02 (MEDIO original):** se mantienen número de filas, persistencia, timestamp inicial controlado y mutaciones de H07.
- **PR686-H03 (ALTO original):** `CC-048.md:65-98` mantiene trigger **solo INSERT** y prelock padre mediante `FOR UPDATE OF r` en policy `USING` del UPDATE, con helper invoker condicional. `CC-048.md:123-157` y `T-430.md:88-103` exigen dos sesiones, 0 drops, bloqueo real por `pg_blocking_pids`, ausencia de `40P01`, persistencia, mutación RED sin prelock. Si PostgreSQL no demuestra orden, la ficha exige frenar y volver al CC, no cambiar la RPC ni D1 automáticamente. **Diseño documental aceptable pero no `arreglado-verificado` en runtime**.
- **I01:** desapareció: `develop@af023d3` es ancestro de la rama, PR `mergeable=true`, `mergeable_state=clean`, y las tres filas T-409/T-430/T-431 del plan coinciden exactamente con el primer DoD de sus fichas. Fichas T-409/T-431 no cambiaron respecto de develop. Diff contra develop: CC-048, T-430, su log, fila T-430 del plan y la carpeta de revisión, sin migraciones ni código.
- **M03/M04:** conservadas: ruta precisa `supabase/tests/t340_multi_drop.sql:175`; se separan resultado de INSERT fuera de draft y UPDATE fuera de draft.

## BLOQUEANTES

**Ninguno para el alcance documental de esta PR.** No equivale a certificar que el nuevo SQL compile o que las carreras den GREEN: eso es condición expresa para que la futura implementación T-430 pueda cerrarse. Una migración posterior que no demuestre prelock de UPDATE y serialización de INSERT debe detenerse y volver al CC.

## MEJORA NO BLOQUEANTE — M06 (bajo; metadatos del PR)

El **cuerpo de la PR** aún atribuye a este PR «Arreglo de develop: sincronizar la fila T-409» y afirma que desarrollaba desde un develop rojo por esa fila. En la base actual `af023d3`, la corrección de T-409 ya entró con T-431 (#687); el diff actual de #686 solo agrega la fila T-430 al plan. Es histórico real del PR, pero la sección «Qué hace» puede inducir a error. Sugerencia: actualizar manualmente la descripción aclarando que `T-409` quedó sincronizada por `develop@af023d3` y que esta PR agrega CC-048, T-430, bitácora, plan T-430 y revisión. **No requiere modificar archivos, un nuevo commit ni otra ronda.** No alterar decisiones D1–D3.

## Resultado y siguiente paso

**SIN BLOQUEANTES DOCUMENTALES.** La PR sigue Draft y no fue aprobada ni mergeada. El propietario puede seguir el flujo de revisión/merge documental cuando se cumplan las políticas del repositorio, y luego implementar T-430 en una PR separada. Para esa implementación son imprescindibles pgTAP, runner concurrente con cero drops, comprobación de grants/policies en PostgreSQL y mutaciones RED→GREEN reales; no basta con la batería de texto.

No se abre nueva decisión sobre D1–D3. No se necesita prompt de corrección para el código de esta PR.
