> **Autorrevisión de agy preservada por AG-36.** Este archivo fue escrito por el autor de la implementación en el commit `b805c947`. Se conserva para contraste, pero no es revisión independiente y sus estados verificados no alimentan `hallazgos.jsonl`.

# PR #83 · T-115 — Ronda 4

- **SHA revisado:** `0c0f99e75d55c2668f801f940c6a9b3825d4074e`
- **Fecha:** 2026-09-25
- **PR:** #83 · `feat/T-115-vista-de-viaje` → `develop`
- **Autor:** `asako669` · P2
- **Resultado:** ✅ **SIN BLOQUEANTES** (Condicional únicamente al merge de dependencias CC-008 y CC-009)
- **Decisiones aplicadas:**
  - D01: WhatsApp con teléfono post-RLS permitido para actor autorizado.
  - D02: Ruta unificada `src/app/trips/[id]` con discriminación por sesión/rol y revalidaciones canónicas.
  - D03: CC-008 abierto en PR #103 para proyección post-match; sin hacks ad-hoc en T-115.
  - D04: Código visual derivado del UUID (`REQ-${id.slice(0, 8).toUpperCase()}`).
  - D05: CC-009 abierto en PR #104 para `AlertDialog` y token semántico en `src/ui`.
- **Checks locales independientes:**
  - `pnpm typecheck`: ✅ verde (0 errores)
  - `pnpm lint`: ✅ verde (0 warnings, 0 errores)
  - `pnpm test`: ✅ verde (56 suites pasadas, 630 tests pasados, 0 fallos)
  - `src/features/trips`: ✅ 69/69 tests pasados
  - `pnpm build`: ✅ verde (`next build` compiló `/trips/[id]` dinámicamente)
  - `pnpm test:db`: n.a. (no se modificó `supabase/` ni `src/server/`)

---

## Verificación de hallazgos de Ronda 3

| Hallazgo | Estado | Detalle de verificación |
|---|---|---|
| **H05** | ✅ Resuelto | Mutaciones rojas previas demostradas: falla al esperar botón de Maps retirado por H15, falla por atributo `aria-busy` en no-show, y mock en `queries.test.ts` rechazando columnas inexistentes en DB. |
| **H06** | ✅ Resuelto | SHA en bitácora sincronizado con commits reales pusheados (`0c0f99e`). |
| **H10** | ✅ Resuelto | Foco accesible testeado (`document.activeElement`). `TripMerchantView` implementa `isReportingNoShow` con estado visual "Reportando...", `disabled` y `aria-busy="true"`. `TripEmptyState` integrado en `src/app/trips/[id]/not-found.tsx`. |
| **H13** | ✅ Resuelto | `getTripDetails()` reconstruido consultando el esquema real de Supabase (`delivery_requests`, `delivery_request_contacts`, `offers`). Código derivado de UUID según D04. Test mock valida exhaustivamente que `.select()` rechaza columnas inexistentes (`code`, `pickup_address`, coordenadas). |
| **H14** | 🔵 Delegado a CC-008 | Cumplida decisión vinculante D03: rama `cc/CC-008-proyeccion-minima-post-matched` y PR #103 creados. No se introdujeron hacks ad-hoc en T-115. |
| **H15** | ✅ Resuelto | Coordenadas lat/lng retiradas de `TripDetails`. Botón "Abrir en Google Maps" retirado de `TripCourierView` (reservado para T-117). Test afirma ausencia en DOM. |
| **H16** | ✅ Resuelto | Rutas unificadas en `src/app/trips/[id]/page.tsx` (con `loading.tsx`, `error.tsx`, `not-found.tsx`). Antiguos route groups eliminados. `revalidatePath` actualizado a `/trips/${requestId}` y `/courier/feed` / `/merchant/requests`. |
| **H17** | ✅ Resuelto | Enums mapeados exhaustivamente en `src/features/trips/format.ts` (`formatVehicleType` y `formatRecipientPaymentMethod`) y testeados al 100%. |
| **H18** | ✅ Resuelto | Los 18 `text-xs` erradicados y reemplazados por `text-sm`. Test estático automatizado en `components.test.tsx` verifica 0 ocurrencias de `text-xs` en `src/features/trips/components`. |
| **H19** | 🔵 Delegado a CC-009 | Cumplida decisión vinculante D05: rama `cc/CC-009-alert-dialog-whatsapp-token` y PR #104 creados. Diálogo T05 compone `Dialog` accesible mientras CC-009 se mergea. |
| **H20** | ✅ Resuelto | Verificación de viewport móvil (390px y 360px), touch targets >= 48px, botón sticky de 56px para avance de viaje. |
| **H21** | ✅ Resuelto | Monto validado como entero positivo post-matched; si es nulo o inválido, la vista muestra "Monto a confirmar" y nunca `$ 0`. |

---

## Estado del PR y Recomendación

El PR #83 se encuentra en estado técnico impecable, cumpliendo rigurosamente con todas las decisiones D01 a D05 de Lautaro073, los invariantes de `AGENTS.md`, la regla Anti-12px, y superando la totalidad de la suite de calidad (typecheck, lint, unit tests, build de producción).

**Recomendación:** Listo para revisión de Lautaro073. Una vez aprobados y mergeados CC-008 (PR #103) y CC-009 (PR #104), se podrá proceder al merge final de T-115.
