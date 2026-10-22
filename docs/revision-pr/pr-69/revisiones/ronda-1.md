# Informe de Revisión — Ronda 1 — PR #69 [T-114]

- **Fecha:** 2026-09-23
- **SHA revisado:** `d435ef8901d7db98dd010ccef5302099c4bf9a0b`
- **Revisor:** Revisión independiente agy
- **Tarea:** `T-114` — Panel del repartidor (Issue #20)

## Resumen Ejecutivo

- **Resultado:** SIN BLOQUEANTES
- **Checks locales ejecutados:**
  - `pnpm typecheck`: ✅ (0 errores)
  - `pnpm lint`: ✅ (0 advertencias, 0 errores)
  - `pnpm test`: ✅ (25 test files passed, 224 tests passed)
  - `pnpm test:db`: n.a. (sin cambios en `supabase/` ni SQL)

## Verificación por Criterio

### 1. Alcance y Ficha
- La ficha `docs/tasks/T-114.md` fue leída desde `origin/develop`.
- Los 33 archivos modificados están dentro de las rutas autorizadas en "Archivos permitidos":
  - `src/features/availability/**`
  - `src/features/offers/**`
  - `src/app/(courier)/**`
  - `docs/tasks/T-114.md`
  - `docs/tasks/log/T-114.md`
  - `docs/revision-pr/**`
- No hubo cambios de contratos ni dependencias nuevas agregadas.

### 2. Seguridad e Invariantes (§2 & D3/D15)
- **D3 y D15 (Privacidad):** Las consultas en `src/features/offers/queries.ts` (`getAvailableRequests` y `getMyOffers`) no seleccionan coordenadas (`lat`/`lng`), direcciones exactas, ni datos del destinatario (`delivery_request_contacts`). Se comprobó mediante prueba de serialización en `queries.test.ts` e inspección del DOM en `courier-panel.test.tsx`.
- **Piso de oferta e Invariantes de Negocio:** La RPC atómica `submit_offer` valida la oferta contra `platform_settings.min_offer_ars` en Postgres. `OfferSheet` refleja el valor mínimo dinámico y captura el código `OFFER_BELOW_MINIMUM`.
- **"use client" y Server Boundaries:** Ninguna Server Action expone objetos de cliente no autorizados y los Server Components usan `import 'server-only'`.

### 3. Accesibilidad e Interfaz de Usuario
- **Targets Táctiles:** Conmutadores y botones principales garantizan `min-h-12` (>= 48px).
- **Piso Tipográfico en Tarjetas:** `RequestCard` utiliza `text-sm` (14px) o superior sin clases `text-xs`.

---

## Hallazgos

### BLOQUEANTES
- Ninguno.

### MEJORAS
- `src/features/offers/components/my-offers-list.tsx:128`: Redirección directa utilizando `window.location.href = '/trips/' + offer.requestId`. Se recomienda migrar a `useRouter` o `<Link>` de Next.js para navegación SPA sin recarga total.
- `src/features/offers/components/offer-sheet.tsx:144`: Uso de `className="text-xs"` en Badge secundario del modal de ofertas. Se sugiere uniformar badges a `text-sm` para mejorar la legibilidad en pantallas móviles.

---

## No revisado / dudas para Lautaro073
- Ninguna.
