# Revisión PR #169 — T-322

- **PR:** #169
- **Rama:** `docs/T-322-courier-test-scope`
- **SHA funcional R1:** `360fe6492f9b60519c3fa017da08a6a35ea6f6a6`
- **develop:** `76d71d67f5e2b7c026f2abe20f9d05a337d1bb51`
- **Ronda:** 1
- **Resultado:** **SIN BLOQUEANTES**

## Resumen

La PR formaliza la decisión P1 de PR167-A01 y amplía **solo** el alcance documental de T-322 para autorizar:

`src/features/courier-onboarding/actions.test.ts`

El motivo está acotado a sincronizar fixtures de tests con Privacy `1.1`. No autoriza cambios en `src/features/courier-onboarding/actions.ts` ni amplía el DoD funcional.

## Alcance

Solo se modifican:
- `docs/tasks/T-322.md`
- `docs/implementation-plan.md`

La ficha y el plan quedan consistentes. No hay dependencias, migraciones, cambios de seguridad ni código productivo.
