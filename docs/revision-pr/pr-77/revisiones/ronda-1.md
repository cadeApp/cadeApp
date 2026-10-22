# Informe de Revisión — PR #77 — Ronda 1

**Tarea:** T-121 (Fase 1: Núcleo transaccional y flujos) — Issue #24  
**Rama:** `feat/T-121-courier-onboarding` → `develop`  
**SHA revisado:** `29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c`  
**Base:** `origin/develop` @ `b6b5f3952cb5964071bb548673165285ffa2d639`  
**Fecha:** 2026-09-24  
**Revisor:** Revisión independiente (Antigravity)  
**Resultado:** ❌ CON BLOQUEANTES (5 bloqueantes, 4 mejoras, 0 decisiones pendientes)  
**Checks locales:** `typecheck` ❌ (7 errores) · `lint` ✅ · `test` ❌ (3 suites rotas) · `test:db` n.a.

---

## Resumen Ejecutivo

La PR #77 fue abierta en estado **Draft** por el agy de P3 tras redactar la fase inicial de TDD (Regla 40) con 3 suites de prueba (`actions.test.ts`, `image-compression.test.ts`, `upload-resilience.test.ts`).

El cuerpo del PR describe como implementadas funcionalidades centrales que **no existen en la rama ni en el árbol**: la compresión client-side en `src/lib/image-compression.ts`, la Server Action de onboarding en `src/features/courier-onboarding/actions.ts`, el gestor de subidas a storage `courier-docs`, y las vistas de onboarding R01, R02 y R03 en `src/app/(courier)/onboarding/**`. Sin commits en la rama no existe código productivo ni SHA verificable.

Adicionalmente, se detectan vicios en los tests preliminares:
1. Errores de tipado TypeScript (`TS2345`) en `actions.test.ts` por casteo erróneo de la promesa devuelta por `createClient` dentro de `mockResolvedValue`.
2. Pruebas ciegas en `actions.test.ts`: los espías `mockInsertConsents` y `mockUpsertDocuments` se declaran en el setup pero nunca se asiertan en el desenlace del test, permitiendo que una acción que omita persistir consentimientos y documentos pase en verde (`P08-control-no-cubre-lo-que-dice`).
3. El test de compresión de imágenes asume Canvas nativo pero omite `// @vitest-environment jsdom`, provocando fallos inmediatos al ejecutarse en el runtime Node.js por defecto.

---

## 1. `PR77-H01` · Trabajo principal declarado en la descripción del PR no está commiteado ni en la rama · **BLOQUEANTE**

- **Archivo:** `docs/tasks/log/T-121.md:18`, PR #77 (cuerpo)
- **Severidad:** `critico` | **Categoría:** `test-coverage` | **Patrón:** `P15-entregable-declarado-pero-no-ejecutable`
- **Qué pasa:** El cuerpo de la PR declara como completado:
  - Compresión de imágenes client-side en `src/lib/image-compression.ts` (< 500 KB) con Canvas API nativa.
  - Subida resiliente a storage privado `courier-docs` con estado reactivo independiente por documento y reintentos ante cortes de red.
  - Server Action de onboarding (`src/features/courier-onboarding/actions.ts`) con hashing HMAC-SHA256 (`dni_hmac`) y bloqueo de DNI de repartidores rechazados o suspendidos.
  - Vistas de onboarding (`src/app/(courier)/onboarding/**`): identidad/documentos (R01), vehículo/consentimientos (R02), estado en revisión (R03).
  Sin embargo, en el diff real respecto a `develop` solo existen 3 archivos de prueba y la bitácora (`actions.test.ts`, `image-compression.test.ts`, `upload-resilience.test.ts`). La propia bitácora en su sección «Falta» consigna que no se ha implementado nada del código de producción. Sin código commiteado no hay SHA para verificar.
- **Qué hay que hacer:** Implementar los módulos de negocio, Server Action, componentes y pantallas dentro de los «Archivos permitidos» de la ficha `T-121` y commitear a la rama.
- **Evidencia:** `git diff origin/develop...HEAD --stat` solo lista 4 archivos. No existen `src/lib/image-compression.ts`, `src/features/courier-onboarding/actions.ts` ni `src/app/(courier)/onboarding/**`.

---

## 2. `PR77-H02` · `pnpm typecheck` falla con 7 errores de compilación TypeScript · **BLOQUEANTE**

- **Archivo:** `src/features/courier-onboarding/actions.test.ts:24, 51, 92, 159`, `image-compression.test.ts:7`, `upload-resilience.test.ts:6`
- **Severidad:** `alto` | **Categoría:** `correctness` | **Patrón:** `P01-contrato-de-framework-no-verificado`
- **Qué pasa:** `pnpm typecheck` arroja 7 errores de compilación:
  - 3 errores `TS2307: Cannot find module` por importar `./actions`, `@/lib/image-compression` y `./upload-manager` que aún no existen en el disco.
  - 4 errores `TS2345: Argument of type 'Promise<SupabaseClient...>' is not assignable to parameter of type 'SupabaseClient...'` en `actions.test.ts` (líneas 24, 51, 92, 159). La función `createClient` de `src/server/supabase/server.ts` es `async` y retorna `Promise<SupabaseClient<Database>>`. Los tests hacen:
    ```ts
    vi.mocked(serverAuth.createClient).mockResolvedValue({
      ...
    } as unknown as ReturnType<typeof serverAuth.createClient>);
    ```
    Al pasar un tipo `Promise<...>` a `mockResolvedValue`, Vitest/TypeScript espera el tipo desenvuelto (`Awaited<ReturnType<...>>`), fallando el chequeo estricto de tipos.
- **Qué hay que hacer:** Implementar los módulos faltantes y corregir el casteo en los mocks de `actions.test.ts` usando `Awaited<ReturnType<typeof serverAuth.createClient>>` o simplificando la inicialización del mock sin promesas anidadas.
- **Evidencia:**
  ```bash
  pnpm typecheck
  ```
  Salida: 7 errores `TS2307` y `TS2345`.

---

## 3. `PR77-H03` · Test de persistencia de onboarding no afirma la inserción de consentimientos ni documentos (`mockInsertConsents` y `mockUpsertDocuments` huérfanos) · **BLOQUEANTE**

- **Archivo:** `src/features/courier-onboarding/actions.test.ts:227-234`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:** En el test:
  `it('permite el onboarding si el DNI es nuevo y registra datos, consentimientos y documentos', ...)`
  Se instancian mocks espía en las líneas 156-157:
  ```ts
  const mockInsertConsents = vi.fn().mockResolvedValue({ error: null });
  const mockUpsertDocuments = vi.fn().mockResolvedValue({ error: null });
  ```
  Sin embargo, en el bloque final de aserciones (líneas 227-234) **nunca se verifica que hayan sido llamados**:
  ```ts
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.redirectTo).toBe('/onboarding/status');
  }
  expect(mockUpdateCourier).toHaveBeenCalled();
  ```
  Si la Server Action omite por completo guardar los consentimientos en `consents` o guardar los documentos en `courier_documents`, **este test pasa en verde sin inmutarse**.
- **Qué hay que hacer:** Agregar aserciones explícitas para `mockInsertConsents` y `mockUpsertDocuments`, verificando que se invoquen con los parámetros y tipos de documento requeridos para auditoría legal.
- **Evidencia:** Inspección de `actions.test.ts:227-234`. Ninguna ocurrencia de `expect(mockInsertConsents)` ni `expect(mockUpsertDocuments)`. (Ver [`lecciones.md`](../lecciones.md) lección AG-64).

---

## 4. `PR77-H04` · Test de compresión de imágenes omite entorno jsdom y asume APIs de navegador no disponibles en Node.js · **BLOQUEANTE**

- **Archivo:** `src/features/courier-onboarding/image-compression.test.ts:31-46`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P01-contrato-de-framework-no-verificado`
- **Qué pasa:** `image-compression.test.ts` ejerce `compressImage(largeFile)` que, según la bitácora, opera con APIs de navegador (`Canvas / OffscreenCanvas`). El archivo corre en el entorno por defecto `node` de Vitest y carece de la directiva `// @vitest-environment jsdom`. En cuanto se cree `compressImage` invocando APIs de navegador (`document.createElement('canvas')`, `createImageBitmap`, etc.), el test arrojará `ReferenceError` inmediato en runtime de Node.js.
- **Qué hay que hacer:** Agregar la directiva `// @vitest-environment jsdom` en la primera línea de `image-compression.test.ts` y configurar los mocks necesarios de `HTMLCanvasElement` o `createImageBitmap` para simular la reducción de tamaño en el test sin agregar dependencias prohibidas.
- **Evidencia:** Inspección de `image-compression.test.ts:1-7`.

---

## 5. `PR77-H05` · La suite de pruebas de la tarea está en rojo (`pnpm test` falla con 3 suites rotas) · **BLOQUEANTE**

- **Archivo:** `src/features/courier-onboarding/actions.test.ts:1`, `image-compression.test.ts:1`, `upload-resilience.test.ts:1`
- **Severidad:** `alto` | **Categoría:** `test-coverage` | **Patrón:** `P15-entregable-declarado-pero-no-ejecutable`
- **Qué pasa:** Al correr la suite de pruebas unitarias (`pnpm test --run`), las tres suites de la feature T-121 fallan de inmediato al no encontrar los módulos importados.
- **Qué hay que hacer:** Implementar los módulos y asegurar que toda la suite pase en verde con 0 fallos.
- **Evidencia:**
  ```bash
  pnpm test --run
  ```
  Salida: 3 suites fallidas en `src/features/courier-onboarding/`.

---

## 6. `PR77-H06` · Test de detección de DNI en `actions.test.ts` no afirma la columna consultada (`dni_hmac`) y omite repartidores suspendidos · **MEJORA**

- **Archivo:** `src/features/courier-onboarding/actions.test.ts:90-153`
- **Severidad:** `medio` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:** En el test para el DoD 3 (*"DNI de un rechazado bloqueado"*), el mock administrativo en `actions.test.ts:112-127` retorna datos simulados para cualquier llamada `eq(...)` sobre `couriers`, sin verificar que la columna consultada sea `dni_hmac` ni que el valor buscado sea el HMAC calculado. Además, solo se evalúa `status: 'rejected'`, omitiendo el caso de repartidores suspendidos (`status: 'suspended'`), expresamente requerido por `docs/master-plan.md` para la protección con `dni_hmac`.
- **Qué hay que hacer:** Verificar en el mock administrativo que se consulte la columna `'dni_hmac'` y agregar un caso de prueba para repartidores con estado `'suspended'`.

---

## 7. `PR77-H07` · Test de resiliencia de subidas prueba un state machine en memoria pero es ciego a la integración real con Supabase Storage (`courier-docs`) · **MEJORA**

- **Archivo:** `src/features/courier-onboarding/upload-resilience.test.ts:8-58`
- **Severidad:** `medio` | **Categoría:** `test-coverage` | **Patrón:** `P08-control-no-cubre-lo-que-dice`
- **Qué pasa:** `upload-resilience.test.ts` prueba un gestor en memoria `createDocumentUploadManager` al que le inyecta una función `mockUploader`. Si bien valida la lógica de reintento individual y preservación de estado ante excepciones, no verifica la integración real con el cliente de Supabase Storage (`@/lib/supabase/browser`), no comprueba que el bucket sea `courier-docs`, ni valida que la ruta generada cumpla la regla de RLS `courier_docs_insert_own_folder` (`courier/${auth.uid()}/...`).
- **Qué hay que hacer:** Añadir pruebas de integración para la función que ejecuta la subida real contra el cliente de Supabase Storage en el navegador.

---

## 8. `PR77-H08` · Ausencia de pruebas para las vistas y componentes de onboarding R01, R02, R03 · **MEJORA**

- **Archivo:** `docs/tasks/T-121.md:8`, PR #77
- **Severidad:** `medio` | **Categoría:** `test-coverage` | **Patrón:** `P06-enumeracion-incompleta`
- **Qué pasa:** La descripción del PR menciona la implementación de las vistas R01 (identidad y documentos), R02 (vehículo y consentimientos) y R03 (estado en revisión), pero en la rama no existe ningún test de componentes (React Testing Library) para verificar su renderizado, accesibilidad (touch targets >= 48px, etiquetas de formulario) ni el deshabilitado de botones de navegación.
- **Qué hay que hacer:** Incorporar pruebas unitarias/integración para los componentes y páginas de onboarding.

---

## 9. `PR77-H09` · Plantilla del PR incompleta: sección de informe agy sin reporte y checklist del DoD sin tildar · **MEJORA**

- **Archivo:** PR #77 (cuerpo en GitHub)
- **Severidad:** `medio` | **Categoría:** `test-coverage` | **Patrón:** `P19-cuerpo-de-pr-fuera-de-template`
- **Qué pasa:** La sección `### Informe de revisión de agy` mantiene el placeholder `<!-- Se completará con la skill revisar-pr... -->`, y los ítems del DoD en la descripción se encuentran todos desmarcados (`[ ]`).
- **Qué hay que hacer:** Al culminar la implementación y resolver los bloqueantes, el autor debe correr la skill `revisar-pr`, pegar su reporte en dicha sección y tildar con `[x]` los ítems del DoD respaldados por evidencia.

---

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Archivos permitidos fuera de alcance | Se contrastó el diff contra `origin/develop:docs/tasks/T-121.md`. Los 4 archivos tocados pertenecen estrictamente a las rutas permitidas. |
| Inclusión de `dni_hmac` en Server Action | `serverEnv.DNI_HMAC_SECRET` ya existe en `src/server/env.ts` con validación Zod >= 16 caracteres. Su cálculo en servidor mediante `node:crypto` y actualización mediante `createAdminClient` es la arquitectura prevista para respetar el congelamiento de RLS en `couriers_update_self`. |
| Falta de librería de compresión en `package.json` | La ficha T-121 prohíbe dependencias nuevas. La decisión de implementar compresión nativa con Canvas / Blob / OffscreenCanvas respeta la regla 25. |

---

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| `pnpm lint` | Pasa en verde (código 0) | No valida la existencia de los módulos importados en tests ni la completitud funcional. |
| PR status (Draft) | Permite abrir PRs tempranos | No exige que los entregables declarados en la descripción estén commiteados. |
| Tests en fase roja | Pasan en rojo por falta de archivo | Ocultan errores de tipado en Vitest (`TS2345`) y aserciones huérfanas en mocks (`mockInsertConsents`). |

---

## Checklist de verificación final

- [ ] `src/lib/image-compression.ts` implementado con APIs nativas (< 500 KB)
- [ ] `src/features/courier-onboarding/upload-manager.ts` implementado y conectado a `courier-docs`
- [ ] `src/features/courier-onboarding/actions.ts` implementado con Zod, `dni_hmac` y persistencia
- [ ] Vistas y componentes de onboarding R01, R02 y R03 implementados en `src/app/(courier)/onboarding/**`
- [ ] `image-compression.test.ts` configurado con `// @vitest-environment jsdom` y mocks adecuados
- [ ] `actions.test.ts` corregido con aserciones explícitas para `mockInsertConsents` y `mockUpsertDocuments`
- [ ] `pnpm typecheck` en verde (0 errores)
- [ ] `pnpm lint` en verde (0 errores)
- [ ] `pnpm test` en verde (todas las suites pasando)
- [ ] Bitácora `docs/tasks/log/T-121.md` actualizada con la sesión de cierre
- [ ] Informe de auto-revisión de agy pegado en el cuerpo del PR

---

## Metodología

Verificado contra `29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c` sobre la rama `feat/T-121-courier-onboarding`. Comprobado mediante inspección estática del árbol, barrido de contratos y ejecución local de `pnpm typecheck`, `pnpm lint` y `pnpm test --run`.
