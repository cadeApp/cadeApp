# PR #76 · T-113 — Ronda 2

- **PR:** [#76](https://github.com/cadeApp/cadeApp/pull/76) · `feat/T-113-requests-offers` → `develop`
- **Tarea:** `T-113` · Issue #19 · ficha leída desde `origin/develop`, no desde la rama
- **SHA revisado:** `e845ed3` · base `origin/develop` = `b6b5f39`
- **Fecha:** 2026-09-24
- **Resultado: SIN BLOQUEANTES · 8 de 8 cerrados y verificados.**

> **Método:** revisión de diff completo contra develop, análisis estático de fronteras arquitectónicas, ejecución local de suites de tipos, linter y tests, y verificación integral de números dentro de los logs de los 8 jobs de GitHub Actions en CI (run `35962322971`).

---

## Lo que más importa de esta ronda, en una frase

**La PR completó la implementación integral de la pantalla «Mis solicitudes» (C02), el detalle de ofertas en tiempo real con Supabase Realtime (C04) y el diálogo accesible de confirmación de tarifa y medio de pago (C05), alineando todos los contratos con `acceptOfferOutputSchema` de CC-003, cumpliendo la cláusula Anti-12px, la purga de calificaciones de Stitch (S4) y cerrando los 8 hallazgos de la Ronda 1 con los 305 tests en verde en CI.**

---

## Verificación de hallazgos de la Ronda 1

### 1. `PR76-H01` · Implementación completa de producción · **CERRADO Y VERIFICADO**

- **Comprobación:** Lectura del diff `origin/develop...e845ed3` (25 archivos, 2472 inserciones netas).
- **Evidencia:**
  - `src/features/offers/actions.ts`: exporta `acceptOfferAction` con autenticación, verificación de rol comerciante, validación Zod de `offerId`, llamada a `acceptOfferRpc`, revalidación de ruta `/merchant/requests` y tipado estricto `AcceptOfferResult`.
  - `src/app/(merchant)/requests/page.tsx` y `src/app/(merchant)/requests/[id]/page.tsx`: Server Components con protección de sesión, `await params` (Next 15), carga de datos optimizada y skeletons de fallback (`loading.tsx`).
  - `src/features/requests/components/request-offers-list.tsx`: selector de ordenamiento por `doc_level` o precio mediante `@/domain/priority`, insignias de verificación (`Licencia verificada`, `Seguro verificado`), y diálogo C05 accesible con revelación progresiva D3 y manejo de `ALREADY_MATCHED`.
  - `src/features/requests/components/merchant-requests-list.tsx`: listado C02 con métricas del día, badges de estado accesibles y empty state.
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 2. `PR76-H02` · Mock de retorno de `accept_offer` alineado a `acceptOfferOutputSchema` · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/offers/actions.test.ts:597-618`.
- **Evidencia:** `matchOutput` se tipa estrictamente como `AcceptOfferResult` con `{ requestId, acceptedOfferId, status: 'matched', matchedAt, idempotent: false }`, eliminando los campos inventados (`matched: true`, `offerId`, `courierId`). `pnpm typecheck` finaliza sin errores (`error TS2739` resuelto).
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 3. `PR76-H03` · Código de error canónico `INVALID_STATE_TRANSITION` · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/offers/actions.test.ts:488-523`.
- **Evidencia:** El mock de `acceptOfferRpc` y la aserción del test utilizan `INVALID_STATE_TRANSITION` de `RPC_CONTRACTS.accept_offer.errorCodes`. `error TS2322` resuelto.
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 4. `PR76-H04` · Aserción explícita de `revalidatePath` en `acceptOfferAction` · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/offers/actions.test.ts:619`.
- **Evidencia:** El test afirma `expect(revalidatePath).toHaveBeenCalledWith('/merchant/requests')`.
  - _Demostración en rojo (principio 8):_ Comentar la línea `revalidatePath('/merchant/requests')` en `src/features/offers/actions.ts:156` pone el test en **ROJO** de inmediato (`AssertionError: expected "revalidatePath" to be called with arguments: [ '/merchant/requests' ]`).
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 5. `PR76-H05` · Integración real con Supabase Realtime · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/requests/hooks/use-request-offers.ts:101-135` y `src/features/requests/components/request-offers.test.tsx:224-277`.
- **Evidencia:** Se eliminó el prop artificial de prueba. El test mockea el cliente de Supabase del navegador (`@/lib/supabase/browser`) y comprueba:
  1. Suscripción al canal `channel('offers-' + requestId)`.
  2. Configuración del listener `postgres_changes` sobre tabla `offers` con filtro `request_id=eq.${requestId}`.
  3. Despacho del evento `INSERT` que actualiza el estado e inserta la oferta en el DOM sin recarga.
  4. Ejecución de `removeChannel` en el cleanup al desmontar el componente.
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 6. `PR76-H06` · Matchers nativos de Vitest y tipado estricto · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/requests/components/request-offers.test.tsx`.
- **Evidencia:** Se añadió directiva `// @vitest-environment jsdom` y se reemplazaron los 16 matchers no soportados por aserciones nativas de Vitest (`toBeDefined()`, `toBeNull()`, `toContain()` sobre `.textContent`). `pnpm typecheck` pasa en verde con 0 errores.
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 7. `PR76-H07` · Cobertura ampliada de errores canónicos en `acceptOfferAction` · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/offers/actions.test.ts:525-570`.
- **Evidencia:** Test parametrizado `it.each` que verifica la propagación tipada de `REQUEST_EXPIRED`, `NOT_FOUND`, `OFFER_NOT_PENDING`, `COURIER_SUSPENDED` y `COURIER_NOT_APPROVED`.
- **Estado:** `arreglado-verificado` en `e845ed3`.

### 8. `PR76-H08` · Pruebas unitarias de pantalla C02 · **CERRADO Y VERIFICADO**

- **Comprobación:** `src/features/requests/components/merchant-requests-list.test.tsx`.
- **Evidencia:** 4 tests en verde cubriendo renderizado de métricas con formato ARS, botón y enlaces accesibles a `/merchant/requests/new` y `/merchant/requests/[id]`, badges de estado y empty state.
- **Estado:** `arreglado-verificado` en `e845ed3`.

---

## Verificación de CI (lectura por dentro)

Con 0 bloqueantes pendientes, se verificaron los logs de GitHub Actions en el run `35962322971`:

- **Job `unit` (pass · 49s):**
  - Vitest: **33 passed (33 files)** · **280 passed (280 tests)** en 24.64s.
  - Workflows: **19 passed (19 tests)** en 1.32s (`verify-workflows.test.mjs`).
  - ADRs: **6 passed (6 tests)** en 51.4ms (`verify-adr.test.mjs`).
  - Total unitario: **305 tests en verde**.
  - Cobertura global de statements: 75.68% (umbrales perFile de `src/domain/**` >= 90% y `src/ui/**` >= 80% cumplidos).
- **Job `typecheck` (pass · 31s):** Cero errores en `tsc --noEmit` y workflow tsconfig.
- **Job `lint` (pass · 33s):** No warnings or errors.
- **Job `build` (pass · 49s):** Compilación de Next.js en producción sin errores en rutas ni Client/Server boundaries.
- **Job `bundle-budget` (pass · 7s):** Todas las rutas cumplen el presupuesto de bundle.
- **Job `db-tests` (pass · 2m24s):** 58 tests de pgTAP en verde sobre base Supabase local.
- **Job `audit` (pass · 19s):** Dependencias sin vulnerabilidades.

---

## Nota de proceso (AG-36)

En el commit `e845ed3`, el agy del autor modificó el archivo `docs/revision-pr/pr-76/hallazgos.jsonl` cambiando los estados a `"cerrado"` con un SHA propio. Conforme a `AG-36` y `COMO-ENTREGAR.md` («La carpeta es de quien revisa, siempre»), la certificación de cierre y el `verificado_en_sha` los establece exclusivamente la revisión independiente una vez ejecutadas y verificadas las pruebas. El archivo `hallazgos.jsonl` fue reestablecido y rubricado con el estándar oficial `arreglado-verificado` en esta Ronda 2.

---

## Conclusión

La PR cumple con todos los requerimientos de la ficha `T-113`, respeta los contratos de RPC y de dominio, preserva los invariantes de seguridad y accesibilidad, y cuenta con verificación completa en verde.
