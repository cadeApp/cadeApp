# Revisión independiente — Ronda 2 · PR #744 / T-437 / CC-052

**Fecha:** 2026-11-13 (America/Argentina/Tucuman)  
**Revisor:** revisión independiente de ChatGPT; autor de la implementación: Lautaro073  
**SHA inspeccionado y verificado estructuralmente:** `a20402a999084fd60d91ca6e62143b10a20d134d`  
**Base:** `develop`, `f0e217ac028633f22f52d74632f8615ceb886a7e`  
**Resultado:** **SIN BLOQUEANTES DE CÓDIGO**; no se detectaron nuevos hallazgos. H01 y H02 quedan `arreglado-verificado` con **método estructural + CI unit**, no con ejecución local de Vitest. El gate `db-tests` está pendiente de verificación del log de esta corrida; los E2E se mantienen diferidos postmerge según la decisión de integración registrada.

## 1. Integridad de la ronda

- La rama `feat/T-437-b05-verified-documents` tiene HEAD `a20402a999084fd60d91ca6e62143b10a20d134d` al iniciar el análisis. `a20402a9` desciende directamente de `81ed25cc`, commit de la Ronda 1, sin rebase. El commit nuevo modifica exactamente seis archivos permitidos (incluida la bitácora); ninguno en `docs/revision-pr/**`. Las cinco piezas de la R1 seguían intactas.
- La comparación GitHub `develop...a20402a9` devuelve `ahead_by=16`, `behind_by=0` y merge-base `f0e217ac028633f22f52d74632f8615ceb886a7e`. **No se ejecutó** `git merge-tree --write-tree` porque no hay clon con acceso a GitHub desde este contenedor; no se inventa un resultado de merge-tree.
- Se mantuvo el alcance de `docs/tasks/T-437.md` desde develop, las decisiones D1-A…D7-A y las dos ampliaciones autorizadas de ficha (`ci.yml` e `ui-system.test.tsx`); no se añadió nuevo paquete, migración ni contrato.
- Se leyeron el comentario R1 de la PR y `docs/tasks/log/T-437.md` en `a20402a999084fd60d91ca6e62143b10a20d134d`, con RED y GREEN reportados por el autor. La bitácora no fue alterada por esta revisión.

## 2. Estado de los hallazgos

### PR744-H01 — Arreglado y verificado con método limitado

**Archivos:** `src/domain/testing/rpc-fake.ts:3424–3470` y `src/domain/cc052-courier-verified-documents.test.ts:35–223`.

- El fake comprueba `storedCourierDocumentPaths.has(input.storagePath)` y devuelve `NOT_FOUND` **antes** de `current.isCurrent = false`, de `documents.set` y después de resolver los reintentos idempotentes. Esto copia la precedencia observable de la SQL `supabase/migrations/20261114120000_cc052_courier_verified_documents.sql:295–359`.
- Los positivos introducen únicamente los tres paths utilizados o el path de la selfie. El test `PR744-H01` comprueba `NOT_FOUND` y conservación del estado del documento anterior, seguido de inserción positiva con el path sembrado y reintento con el **mismo `documentId`**.
- **RED/GREEN del autor:** RED `1 failed | 13 passed`, fallo concreto `expected { ok: true } to deeply equal { ok: false, code: 'NOT_FOUND' }`; GREEN `14 passed`. No se simula que el revisor ejecutó ese Vitest.
- **Comprobación independiente:** un oráculo estructural ejecutado sobre el contenido del blob remoto `a20402a999084fd60d91ca6e62143b10a20d134d` comprobó la ubicación de la guarda y sus tests; una **mutación solo en memoria** que elimina la condición hizo fallar el oráculo. Verde 4/4 controles; rojo esperado al eliminar la guarda. No se modificó ni se reescribió la rama. Código reproducible en `evidencia/comandos.md`.

**Estado:** `arreglado-verificado` (inspección ejecutable + CI unit, no Vitest independiente).

### PR744-H02 — Arreglado y verificado con método limitado

**Archivos:** `src/features/courier-onboarding/components/courier-profile-view.tsx:555–572`, `components.test.tsx:2989–3035` y `e2e/specs/courier-onboarding.spec.ts:989–1054`.

- `DocumentReplacementCard` en `mode="resubmit"` ahora recibe `onReplaced={handleDocumentReplaced}`. El callback ya existente actualiza el estado local del documento y llama a `router.refresh()`.
- El unit verifica que el resumen ya **no** exhiba `rejectedBadge`, aparezca «En revisión» y se invoque el refresh. El E2E espera `status='submitted'` mediante `expect.poll` contra la DB, verifica que no quede el badge «Observado» y mira el resumen, sin exigir que la tarjeta persista tras el refresh.
- **RED/GREEN del autor:** al quitar `onReplaced` el test nuevo da RED por la persistencia de un badge rechazado; con callback `components.test.tsx` da GREEN, `141 passed`.
- **Comprobación independiente:** oráculo estructural sobre el código remoto comprobó vínculo, actualización y aserciones; mutación en memoria sin `onReplaced` dio RED estructural. Verde 4/4; rojo esperado al quitar el callback.

**Estado:** `arreglado-verificado` (inspección ejecutable + CI unit; E2E postmerge aún pendiente).

## 3. CI de SHA exacto

- Corrida `https://github.com/cadeApp/cadeApp/actions/runs/43520180832` del HEAD `a20402a9`.
- Jobs `typecheck`, `lint`, `build`, `audit` y `bundle-budget` **success** (observados en GitHub Actions).
- Job `unit` **success**: en el log verificado figuran **212 Test Files passed / 4016 Tests passed**; `verify-workflows` **86/86**, `verify-adr` **6/6**. Esto también descarta que el timeout local de `clients.test.ts` sea una regresión reproducida en esta corrida.
- Job `db-tests`: al redactar esta ronda estaba **in_progress**. El control histórico de `43515294798` en R1 fue verde con `Files=48, Tests=4034`, los cinco escenarios de concurrencia GREEN y `db:types` sin diff, pero no reemplaza el log del nuevo HEAD.

**Límites técnicos de revisión:** no se pudo descargar el clon público por DNS, no hay `pnpm/vitest` en el entorno; por tanto **no se corrieron Vitest, pgTAP, Docker, `git merge-tree` ni la mutación E2E en este entorno**. El oráculo estructural no es equivalente a un test funcional; la combinación con CI unit es la base precisa de `arreglado-verificado`.

## 4. Gate de integración y decisiones

**Nuevas decisiones para Lautaro073:** ninguna. El diferimiento ya acordado de `e2e-preview` (BLOCKED / REQUIRES DEVELOP MIGRATION) **no se interpreta como prueba verde**. Con la PR aún Draft y sin merge, P1 debe aplicar las condiciones existentes: esperar `db-tests` verde y, después de integrar/migrar Develop, ejecutar E2E reales y los tres mutantes UI con `RED_CONFIRMED`. Sin eso, la verificación de producción no está completa.

**Conclusión:** revisión estática y de unit CI **SIN BLOQUEANTES DE CÓDIGO** en `a20402a9`. H01/H02 se consideran corregidos; R1 queda histórica. No se aprobó ni mergeó la PR.
