# Informe de revisión independiente — PR #464 / T-376 — Ronda 2

**Revisor:** ChatGPT (revisión independiente, distinto del autor) · **Fecha:** 2026-10-20
**SHA FUNCIONAL revisado:** `39aed042565c649827c917cd8a1816d5f80aba8a`
**SHA más reciente al revisar (bitácora únicamente):** `16163488c4da6737cba3cfc8bc21036ada1ea5f0`
**Base develop:** `04f11839c659e67dbf32e8a80fa5da37819ce8d0`

## Resultado

**SIN BLOQUEANTES DE CÓDIGO DETECTADOS POR INSPECCIÓN.** No es autorización de merge: faltan las condiciones operativas de CI oficial (incluido `e2e-preview` y `db-tests`). `audit` falla por vulnerabilidad heredada #466.

Esta ronda revisó el diff funcional desde R1, las fuentes completas, los casos de prueba nuevos, las mutaciones M8–M10 documentadas, el E2E y los logs de GitHub Actions. **No hay checkout con dependencias ni acceso DNS git en esta sesión**, por lo que no corrimos Vitest, Playwright ni mutaciones nuevas del revisor. **No se certifica ejecución independiente de los arreglos.** Los tres hallazgos anteriores pasan de `abierto` a `arreglado-sin-verificar` (en ejecución); `verificado_en_sha = null` en el JSONL.

## Hallazgos R1 reexaminados

### PR464-H01 — resuelto por inspección; ejecución propia pendiente

**Código:** `src/features/courier-onboarding/copy.ts`, `components/document-replacement-card.tsx`, `components.test.tsx`.

- Copy de modo alta: `Seleccioná una foto clara: JPG, PNG o WebP.`; `DocumentUploadCard` admite `image/jpeg,image/png,image/webp`. La implementación valida el MIME en `mode==='add'` **antes** de pasar por `compressImage`/Storage.
- Unit nuevos verifican `accept` y copy, rechazos de `application/pdf` y `text/plain` sin RPC ni upload, con error accesible.
- La bitácora reporta M8 (copy PDF) y M9 (deshabilitar guarda MIME) en RED y restauradas a GREEN (test ejecutado por autor). No se confunden con mutaciones independientes.
- Mantener soporte PDF de punta a punta en #465: el visor admin actual usa `<img>`; ampliar solo el selector sería un fallo de producto.

**Estado:** `arreglado-sin-verificar` (inspección positiva + unit CI, sin ejecución independiente).

### PR464-H02 — resuelto por inspección; ejecución propia pendiente

**Código:** `src/features/courier-onboarding/components/document-replacement-card.tsx` dentro de `if (!result.ok)`.

- Si `mode==='add' && result.code==='NOT_FOUND'`, reinicia `pendingAttemptRef.current = null`. El mismo `File` provoca nueva llamada a Storage y nueva clave en el reintento.
- No borra el intento ante errores de conexión ni respuesta incierta: se conserva la misma clave y se evita resubir. Prueba original de red sigue presente.
- Nuevo test repite selección de `File`, simula `NOT_FOUND` y comprueba 2 uploads y nueva clave y path. Bitácora M10: mutación del reset a no-op hizo RED; restauración GREEN (autor).
- Límite menor del test: el mock de uploader retorna dos paths prefijados distintos. No compara los timestamps pasados al uploader; es suficiente para la regresión original (solo un upload), aunque podría robustecerse frente a coincidencia de `Date.now()`. No se clasifica bloqueante: el sistema solo permite reselección interactiva y el reset solicitado está presente.

**Estado:** `arreglado-sin-verificar` (inspección positiva + unit CI, sin ejecución independiente).

### PR464-H03 — mejora implementada, inspección positiva

**Archivo:** `e2e/specs/courier-onboarding.spec.ts`.

- Reemplaza la llamada directa de test `admin_verify_document` por inicio de sesión del admin con contraseña, MFA TOTP, navegación a `/admin/applicants/<courierId>`, selección del seguro, visor seguro, botón `Verificar documento`.
- Oráculo después del clic: consulta real de `courier_documents.status='verified'`; consulta `audit_log` con `action='view_courier_document'` y `target_id=documentId`; conserva comprobación antes/después de la insignia visible al comercio.
- La señal en la cola de aprobados permanece cubierta por unit; el E2E navega directo al detalle para evitar depender del orden/paginación en Develop compartido (decisión razonable, sin debilitar la prueba del visor).
- La bitácora declara dos E2E Chromium verdes con `CI=true`, `--workers=1`, sin reintentos (56.8 s y 45.3 s) contra Preview de `39aed042`. No se reprodujeron independientemente.

**Estado:** `arreglado-sin-verificar` (mejora está en código y E2E declarado por autor).

## Revisión de alcance y control de proceso

- Diferencia R1→SHA funcional: 4 archivos de código/pruebas (`copy.ts`, `document-replacement-card.tsx`, `components.test.tsx`, E2E) y los 5 archivos creados por esta revisión en R1, **todos autorizados** por ficha.
- SHA `16163488` después de `39aed042` modifica **solo la bitácora** `docs/tasks/log/T-376.md`. La carpeta `docs/revision-pr/pr-464/**` no fue modificada por el autor desde el commit de revisión.
- No se tocan RPC, migrations, RLS, dominio, wrappers, ni tipos. No hay código de test-only/debilitamiento de checks, `.skip` o `.only` en el diff funcional revisado.
- No hay decisiones abiertas de producto para T-376.

## Evidencia de CI

| Prueba | SHA `39aed042` | Conclusión |
|---|---|---|
| unit | 153 archivos / **3.037 tests passed** | ✅ en CI |
| typecheck | success | ✅ |
| lint | success | ✅ |
| build | success | ✅ |
| bundle-budget | success | ✅ |
| db-tests | Docker rate limit (`toomanyrequests: Data limit exceeded`), job cancelado al siguiente push | ⚠️ no certificado |
| audit | GHSA-587h-7wmj-h5pm, también presente en develop | ❌ preexistente, #466 |
| approval-policy | fallo anterior a informe R2 sin bloqueantes | Pendiente reevaluar; el informe formal se añadió al body de PR |
| e2e-preview oficial | no ejecutado por acuerdo de rondas | **Pendiente del último push** |

**Evidencia de autor:** suite focal 591/591, mutaciones M8–M10 RED→GREEN y dos E2E verdes; sus resultados están en `docs/tasks/log/T-376.md`. **No fueron corridos por este revisor.** El CI 3.037/3.037 sí tiene log reproducible del job en el SHA `39aed042`.

## Recomendación final de ronda 2

**Cierre técnico por inspección sin bloqueantes nuevos**, manteniendo datos estructurados como corregidos **sin verificación independiente de ejecución**. Revisar que los jobs oficiales del SHA FINAL arrojen DB verde y `e2e-preview` verde, además de gates habituales. No arreglar GHSA alterando pruebas de T-376: resolver #466 en su tarea, documentando cualquier excepción aprobada antes del merge. No mergear, no aprobar, no declarar CI global green.

No exigir otro CI verde solo por actualizar esta carpeta/bitácora: se requiere una única ejecución final completa según la decisión de Lautaro073, sin reanudar rondas por commits de documentación.
