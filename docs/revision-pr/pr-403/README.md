# PR #403 — T-367 · Mostrar avatar aprobado del repartidor en su perfil

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/403 |
| Tarea | T-367 (#365, Fase 3 — QA/UX) |
| Autor | asako669 |
| Rama | `feat/T-367-avatar-perfil` → `develop` |
| SHA ronda 1 | `7afd83d4` |
| Estado | **Ronda 1: SIN BLOQUEANTES**. Apta para revisión de Lautaro073. |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `7afd83d4` | **SIN BLOQUEANTES** (0 bloqueantes, 0 mejoras) | [ronda 1](revisiones/ronda-1.md) |

## Resumen de cambios
- `src/features/courier-onboarding/queries.ts`: Implementa `getCourierApprovedAvatarUrl` con verificación estricta de sesión, rol, estado `approved` del repartidor, y documento `avatar` verificado y vigente. Genera URL firmada server-side con TTL de 300 segundos desde el bucket privado `courier-docs`.
- `src/app/(courier)/courier/profile/page.tsx`: Integra resolución de avatar autorizado para repartidor habilitado y lo proyecta a `CourierProfileData`.
- `src/features/courier-onboarding/components/courier-profile-view.tsx`: Extiende `CourierProfileData` con `avatarUrl` y `avatarStatus`; renderiza `<Image ... unoptimized />` con alt accesible, recorte circular y fallback dinámico al ícono `<User />` en caso de error o ausencia.
- `src/features/courier-onboarding/components.test.tsx`: Pruebas de renderizado con avatar, fallback por ausencia, fallback por error de carga (`onError`), e invariante de no exposición de DNI/selfie.
- `src/features/courier-onboarding/queries.test.ts`: 9 pruebas unitarias de `getCourierApprovedAvatarUrl` (éxito, aislamiento cross-user, admin, pending, rejected, non-current, path traversal, error de Storage).
- `src/app/(courier)/courier/profile/page.test.tsx`: 5 pruebas de integración para la página de perfil con resolución de avatar.
- `e2e/specs/courier-onboarding.spec.ts`: Prueba E2E de visualización de foto en `/courier/profile` para cadete aprobado y fallback ante avatar rechazado.
