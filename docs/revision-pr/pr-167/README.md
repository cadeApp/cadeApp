# Revisión PR #167 — T-322

- **PR:** #167
- **Rama:** `feat/T-322-registration-email-confirmation`
- **SHA funcional R3:** `490979e74286aad3a287a958902a21abfd03bf08`
- **develop:** `76d71d67f5e2b7c026f2abe20f9d05a337d1bb51`
- **Ronda:** 3
- **Resultado:** **CON BLOQUEANTE (1 · decisión P1)**

## Estado de hallazgos

| ID | Severidad | Estado |
|---|---|---|
| PR167-H01 | alto | arreglado-verificado |
| PR167-H02 | alto | arreglado-verificado |
| PR167-H03 | medio | arreglado-verificado |
| PR167-H04 | medio | arreglado-verificado |
| PR167-R01 | alto | arreglado-verificado |
| PR167-A01 | decisión | decision-pendiente |

CI exact-head `36923370905` completamente verde: typecheck, lint, unit, build, bundle-budget, audit y db-tests; **1581/1581 unitarios** y **1614/1614 DB**.

PR167-R01 quedó resuelto correctamente: Privacy v1.1, texto de obligatoriedad alineado y tests actualizados.

El único bloqueo no es funcional: la rama añadió `src/features/courier-onboarding/actions.test.ts` a su propia ficha y afirmó una autorización P1 que no está formalizada en la ficha vigente de `develop`. Según el protocolo, la ficha de `develop` es la autoridad de alcance.

## Mejora no bloqueante

El cuerpo del PR #167 quedó desactualizado: todavía copia el DoD previo a Privacy v1.1 y muestra cifras antiguas de tests. Actualizarlo después de resolver PR167-A01, antes del merge.

## Residual manual

Sigue pendiente la evidencia E2E real en staging exigida por T-322 después de merge/promoción.

## Follow-up fuera de T-322

Onboarding merchant: barrios de Aguilares con `src/ui/select.tsx`, por nombre y sin inventar centroides.
