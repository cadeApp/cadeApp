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
- **R1 / PDF:** test nuevo de `application/pdf` debe ir RED en `9988b50`; después GREEN con el arreglo. Mutación temporal del nuevo código: omitir PDF de `accept` y forzar `compressImage` para PDF. El test de PDF debe fallar otra vez.
- **R2 / NOT_FOUND:** test nuevo: Storage confirma path A, RPC devuelve `NOT_FOUND`; misma selección vuelve a subir con path B y clave B y luego RPC acepta `submitted`. En `9988b50`, el test debe fallar por un solo upload; después GREEN. Mutar temporalmente el reset de `pendingAttemptRef` a no-op; debe volver a RED.
- **R3 / regresión de red:** acción arroja `TypeError('Failed to fetch')`, retry con mismo archivo: mismo path, mismo UUID, un solo upload. Mutación temporal `isSameAttempt=false` debe producir RED; tras restaurar GREEN.
- **R4 / admin real:** test opcional: abrir visor con UI de admin AAL2 y validar documento nuevo. Mutación temporal de botón/handler de verificación debería producir RED.

Para cada mutación: conservar texto original en variable de memoria, modificar en worktree desechable sin commit, correr control sin mutar y mutado, restaurar desde la variable original en `finally` (nunca `git checkout` para revertir mutaciones), guardar líneas `Tests` y salida, y verificar `git diff --exit-code`. No se presenta un harness ejecutado donde no lo hubo.
