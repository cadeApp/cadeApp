# Informe revisar-pr — T-387 — PR #470 — ronda 1

**Fecha local:** 2026-10-20. **Revisor:** ChatGPT, revisión independiente del autor.
**HEAD inspeccionado:** `dbdc4b322e614adeb4115f35f44678ea9c29989f` (base `c702271f5291aeca62d87d18b4d7f582132765c2`).
**Resultado: CON BLOQUEANTES (3) · MEJORA (1).**

La PR crea la ficha T-387 (`docs/tasks/T-387.md`) y añade una fila a `docs/implementation-plan.md`. La ficha todavía **no existe en develop**: el alcance nuevo se compara contra el issue #465, contratos CC-025/CC-033 y los consumidores existentes; no se presenta como modificación de una ficha ya mergeada. El diff no incluye código ni nuevas dependencias. La API Compare mostró 2 commits ahead, 0 behind; GitHub informa mergeable, pero no se ejecutó merge-tree local.

## PR470-H01 — BLOQUEANTE · Primer DoD desincronizado con `8 del plan

**Archivo:** `docs/tasks/T-387.md:54-57` y `docs/implementation-plan.md:413`; control `tools/verify-fichas.test.ts:149-165`.

El primer DoD comienza con «Alta y reemplazo de licencia o seguro aceptan PDF», pero la columna sexta de aceptación del plan comienza con «El repartidor sube la licencia o el seguro como PDF». El test del repositorio compara ambas cadenas mediante desigualdad estricta (`m?.[1]?.trim() !== esperado`); por tanto no están sincronizadas. **Verificación por inspección, no resultado de Vitest ejecutado.**

**Arreglo de autor:** igualar literalmente el primer ítem del DoD y la aceptación del plan, manteniendo los subtareas detalladas debajo. Unificar 10 MiB (10.485.760 bytes) en ambos textos antes de copiarlos. Prueba prevista: `pnpm exec vitest run tools/verify-fichas.test.ts`. Mutación propia: alterar un término solo en el primer DoD debe dar RED, restaurarlo GREEN.

## PR470-H02 — BLOQUEANTE · Falta el registro inicial entre los caminos PDF

**Archivo:** `docs/tasks/T-387.md:29-39,54-57,89-93`. Código preexistente `src/features/courier-onboarding/components/vehicle-form.tsx:135-145,412-423`.

La clase completa de carga comprende: `VehicleForm.handleOptionalUpload` (licencia/seguro en registro inicial), `DocumentReplacementCard mode="add"` (perfil, no cargado), y `mode="replace"` (documento rechazado). El primer flujo reutiliza `DocumentUploadCard` y siempre pasa por `compressImage(file)`, que en `src/lib/image-compression.ts` rechaza MIME `application/pdf`. La ficha no incluye `vehicle-form.tsx`. Habilitar PDF solo en el selector común dejaría roto el registro inicial.

**Decisión D01=C confirmada:** habilitar los tres caminos con preparación/validación centralizada por `kind`; agregar `src/features/courier-onboarding/components/vehicle-form.tsx` al alcance, cubierto por `components.test.tsx` y `e2e/specs/courier-onboarding.spec.ts`. El DoD debe exigir registro inicial PDF válido sin compresión, límites MIME/firma/tamaño y E2E, además del E2E del perfil. Mutación futura: volver a comprimir PDF debe producir RED real, no tests ficticios.

## PR470-H03 — BLOQUEANTE · Alcance escrito con llaves no literales

**Archivo:** `docs/tasks/T-387.md:29-40` y `docs/implementation-plan.md:413`.

El permiso `src/features/courier-onboarding/components/{document-upload-card,document-replacement-card}.tsx` y otros `{a,b}` son abreviaturas de Bash, no rutas individuales. `tools/verify-fichas.test.ts:25-30` interpreta paths exactos o `**` al final, sin expansión de llaves. **Aclaración:** ese test solo inspecciona ciertos permisos, por lo que NO se afirma que hoy falle por este caso; el problema es la interpretación no inequívoca de la autorización.

**Corrección de autor:** enumerar paths concretos, sin llaves, tanto en permisos de ficha como en la fila resumida del plan si esta conserva la abreviatura. Incluir `vehicle-form.tsx`. Control estático reproducible: ningún path entre backticks de «Archivos permitidos» debe contener llaves; mutación que las reintroduce da RED.

## PR470-H04 — MEJORA · Aclarar límite binario

**Archivo:** `docs/tasks/T-387.md:14,22,61,77,85` y resumen del plan.

El bucket `courier-docs` fija `file_size_limit = 10485760` bytes en `supabase/migrations/20260922051650_rls_v1.sql`. Esto equivale exactamente a **10 MiB (10.485.760 bytes)**, mientras la ficha dice «10 MB», potencialmente interpretado como 10.000.000 bytes. En ficha/plan escribir tamaño exacto; en tests de futura implementación, `10485760` pasa y `10485761` se rechaza. No cambiar el bucket ni las migraciones.

## Decisiones resueltas — no delegarlas al agente

**D01: C.** Registro inicial, perfil y reemplazo con función compartida de preparación/validación; `vehicle-form.tsx` entra al alcance y se exigen pruebas unitarias/E2E. Supera A (duplicación de lógica) y B (flujo inicial sin PDF) porque reduce divergencias manteniendo paridad de UX.

**D02: C.** DNI, selfie y avatar solo fotos en selector/UI. Se mantienen los contratos existentes, que ya pueden admitir rutas .pdf. El visor admin interpreta PDF por el tipo derivado **en servidor** del `storage_path` y debe mostrar un PDF aunque su `kind` sea distinto de license/insurance. Frente a A (dejarlo documentado sin cobertura de lectura) y B (nuevo CC y restricciones SQL), evita incompatibilidad sin ampliar carga UI.

## Invariantes correctos a conservar

CC-025/CC-033 ya aceptan .pdf en path; el bucket privado ya acepta `application/pdf` y 10 MiB. `viewCourierDocumentAction` ya exige AAL2 y emite URL de 60 segundos con auditoría `view_courier_document`; la tarea debe preservar los tres controles, no filtrar URLs a logs, y alternar `iframe` para PDF con `img` para imágenes sin depender solo de `kind`. Es correcto incluir un enlace alternativo para móviles.

## Evidencia y checks

Revisión de diff, ficha, plan, issue, contratos y código por GitHub conectado. No hubo checkout usable para `pnpm` debido a DNS bloqueado hacia github.com. **typecheck, lint, unit, build, E2E, mutaciones, verify-fichas, merge-tree: NO EJECUTADOS.** `db-tests` no se requiere por la modificación documental, pero en la siguiente ronda se comprobará evidencia CI oficial por SHA si se busca declarar lista para merge. Arnés propio reproducible incluido en `evidencia/comandos.md`; sin salida RED/GREEN inventada.

**Cierre:** La ficha queda pendiente de corrección por el autor. No tocar ni reescribir ronda 1 cuando cambie el HEAD; generar ronda 2 con comparación real. No se aprobó ni mergeó.
