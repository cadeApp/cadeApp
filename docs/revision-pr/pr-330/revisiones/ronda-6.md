# PR #330 — T-340 Paso 4 — Revisión independiente Ronda 6

- **Fecha:** 2026-10-14. **HEAD de implementación revisado:** `99c0ac956b85d4736adb43fc36f5dd5a28763be1`. Base `develop`: `c97e0d839c1cb6aa3a6645b10a33d8d313dd7d16`.
- **DICTAMEN: SIN BLOQUEANTES**. H09 y H10 cerrados tras correcciones, H01–H08 permanecen cerrados. Sin nuevas decisiones de producto ni alcance; no se aprueba ni mergea esta PR.
- **Autor de los últimos cambios:** asako669; commit `99c0ac956b85d4736adb43fc36f5dd5a28763be1` incluye SOLO `src/features/requests/actions.ts`, `src/features/requests/actions.test.ts` y `docs/tasks/log/T-340.md` desde la ronda R5. No tocó carpeta de revisor, workflows, migraciones, contratos ni tests E2E.

## Revisión de H09 — ARREGLADO-VERIFICADO
- `src/features/requests/actions.ts:50–61`: luego de `createDeliveryRequestSchema.safeParse`, la acción exige `data.requestId`. Ausente → `err('VALIDATION_ERROR')` sin `crypto.randomUUID()` servidor ni invocación RPC. Con UUID válido pasa exactamente esa clave al wrapper de `create_and_publish_multi_drop`. Cumple CC-024 §4 (UUID una vez por intención en el navegador); el schema del formulario permanece opcional, correctamente por el React Hook Form.
- `src/features/requests/actions.test.ts`: `validFormInput` ahora aporta UUID cliente fijo; los positivos de 1/3 drops lo comparan por igualdad en `p_payload`; se agregó un caso de merchant válido sin ID que espera `VALIDATION_ERROR`, **0 RPC**, 0 inserts, única consulta al perfil. Mantiene malformed/role/retry.
- La bitácora del autor declara mutante del fallback servidor con **1 FAILED / 10 passed** en la aserción de `VALIDATION_ERROR` del caso ausente, restaurado con **11/11 PASS**. **El revisor NO reprodujo esa mutación localmente**; sí inspeccionó la propiedad y CI unit auténtico del SHA revisado.

## Revisión de H10 — ARREGLADO-VERIFICADO (mejora test)
- En tests de creación 1/3 drops, `mockFrom('delivery_requests')` entrega un `{insert: mockInsert}` funcional y observable, con resultado resoluble; camino sano afirma `mockFrom` llamado **solo** para `profiles`, `mockInsert` cero y exactamente **una** `rpc('create_and_publish_multi_drop', {p_payload})`. No hay fallback directo en código productivo.
- El autor informa mutación temporal INSERT que resultó **2 FAILED / 9 passed**, por `AssertionError` de `mockFrom` llamado 2 veces en vez de 1, **sin TypeError**. Restaurada → **11 PASS**. Demuestra que el stub ya permite llegar al oráculo relevante. No se adjudican mutaciones ejecutadas por el revisor.

## Checks reales del SHA revisado
- [CI run 38620279932](https://github.com/cadeApp/cadeApp/actions/runs/38620279932), `unit` job **116045704729**: **129 archivos, 2154/2154 tests PASS**, incluido `src/features/requests/actions.test.ts` **11/11 PASS**; cobertura contrato/fake 100%/90% branches.
- `db-tests` job **116045704327**: **Files=21, Tests=2177, Result=PASS**, cinco carreras de CC-024, prueba de idempotencia y mutante H07 RED→GREEN, tipos `pnpm db:types --local` generados sin drift; `typecheck`, `lint`, `build`, `audit`, `bundle-budget` PASS.
- [E2E Preview run 38620391687](https://github.com/cadeApp/cadeApp/actions/runs/38620391687), job **116046227024** hizo checkout explícito del SHA `99c0ac956b85d4736adb43fc36f5dd5a28763be1` y probó Preview contra Supabase Develop ya migrado: el escritor multi-drop de tres entregas, all-failed y cliente legacy de una entrega pasaron. **Resumen Chromium: 73 passed + 1 flaky** (test de privacidad de mapa T-314 falló la primera vez porque `/api/live/available-requests` devolvió HTTP 500 en lugar de 200, pasó en retry #1), **3/3 global-settings PASS**. Job E2E SUCCESS, pero NO rotular «74 limpios» o «cero flaky».
- `approval-policy` job **116045705510** FAIL con mensaje **«Falta el informe completo de revisar-pr sin bloqueantes»**. En la PR autor Lautaro073 el job requiere en **body** sección `### Informe de revisión de agy` con los campos `Informe revisar-pr — T-340`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:`, `No revisado / dudas para Lautaro073:`. El body anterior aún decía H09 bloqueante. Registrar informe verdadero con formato correcto, sin editar CI ni fingir APPROVED.
- `mergeable_state=unstable` a causa de status policy de aprobación (no se observó `dirty` por conflictos tras merge develop). El HEAD documentario de esta revisión reinicia checks y **sus resultados NO se atribuyen al SHA de código**.

## Observación no bloqueante fuera de alcance — flake T-314
- `e2e/specs/map-privacy.spec.ts:498`, interceptación de `/api/live/available-requests`: primera ejecución recibió **HTTP 500**, segundo intento pasó. No hay evidencia de exposición de coordenadas ni de regresión introducida por los tres archivos editados en esta ronda. **No atribuir causa raíz sin logs de API del mismo instante; no cambiar E2E, retries, timeouts ni la API desde esta PR.** Si se repite fuera del E2E, investigar como tarea aparte con correlación request-id y logs (sin PII).

## Entrega y límites
- Ronda 6 concluye SIN BLOQUEANTES de implementación de T-340 Paso 4. No se exige staging ni pruebas humanas ahora: decisión de Lautaro073 es completar desarrollo antes del piloto/staging.
- No se ejecutó Docker, PostgreSQL, pnpm, Playwright ni mutación en un clon independiente de revisor: evidencia de lectura GitHub + logs del CI real y verificación de rutas. **Los RED del autor son declaraciones de autor contrastadas con el oráculo/test, no ejecución independiente**.
- **Pendiente humano:** PR permanece **Draft**. Lautaro073 decide cuándo pasarla a **Ready for review** y autoriza su merge. **Esta revisión no la aprobó ni mergeó**.
