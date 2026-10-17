# Revisión independiente — PR #358 / T-356 — Ronda 3 (2026-10-17)

**Resultado: CON BLOQUEANTES (H03/H04/H05), no mergear.**
HEAD funcional/documental inspeccionado: `af4838a6cda959288651f54c2b93e3c75aa33441` (código final funcional `a158c29c80cd81a225c7525be87d3fed67a5a7b9`). PR Draft, base GitHub `develop@293c3a2756509a5fb6e82ee6bc841197c143f9c9`, develop remoto `711a2f7054d77fd664d3ec09b3bbdd24efb88476`; diverged 58 behind, 18 ahead, mergeable_state=dirty.

## Decisión humana de esta ronda (cerrada)
**Opción A autorizada por Lautaro073 el 2026-10-17:** separar la reconciliación/purga segura de objetos privados sin referencia en [issue #399](https://github.com/cadeApp/cadeApp/issues/399), **bloqueante antes de cualquier promoción de CC-025 a staging o main**, pero **no bloqueante por sí sola de un futuro merge UI #358 a develop**. Se registró dependencia en issue #363, que permanece abierto. Ninguna autorización de merge ni deploy remoto fue concedida. Es **riesgo de orfandad por diseño**, no evidencia de huérfanos observados en remoto.

## Revalidación Ronda 2
- **PR358-R01 — PARCIAL:** `DocumentReplacementCard` mantiene `PendingAttempt` por `kind` + fingerprint, misma clave UUID, timestamp/ruta y saltea resubida cuando `uploadConfirmed`; tests del autor verifican misma clave/path y un solo upload tras fallo RPC. No se reejecutó una mutación de runtime independiente. Persisten posible upload ambiguo y orfandad a tratar en #399. No dar por cerrada limpieza.
- **PR358-R02 — ARREGLADO-SIN-VERIFICAR:** `StatusView` y `CourierProfileView` propagan `onReplaced`, actualizan estado local y llaman `router.refresh`; inspección y pruebas del autor. Se detecta un detalle adicional en el encabezado (H04).
- **PR358-R03 — ARREGLADO-SIN-VERIFICAR:** E2E usa `admin_verify_document` con TOTP AAL2, motivo público + nota privada centinela, replacement UI y visor admin vigente/histórico. [E2E confiable sobre HEAD exacto](https://github.com/cadeApp/cadeApp/actions/runs/39040606398), job `117419231897`: **83/83 Chromium PASS** y **3/3 global-settings PASS**, target Supabase Develop verificado. Es test del autor corrido por CI; no mutación independiente del revisor.
- H01/H02 de Ronda 1: `arreglado-sin-verificar` como previamente. Se respetó el contrato RPC autenticada y las decisiones 1C,2C,3B,4C; retención histórica 30 días permanece.

## Hallazgos de Ronda 3
### PR358-H03 — MEDIO / BLOQUEANTE: fallback inválido de UUID
`src/features/courier-onboarding/components/document-replacement-card.tsx`, rama de construcción de `PendingAttempt` (~línea 78). Si `crypto.randomUUID` falta, genera `idemp-...`, que no cumple el UUID Zod de `replaceCourierDocumentAction`. Puede subir el binario y luego fallar la action, añadiendo huérfano. **Corregir:** fallar cerrado ANTES de subir/compresión sin generador UUID seguro, o usar otro generador UUID criptográficamente seguro validado por el mismo esquema. Test `crypto.randomUUID` no disponible => no Storage/no RPC, error seguro; mutación que reintroduce `idemp-` debe dar RED.
### PR358-H04 — MEDIO / BLOQUEANTE UX: título «requieren corrección» tras resolver todos
`src/features/courier-onboarding/components/status-view.tsx` (~línea 227). El ref de kinds inicialmente rechazados retiene tarjetas de resultado (deseable), pero el encabezado fijo `Documentos que requieren corrección` permanece aunque ninguna fila vigente esté `rejected`. Mostrar encabezado condicional apropiado sin ocultar confirmación; test tras último reemplazo y caso mixto de otro rechazado restante; mutación de título fijo => RED.
### PR358-H05 — ALTO / BLOQUEANTE de integración: rama desactualizada y conflictos
PR `mergeable_state=dirty` y `develop` 58 commits adelante. Cinco archivos modificados en ambas ramas: `e2e/specs/courier-onboarding.spec.ts`, `actions.test.ts`, `actions.ts`, `components.test.tsx`, `courier-profile-view.tsx`. **Exigir merge normal de `origin/develop`, sin rebase/force/amend**, resolver conflictos preservando invariantes y ficha desde develop; validar `git merge-tree --write-tree origin/develop HEAD`, tests focalizados y CI + E2E del nuevo HEAD resultante. El estado mergeable puede cambiar mientras se revisa: verificar de nuevo.

## CI y alcance
- Preview E2E `39040606398` sobre `af4838a6`: todos los pasos reales, health, selección de Supabase Develop, 83/83 Chromium, 3/3 visual PASS; check `e2e-preview` success publicado en ese SHA.
- Workflow `approval-policy` `39040538607` SUCCESS. **No se observó nuevo CI unit/db completo en el SHA documental**: la bitácora atribuye typecheck/lint/test anteriores al autor y en la Ronda 2 se inspeccionaron logs unit/db del SHA antiguo. Revalidar tras código y merge con develop.
- **Verificación del revisor:** inspección del HEAD remoto, comparación base/head, análisis de componentes/specs y logs CI; no se corrieron tests/mutaciones independientes locales ni SQL remoto. No etiquetar `arreglado-verificado` sin ejecución independiente.

## Alcance/cierre
Ronda documental commiteada únicamente en `docs/revision-pr/pr-358/**`; **no** se aprobó, mergeó, promovió, ni se cambió código funcional. Nuevo [issue #399](https://github.com/cadeApp/cadeApp/issues/399) es dependencia pre-staging/main. PR #358 podrá reconsiderarse para develop tras corregir H03/H04/H05 y validación nueva del HEAD. No cerrar issue #363 ni promover C remotamente. Prompt técnico completo en el mismo comentario de esta ronda.
