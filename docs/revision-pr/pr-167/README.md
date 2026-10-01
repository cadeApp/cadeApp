# Revisión PR #167 — T-322

- **PR:** #167
- **Rama:** `feat/T-322-registration-email-confirmation`
- **SHA funcional R2:** `3c94d0eb8116987cc605ce5b433ad05e89b1b470`
- **develop:** `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`
- **Ronda:** 2
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado de hallazgos

| ID | Severidad | Estado |
|---|---|---|
| PR167-H01 | alto | arreglado-verificado |
| PR167-H02 | alto | arreglado-verificado |
| PR167-H03 | medio | arreglado-verificado |
| PR167-H04 | medio | arreglado-verificado |
| PR167-R01 | alto | abierto |

CI exact-head `36914443982`: typecheck, lint, build, audit, bundle-budget y db-tests verdes; **unit rojo por 1 test legal**: 1580 passed / 1 failed.

La decisión P1 para PR167-R01 es **opción A**. Se abrió la PR documental **#168** para ampliar oficialmente T-322 a `src/features/legal/documents.ts` y `src/features/legal/legal-red.test.ts`, exigir Privacy **v1.1** y conservar consentimientos históricos.

## Residual manual

La evidencia real de staging sigue pendiente hasta que #168 se mergee, agy ajuste la política/test legal y CI vuelva a verde.

## Follow-up fuera de T-322

Onboarding merchant: barrios de Aguilares con `src/ui/select.tsx`, por nombre y sin inventar centroides. Sigue separado de este hotfix.
