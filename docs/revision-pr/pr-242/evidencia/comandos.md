# Evidencia reproducible — PR #242

## Ronda 3

HEAD:

    320bab2cc25c2a772dad4c0826345c3be47e1e44

develop actual:

    3e5d5381dbf59717763f1927e1cf080504a9ebf1

Comparación:

    status: diverged
    ahead_by: 8
    behind_by: 1
    mergeable: false

El commit de develop que falta es T-334 (#240).

### Diferencia contractual

develop:

    CourierProfileData.onboardingComplete: boolean
    profileData.onboardingComplete = courier.vehicle_type !== null
    courier incompleto -> "Completá tu registro"
    courier incompleto -> CTA "Continuar registro"
    courier incompleto -> no "En revisión administrativa"

HEAD #242:

    no onboardingComplete
    no bloque de registro incompleto

### Fuente documental

`admin_verify_document` actualiza:

    update public.courier_documents set status = v_target_status
    if kind=license -> couriers.license_status = v_target_status
    if kind=insurance -> couriers.insurance_status = v_target_status

Por eso `courier_documents.status` es una fuente válida y más inmediata para submitted.

### Evidencia H04

Se abrió directamente:

    src/features/courier-onboarding/evidence/T-325/360-06-feed-pending-real-docs.jpg

Observado:

    licencia -> Listo
    seguro -> Listo
    sin CTA "Ir al panel de repartidor"

### Checks HEAD actual

    Vercel: success
    e2e-preview: pending al cierre de R3
    CI workflow completo: aún sin run registrado para 320bab2

### Cierre siguiente

Después de mergear origin/develop:

    pnpm vitest run       "src/app/(courier)/courier/profile/page.test.tsx"       "src/app/(courier)/courier/feed/page.test.tsx"       src/features/courier-onboarding/components.test.tsx       src/features/offers/courier-panel.test.tsx
    pnpm typecheck
    pnpm lint
    pnpm test
    pnpm build
    git diff --check
    pnpm vitest run tools/verify-fichas.test.ts
    node .github/workflows/verify-workflows.test.mjs
    node docs/adr/verify-adr.test.mjs

Revisión final: auditar CI/E2E del SHA combinado y evidencia visual de perfil.
