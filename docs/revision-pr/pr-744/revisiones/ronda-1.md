# Revisión independiente, ronda 1 — PR #744 / T-437 / CC-052

**Fecha:** 2026-11-13 (Argentina)  
**Responsable:** revisión independiente de ChatGPT (no autor de la implementación)  
**SHA revisado:** `e96473185354589b3820a345cc7a089127919afd`  
**Base:** `develop`, `f0e217ac028633f22f52d74632f8615ceb886a7e`  
**Resultado:** **CON BLOQUEANTES (1)**. Uno de los dos hallazgos es mejora no bloqueante.

## 1. Método, contrato y alcance

- Leídos antes del diff: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y la ficha `docs/tasks/T-437.md` desde `develop`.
- Contrastados el `CC-052` mergeado (`Propuesto`, `Subsanación` y `Concurrencia`), el issue #670, el diff completo de los 51 paths, la bitácora y el estado de las PR #744 y #745.
- Comparada la ficha oficial contra la modificación en la PR: las ampliaciones son **exactamente** la invocación de `cc052_concurrency.mjs` en `.github/workflows/ci.yml` y el cambio 36→37 del conteo en `src/ui/ui-system.test.tsx`, también consignadas en plan y bitácora. No se identificó otro path fuera de la lista permitida. `docs/revision-pr/**` está autorizado.
- GitHub declara `mergeable=true`. No se ejecutó `git fetch` ni `git merge-tree`: la sesión no dispone del clon de la PR ni de acceso Git desde la terminal. No se presenta ese chequeo como cumplido.
- No se leyó `.env` ni se invocaron Supabase/Docker/Vercel remotos.

## 2. Lo que sí coincide con CC-052

1. **Guarda SQL (D1–D4):** `app_private.courier_required_documents_verified` exige exactamente un vigente por cada `dni_front`, `dni_back`, `selfie` y `avatar` con `status='verified'` y `purged_at is null`. Las guardas de `admin_decide_courier('approved')` y `admin_reinstate_courier` se aplican **después** de adquirir `couriers FOR UPDATE` y **antes** de cambiar estados o escribir auditoría. El rechazo sigue permitido sin los cuatro verificados.
2. **Subsanación (D5, D7):** `resubmit_courier_required_document` verifica identidad, rol, consentimiento activo, estado `rejected/suspended`, alta enviada, DNI no liberado y path canónico; toma primero el lock de courier, luego documento vigente; comprueba el objeto real de `storage.objects` antes de reemplazar, conserva idempotencia, deja el nuevo documento `submitted` y registra auditoría sin rutas. No rehabilita.
3. **UI (D6):** la query de admin proyecta `purged_at → purgedAt`; la guarda de UI reproduce el conteo SQL, y los tres botones se deshabilitan con motivo accesible.
4. **Concurrencia:** el script `cc052_concurrency.mjs` cubre cinco intercalados de verificar/rechazar ↔ aprobar y subsanar ↔ rehabilitar con sesiones PostgreSQL reales. En el log de `db-tests` están todos GREEN.
5. **Transición histórica:** `raise notice` cuenta aprobados no conformes sin suspenderlos ni hacer backfill, con seguimiento #743.
6. **Tipos y contrato:** `DATABASE.types.ts` se editó manualmente por la prohibición de Docker local, pero el job `db-tests` sí ejecutó `pnpm db:types --local` y el `git diff --exit-code` de tipos, ambos satisfactoriamente sobre el SHA de código.

## 3. Evidencia contrastada

| Evidencia | Resultado y alcance |
|---|---|
| `CI #744 / 43515294798` | `success` para HEAD `55b5098`; unit: 212 suites, 4014 tests; `verify-workflows`: 86 + 6; `db-tests`: 48 archivos, 4034 tests, PASS; escenarios CC-052 1–5 GREEN; tipos regenerados sin diff. |
| Diferencia `55b5098..e9647318` | Solo 14 líneas añadidas a `docs/tasks/log/T-437.md`. No hay modificación posterior de código. No se pide un nuevo CI por esta bitácora. |
| `#745 / CI 43515335746` | PR de mutación cerrada y no mergeada: SQL CC-052 23/76 tests fallidos; también dos controles unitarios SQL↔contrato en rojo. El difiere de #744 en las guardas SQL. Esta batería fue del **autor**, por tanto **no equivale** a ejecutar la batería independiente de la revisión. |
| `e2e-preview` | BLOCKED / REQUIRES DEVELOP MIGRATION, sin ejecución verde del flujo. Los E2E y las tres mutaciones UI siguen pendientes postmerge. |

Los tests y los logs fueron **leídos y contrastados**, no ejecutados aquí. No se levantó Docker ni se reprodujo el RED en un clon: los hallazgos que siguen se clasifican `deteccion=analisis`, `verificado_en_sha=null`.

## 4. Bloqueantes

### PR744-H01 — Fake de subsanación no respeta el NOT_FOUND de Storage

**Severidad:** alto · **Categoría:** test-coverage / correctness · **Patrón:** P08-control-no-cubre-lo-que-dice · **Estado:** abierto.

**Ubicación:** `src/domain/testing/rpc-fake.ts:3424–3466`; contraparte `supabase/migrations/20261114120000_cc052_courier_verified_documents.sql:340–345`; fixtures `src/domain/cc052-courier-verified-documents.test.ts:115–183`.

**Clase enumerada:** `add_courier_optional_document` del mismo fake sí consulta `storedCourierDocumentPaths` (`rpc-fake.ts:3299`). El nuevo `resubmit_courier_required_document` no consulta ese Set antes de desactivar el documento previo e insertar el nuevo. La SQL sí rechaza con `NOT_FOUND` y deja la transacción sin efectos. Los tests positivos `CC-052 fake: subsanación` no proveen `initialStoragePaths`, por eso siguen pasando aunque simulan un objeto que la base rechazaría. El fake de `replace_courier_document` es anterior y queda fuera de esta tarea; no se propone ampliarlo sin CC.

**Impacto:** prueba falsa de un contrato que combina dos sistemas; la batería de dominio puede dar verde para flujos de subida inexistente y omitir el fallo transaccional que protege la RPC.

**Corrección exacta:**
- En `src/domain/testing/rpc-fake.ts`, tras validar actor, estado, idempotencia y estado vigente, y **antes** de `current.isCurrent = false`, incorporar `if (!storedCourierDocumentPaths.has(input.storagePath)) return err('NOT_FOUND');`. Preservar el orden de errores y la semántica idempotente (reintentos exitosos no requieren volver a comprobar un objeto ya ligado).
- En `src/domain/cc052-courier-verified-documents.test.ts`, sembrar `initialStoragePaths` para cada caso positivo que inscriba un documento nuevo, dejando sin ruta un caso negativo. Afirmar `NOT_FOUND`, `isCurrent=true` en el rechazado original y ausencia de documento nuevo, más el caso positivo con ruta existente.
- Prueba RED independiente propuesta en `evidencia/comandos.md` (arnés completo para ejecutarse en un worktree). En este entorno no fue ejecutada; **no** se inventan salidas. El autor debe pegar el resumen de Vitest en RED y GREEN y no falsear ni condicionar el test para hacerlo pasar.

## 5. Mejoras

### PR744-H02 — El perfil no propaga el resultado de la subsanación

**Severidad:** medio · **Categoría:** correctness / UX · **Patrón:** P08-control-no-cubre-lo-que-dice · **Estado:** abierto.

**Ubicación:** `src/features/courier-onboarding/components/courier-profile-view.tsx:555–571` y `document-replacement-card.tsx:238–252`.

**Efecto:** la tarjeta de subsanación cambia su estado interno a `submitted`, pero en su instancia no se suministra `onReplaced`. El resumen de «Documentación» depende de `activeProfile` y puede seguir indicando «Observado» para el mismo documento hasta que se recargue la página. El E2E `courier-onboarding.spec.ts:966–1050` valida la tarjeta y la fila SQL, pero no la coherencia del resumen visible.

**Mejora exacta:** reutilizar `handleDocumentReplaced` pasando `onReplaced={handleDocumentReplaced}` a la tarjeta de `mode="resubmit"`; actualizar la prueba de componente para comprobar que el estado del resumen cambia y que se solicita `router.refresh()`. Ajustar el E2E existente para esperar el resumen autoritativo tras el refresco, no obligatoriamente una tarjeta aún montada: el servidor puede quitarla de `requiredResubmissions` cuando ya está `submitted`. No crear rutas ni componentes adicionales.

## 6. Decisiones y condiciones futuras

**Decisiones nuevas:** ninguna. D1-A…D7-A fueron ratificadas por Lautaro073 el 2026-11-13. La ampliación de ficha fue inspeccionada y corresponde a las dos integraciones concretas ya registradas.

**Condición pendiente de integración (no verde):** después de aplicar CC-052 en Develop, ejecutar el E2E de aprobación, tres bypass y subsanación real, y las tres mutaciones `t437-ui-{approve,reactivate,reconsider}-guard`. Si alguno falla, registrar el fallo y la corrección en una ronda posterior: no interpretar un `BLOCKED` como `PASS`.

**Checks locales independientes:** typecheck ⏸ no ejecutado · lint ⏸ no ejecutado · test ⏸ no ejecutado · test:db ⏸ prohibido Docker local · `git merge-tree` ⏸ sin clon. La fuente de resultados está señalada arriba.

**No se aprueba, no se mergea.** P1 conserva la decisión de integrar únicamente cuando se resuelvan los bloqueantes y su revisión independiente vuelva a verificarlos.
