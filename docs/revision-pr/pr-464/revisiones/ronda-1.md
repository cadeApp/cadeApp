# Revisión independiente — PR #464 / T-376 — ronda 1

**Revisor:** ChatGPT (independiente del autor) · **Fecha:** 2026-10-20 · **SHA revisado:** `9988b50b5ede65a13677f732c090c2826ac4d325` · **base develop:** `04f11839c659e67dbf32e8a80fa5da37819ce8d0`.

**Resultado: CON BLOQUEANTES (2). MEJORAS (1).** Revisión de diff, fuentes de flujo, ficha desde `develop`, CC-033 y bitácora. Todos los hallazgos son **[ANÁLISIS]**, no fallos ejecutados por el revisor.

## H01 — BLOQUEANTE · Formato PDF imposible pese a contrato y mensaje
**Archivo:** `src/features/courier-onboarding/components/document-replacement-card.tsx:137` y `src/features/courier-onboarding/components/document-upload-card.tsx:113` (este último es dependencia preexistente, pero lo usa el modo `add`).
**Diagnóstico:** el modo `add` usa `DocumentUploadCard`, que define `accept="image/jpeg,image/png,image/webp"`; después llama siempre `compressImage(file)`, que lanza ante `application/pdf`. Entretanto `COURIER_ONBOARDING_COPY.optionalDocumentSubtitle` ofrece «foto o PDF» y el CC-033 admite `pdf` en el path. El usuario no puede completar la modalidad anunciada.
**Evidencia:** inspección cruzada del input, `compressImage`, `getDocumentExtension`, uploader y CC-033. Los unit tests nuevos usan JPEG; el E2E nuevo usa PNG. Ninguno detectaría rechazar PDF.
**Solución recomendada:** admitir `application/pdf` solo en el modo `add`, mediante una prop de tipos permitidos en `DocumentUploadCard` cuyo valor predeterminado conserve el comportamiento anterior. En `DocumentReplacementCard`, para PDF omitir `compressImage` y subir el `File` sin alterar MIME/extensión. Validar MIME y máximo 10 MB antes de Storage. Imágenes continúan con compresión existente. No modificar `src/lib/image-compression.ts` ni esquemas/RPC. Agregar test que seleccione PDF válido y verifique `uploadCourierDocument` con MIME PDF, y otro con PDF demasiado grande que no suba.
**RED requerido:** nuevo caso PDF inicialmente falla en el flujo anterior; tras arreglo GREEN. Mutar temporalmente (fuente restaurada desde copia en memoria) para volver a excluir PDF o llamar `compressImage` para PDF debe dejar los casos en RED.

## H02 — BLOQUEANTE · Error NOT_FOUND irrecuperable con el mismo archivo
**Archivo:** `src/features/courier-onboarding/components/document-replacement-card.tsx:176-186` y `:89-162`.
**Diagnóstico:** tras `uploadCourierDocument` exitoso, `attempt.uploadConfirmed=true`. Si `addCourierOptionalDocumentAction` devuelve `NOT_FOUND` por objeto faltante en Storage, se muestra «Volvé a seleccionarlo para reintentar», pero `pendingAttemptRef.current` sigue guardando el mismo fingerprint y `uploadConfirmed=true`; la siguiente selección omite Storage y reenvía el path ausente. Repite el fallo hasta que se cambie el archivo o se recargue. Es contrario al DoD de permitir el reintento.
**Evidencia:** control `isSameAttempt`, condición `!attempt.uploadConfirmed`, rama `if (!result.ok)`; el test `NOT_FOUND` existente verifica solo el mensaje, nunca segunda carga. El CC-033 devuelve `NOT_FOUND` si no existe `storage.objects`.
**Solución recomendada:** únicamente ante `mode==='add' && result.code==='NOT_FOUND'`, invalidar el intento (`pendingAttemptRef.current=null`) para que una nueva selección del mismo archivo cree otro timestamp/path y UUID, y vuelva a subir. No invalidar en excepciones de red ni por `INTERNAL_ERROR` incierto: ahí se conserva idempotencia y path para evitar duplicados. Añadir test de primer envío Storage OK + RPC NOT_FOUND; segunda selección del mismo archivo sube otra vez con path y clave nuevos y puede terminar en `submitted`. Mantener el test de excepción de red que exige un solo upload y la misma clave.
**RED requerido:** test de recuperación nuevo falla antes del arreglo; tras GREEN, mutar el reinicio de intento para que no ocurra debe volver a RED.

## H03 — MEJORA · El E2E no recorre el visor auditado ni el botón de validar
**Archivo:** `e2e/specs/courier-onboarding.spec.ts:1733-1741`.
**Diagnóstico:** el E2E crea un administrador con AAL2 y ejecuta directamente `adminClient.rpc('admin_verify_document', ...)`. Esto sí prueba la RPC real y la insignia comercial posterior, pero no prueba que un aprobado con documento opcional nuevo pueda abrirlo desde la cola, ver el archivo con auditoría y validarlo mediante la pantalla existente, como pide el DoD de admin. El badge de la cola sí tiene unit tests.
**Sugerencia:** ampliarlo para entrar a `/admin/applicants` y al detalle, abrir el documento con el visor auditado, verificar vía UI y comprobar transición. No debilitar el oráculo de DB/insignia ya agregado. Puede abordarse junto con los bloqueantes para ahorrar rondas.

## Alcance / contrato / no tocar
Los 12 archivos cambiados pertenecen a los globs de la ficha. La ficha cambió fechas/decisiones, no amplió los archivos ni el DoD. Se consume la RPC existente mediante cliente de sesión; no hay cambios de schema/RLS, domain, tipos o wrappers. El aviso `audit` es preexistente y no justifica debilitar gates.

## Evidencia y estado de CI
- HEAD de código comparado mecánicamente contra la base: GitHub compare indica 2 commits ahead, 0 behind, `mergeable=true`; sin prueba local `git merge-tree`.
- CI del mismo SHA: `unit` exitoso (`153` files, `3033` tests), `lint`, `typecheck`, `build`, `bundle-budget` exitosos. `audit` falla: Vite GHSA-587h-7wmj-h5pm (la base `develop` también tiene check `audit` fallido).
- `approval-policy` fallaba antes de publicar este informe. `db-tests` todavía ejecutándose en el momento de la lectura; no se adjudica resultado.
- Bitácora declara M1–M7 RED→GREEN, E2E del caso GREEN en Preview de `cba9263a`, y gate local con 1 fallo/1 flaky; reejecuciones parciales verdes. Evidencia del autor **no reproducida independientemente**.
- El entorno de esta revisión no tiene checkout del repositorio ni acceso DNS a GitHub desde consola. No se ejecutó Vitest, Playwright, ni mutaciones propias en este entorno; no se afirma `verificado-runtime` ni `verificado_en_sha`.

**Para cierre en otra ronda:** resolver H01/H02; observar nuevos RED→GREEN y mutaciones independientes; esperar E2E CI completo sobre último HEAD sin bloqueantes; conservar el `audit` preexistente como trabajo separado sin marcarlo verde.
**No se aprobó ni mergeó.**
