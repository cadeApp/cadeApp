# Evidencia y comandos — PR #464, ronda 1

## Evidencia disponible
- SHA `9988b50b5ede65a13677f732c090c2826ac4d325`, obtenido del conector GitHub.
- Archivo fuente `document-upload-card.tsx`: el input declara `accept="image/jpeg,image/png,image/webp"`; `image-compression.ts` usa `isSupportedImageType` y rechaza PDF.
- `document-replacement-card.tsx`: `compressImage(file)` incondicional; tras éxito de Storage guarda `uploadConfirmed=true`; `NOT_FOUND` no limpia el intento.
- `e2e/specs/courier-onboarding.spec.ts`: `adminClient.rpc('admin_verify_document')` en lugar de interacción con visor/botón.
- CI unit: `Test Files 153 passed (153)`, `Tests 3033 passed (3033)` en SHA indicado; `audit`: GHSA-587h-7wmj-h5pm; base develop también falla audit.

**Limitación:** no había checkout/módulos instalados ni acceso DNS git desde consola; no se corrieron pruebas, E2E ni mutaciones de revisión. Los resultados RED/GREEN M1–M7 y los E2E de la bitácora son reportados por el AUTOR, sin reclasificarlos como reproducción independiente.

## Pasos para reproducir después de los arreglos (en checkout limpio del nuevo SHA)
1. `git fetch origin` y confirmar `git rev-parse HEAD` = HEAD del PR; ejecutar en worktree limpio; no tocar DB remota ni secretos.
2. `pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/courier-onboarding/actions.test.ts src/features/admin/components/applicant-detail-view.test.tsx`
3. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
4. Local Playwright contra Preview de ese mismo SHA y Supabase Develop usando el gate aprobado: `CI=true pnpm exec playwright test e2e/specs/courier-onboarding.spec.ts --project=chromium --workers=1` con la misma configuración `global-settings`/fixtures/retries que `e2e-preview`. No se ejecutó acá.

## Batería independiente prevista (nueva, no M1–M7 del autor)
- **R1 / copy y MIME:** test nuevo aserta `DocumentUploadCard` con `accept=image/jpeg,image/png,image/webp` y que `optionalDocumentSubtitle` NO promete PDF. Debe ir RED en `9988b50` por el copy. Tras corregir texto debe dar GREEN; mutación temporal del copy para volver a prometer PDF debe provocar RED. Soporte de PDF de punta a punta con visor auditado: issue #465, fuera de esta PR.
- **R2 / NOT_FOUND:** test nuevo: Storage confirma path A, RPC devuelve `NOT_FOUND`; misma selección vuelve a subir con path B y clave B y luego RPC acepta `submitted`. En `9988b50`, el test debe fallar por un solo upload; después GREEN. Mutar temporalmente el reset de `pendingAttemptRef` a no-op; debe volver a RED.
- **R3 / regresión de red:** acción arroja `TypeError('Failed to fetch')`, retry con mismo archivo: mismo path, mismo UUID, un solo upload. Mutación temporal `isSameAttempt=false` debe producir RED; tras restaurar GREEN.
- **R4 / admin real:** test opcional: abrir visor con UI de admin AAL2 y validar documento nuevo. Mutación temporal de botón/handler de verificación debería producir RED.

Para cada mutación: conservar texto original en variable de memoria, modificar en worktree desechable sin commit, correr control sin mutar y mutado, restaurar desde la variable original en `finally` (nunca `git checkout` para revertir mutaciones), guardar líneas `Tests` y salida, y verificar `git diff --exit-code`. No se presenta un harness ejecutado donde no lo hubo.

## Seguimientos creados
- #465: soporte PDF integral, incluido visor auditado.
- #466: actualización de dependencia para resolver advisory preexistente de Vite.

## Ronda 2 — SHA de código `39aed042565c649827c917cd8a1816d5f80aba8a`, bitácora `16163488`

- Revisión por GitHub API del diff de R1 a SHA funcional: `src/features/courier-onboarding/{copy.ts,components/document-replacement-card.tsx,components.test.tsx}` y `e2e/specs/courier-onboarding.spec.ts`; sin cambios fuera de ficha. De funcional a último HEAD solo `docs/tasks/log/T-376.md`.
- H01 código: subtitle solo fotos; `ADD_ACCEPTED_TYPES = ['image/jpeg','image/png','image/webp']`; guarda antes de `compressImage`; test PDF y texto sin subir.
- H02 código: en rama `!result.ok`, si `mode==='add' && result.code==='NOT_FOUND'`, `pendingAttemptRef.current=null`; test selecciona dos veces mismo `File`, simula dos paths y distinta idempotencyKey.
- H03 E2E: login admin/MFA, navegación a detalle, pestaña seguro, carga visor, botón verificar, polling de status `verified`, auditoría `view_courier_document` filtrada por `target_id`, insignia comercio.
- CI `unit` job 118951031248 en SHA 39aed042: `Test Files 153 passed (153)`, `Tests 3037 passed (3037)`, workflows 79/79, ADR 6/6.
- CI `db-tests` job 118951030741: `toomanyrequests: Data limit exceeded` repetido al intentar descargar imagen, luego cancelado. No equivale a DB passing.
- `approval-policy` job 118950893961: `Falta el informe completo de revisar-pr sin bloqueantes.`; su código base busca exactamente el informe en la sección `### Informe de revisión de agy` del **BODY del PR**, no del comentario. Se añadió la sección al body antes del commit documental de R2, para próxima evaluación.
- Mutaciones M8–M10 y E2E 1 passed (56.8s), 1 passed (45.3s): **declara el autor** en bitácora. No reproducidos por esta revisión. `verificado_en_sha=null` en hallazgos estructurados.
- **Restricción:** consola del revisor sin red DNS a github.com ni checkout, por lo que no fue posible correr comandos ni mutaciones propias. No se inventa script ejecutado. Los casos recomendados de la ronda 1 permanecen reproducibles en checkout real.

**Gate para la última pasada:** `pnpm typecheck && pnpm lint && pnpm test`; validar desde GH Actions unit/DB/audit/build/bundle y `e2e-preview` del SHA final, sin ejecutar workflows desde revisión. No requerir nueva corrida solo por edición documental, pero verificar el CI final acordado.
