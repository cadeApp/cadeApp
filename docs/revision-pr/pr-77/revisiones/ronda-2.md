# PR #77 — Ronda 2 (verificación independiente del revisor)

- **SHA verificado:** `4271e2b` (HEAD) / `0eca79a` (commit de implementación)
- **Fecha:** 2026-09-24
- **Revisor:** agy-P1 (revisión independiente, no el autor)

> **Nota AG-36:** El autor (agy-P3) escribió su propia
> `autorrevision-agy-ronda-2.md` y modificó `hallazgos.jsonl` marcando
> todo como `arreglado-verificado`. Por AG-36 ("quien arregla no firma
> la verificación") esos campos no tienen validez. Esta ronda-2 es la
> verificación independiente del revisor.

---

## Checks locales sobre `4271e2b`

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ 0 errores |
| `pnpm lint` | ✅ 0 warnings / 0 errors |
| `pnpm test --run` | ✅ 35 suites · 294 tests · 0 failed |

## Scope

- **25 archivos** en diff (`git diff origin/develop...HEAD --stat`)
- **Todos dentro de "Archivos permitidos"** de T-121.md (verificado contra ficha en `origin/develop`)
- **Ficha T-121.md no modificada** por la PR (diff vacío)
- **Dependencias nuevas:** ninguna (verificado: no hay cambios en `package.json`)

## Verificación hallazgo por hallazgo

### PR77-H01 · Código productivo ausente → ✅ ARREGLADO
- **Método:** `git diff origin/develop...HEAD --stat` muestra 19 archivos de producción
  (`actions.ts`, `schemas.ts`, `upload-manager.ts`, `image-compression.ts`, 3 componentes,
  3 pages, `copy.ts`, `server.ts`, `index.ts`, etc.)
- **SHA:** `0eca79a`

### PR77-H02 · TypeScript errors por cast incorrecto → ✅ ARREGLADO
- **Método:** `pnpm typecheck` pasa con 0 errores. Verificado que
  `actions.test.ts` usa `Awaited<ReturnType<typeof serverAuth.createClient>>`
  en líneas 29, 69, 110 y 178.
- **SHA:** `0eca79a`

### PR77-H03 · mockInsertConsents y mockUpsertDocuments huérfanos → ✅ ARREGLADO
- **Método:** Inspección de `actions.test.ts` líneas 317–351. Se aserta
  `mockInsertConsents.toHaveBeenCalledTimes(1)` y
  `toHaveBeenCalledWith([{document:'tos',...}, {document:'privacy',...}, {document:'courier_contract',...}])`,
  y `mockUpsertDocuments.toHaveBeenCalledTimes(1)` con los 4 documentos
  obligatorios (`dni_front`, `dni_back`, `selfie`, `avatar`), cada uno con
  `status: 'submitted'` y `storage_path` que respeta el prefijo `courier/${courierId}/`.
- **SHA:** `0eca79a`

### PR77-H04 · jsdom ausente en image-compression.test.ts → ✅ ARREGLADO
- **Método:** Inspección de `image-compression.test.ts` línea 1:
  `// @vitest-environment jsdom` presente. La suite tiene 10 tests con Canvas
  mocks (`getContext`, `toBlob`, `Image` constructor). Pasa en verde.
- **SHA:** `0eca79a`

### PR77-H05 · Suite de pruebas roja por módulos faltantes → ✅ ARREGLADO
- **Método:** `pnpm test --run` arroja 35 suites, 294 tests, 0 failed.
  Las 3 suites de `courier-onboarding` (actions, image-compression,
  upload-resilience) + `components.test.tsx` pasan todas en verde.
- **SHA:** `4271e2b`

### PR77-H06 · DNI test sin columna `dni_hmac` ni status `suspended` → ✅ ARREGLADO
- **Método:** Inspección de `actions.test.ts`:
  - L91–157: test `rejected` → aserta `mockAdminEq.toHaveBeenCalledWith('dni_hmac', expectedHmac)`
  - L159–224: test `suspended` (caso independiente) → ídem
  - `expectedHmac` es determinístico (`'593c04e9d598...'` para DNI `38123456`)
- **SHA:** `0eca79a`

### PR77-H07 · Upload test ciego a Supabase Storage → ✅ ARREGLADO
- **Método:** Inspección de `upload-resilience.test.ts` bloque L169–297
  (`PR77-H07: Integración con Supabase Storage`):
  - `buildCourierStoragePath` aserta prefijo `courier/${courierId}/`
  - `uploadCourierDocument` aserta `mockStorageFrom('courier-docs')` y
    `COURIER_DOCS_BUCKET`
  - Test de error propaga `'Storage: Row-level security policy violated'`
  - Test de manager completo con storage client mockeado
- **SHA:** `0eca79a`

### PR77-H08 · Ausencia de pruebas R01/R02/R03 → ✅ ARREGLADO
- **Método:** `components.test.tsx` tiene 8 tests distribuidos en:
  - `StepIndicator` (1 test)
  - `IdentityForm / R01` (2 tests: renderizado + validación DNI)
  - `VehicleForm / R02` (3 tests: renderizado + patente condicional + submit)
  - `StatusView / R03` (1 test: estado en revisión)
  - Plus 1 test de validación de formato de patente
- **SHA:** `0eca79a`

### PR77-H09 · PR template incompleta → ✅ ARREGLADO
- **Método:** `gh pr view 77 --json body` muestra todos los checkboxes del DoD
  tildados (`[x]`) y evidencia de `pnpm typecheck/lint/test` pegada en el body.
- **SHA:** `4271e2b`

## Hallazgos nuevos de ronda 2

### PR77-H10 · Colisión de numeración AG-64 / AG-65 con PR #76

| Campo | Valor |
|---|---|
| **Severidad** | bajo |
| **Categoría** | docs |
| **Patrón** | P19-cuerpo-de-pr-fuera-de-template |
| **Bloqueante** | No |

PR #76 (T-113) fue mergeada a `develop` con `AG-64` y `AG-65` en
`docs/revision-pr/pr-76/lecciones.md`. PR #77 también usa AG-64 y AG-65 pero
para lecciones distintas. **Deben renumerarse a AG-66 y AG-67** en esta rama
antes del merge para evitar colisión.

**Estado:** abierto (pendiente de corrección por el revisor en este commit).

## Veredicto

**SIN BLOQUEANTES.** Los 9 hallazgos de ronda 1 fueron verificados
independientemente como arreglados. El único hallazgo nuevo (H10, colisión de
AG) es no-bloqueante y se corrige en este mismo commit.

**Estado final: APTO para merge** (a discreción de Lautaro073/P1).
