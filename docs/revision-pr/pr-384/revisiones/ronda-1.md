# Revisión independiente — PR #384 / T-357 — Ronda 1

**Fecha:** 2026-10-16. **SHA revisado:** `07475bb0`. **Resultado: SIN BLOQUEANTES.**

## Precondiciones y alcance

Leídos `AGENTS.md`, ficha `docs/tasks/T-357.md` desde origin/develop, bitácora `docs/tasks/log/T-357.md`, issue #344 y diff completo contra `origin/develop`.
Todos los archivos modificados están dentro de «Archivos permitidos»:
- `docs/tasks/log/T-357.md`
- `e2e/specs/courier-onboarding.spec.ts`
- `src/app/(courier)/courier/onboarding/vehicle/page.test.tsx`
- `src/app/(courier)/courier/onboarding/vehicle/page.tsx`
- `src/features/courier-onboarding/actions.test.ts`
- `src/features/courier-onboarding/actions.ts`
- `src/features/courier-onboarding/components.test.tsx`
- `src/features/courier-onboarding/components/courier-profile-view.tsx`
- `src/features/courier-onboarding/components/vehicle-form.tsx`
- `src/features/courier-onboarding/schemas.test.ts`
- `src/features/courier-onboarding/schemas.ts`
- `docs/revision-pr/pr-384/revisiones/ronda-1.md`

Sin cambios en contratos (`src/domain/**`, tipos de DB, RPCs o `src/ui/**`). Sin dependencias nuevas agregadas.

## Checks locales de calidad
- `pnpm typecheck`: ✅ (0 errores)
- `pnpm lint`: ✅ (0 warnings, 0 errores)
- `pnpm test`: ✅ (136/136 suites pasadas, 2438/2438 tests pasados)
- `pnpm test:db`: n.a. (no toca migraciones ni backend SQL)

## Hallazgos

### BLOQUEANTES:
Ninguno.

### MEJORAS:
Ninguna.

## Cobertura del DoD de T-357
- [x] Desde el perfil del repartidor se actualiza tipo de transporte y patente cuando corresponda sin reejecutar indebidamente el onboarding ni mostrar error genérico; se preservan datos y reglas de elegibilidad.
- [x] Cuenta con vehículo existente → cambiar tipo y guardar → recargar → valor persistido en perfil y vista de viaje.
- [x] Probar a pie/bici/moto/auto, patente válida e inválida, licencia/seguro requeridos según contrato y cambios que requieren revisión.
- [x] Verificar transiciones de consentimiento/estado, errores diferenciados y rechazo de mutaciones de otro repartidor.
- [x] Las pruebas nuevas son RED contra el comportamiento real faltante y GREEN después del arreglo; controles independientes detectan mutaciones que rompen cada invariante.
- [x] `pnpm typecheck && pnpm lint && pnpm test` completos verdes.
- [x] E2E agregado en `e2e/specs/courier-onboarding.spec.ts` para el flujo desde el perfil hasta la persistencia.
- [x] Sin cambios fuera de «Archivos permitidos».
- [x] Bitácora `docs/tasks/log/T-357.md` al día con evidencia de ejecución.
