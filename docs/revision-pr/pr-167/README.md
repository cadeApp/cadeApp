# Revisión PR #167 — T-322

- **PR:** #167
- **Rama:** `feat/T-322-registration-email-confirmation`
- **SHA funcional R1:** `6c7ace01cbb0ee7151271cceab10f51fbbdff78d`
- **develop:** `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`
- **Ronda:** 1
- **Resultado:** **CON BLOQUEANTES (4)**

## Hallazgos

| ID | Severidad | Estado |
|---|---|---|
| PR167-H01 | alto | abierto |
| PR167-H02 | alto | abierto |
| PR167-H03 | medio | abierto |
| PR167-H04 | medio | abierto |

CI exact-head `36829069927`: typecheck, lint, unit, build, bundle-budget, audit y db-tests verdes; **1565/1565** unitarios y **1614/1614** DB.

La rama está 3 commits adelante y 0 detrás de `develop`.

## Residual manual

La evidencia real de staging sigue pendiente por ficha, pero no debe ejecutarse hasta corregir H01–H04.

## Follow-up fuera de T-322

El problema del onboarding de comercio con barrios de Aguilares no se mezcla en esta PR: requiere tarea separada porque toca zonas/modelo/onboarding merchant. Decisión ya fijada: usar el `Select` del sistema, barrios por nombre y **sin inventar centroides**.
