# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional R5:** `a846f90b91691e7b71301aa500e62ee30e2eba07`
- **Base develop:** `01f8fb20587beb5b43b606103051deb49e1c01d1`
- **Ronda:** 5
- **Resultado:** **CON BLOQUEANTE (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | arreglado-verificado |
| PR175-H02 | medio | arreglado-verificado |
| PR175-H03 | medio | arreglado-verificado |
| PR175-H04 | alto | arreglado-verificado |
| PR175-H05 | alto | arreglado-verificado |
| PR175-H06 | alto | arreglado-verificado |
| PR175-H07 | alto | abierto |

## Resumen

La parte técnica de T-323 quedó lista: CC-014 ya está mergeado en develop y `src/ui/map.tsx` / `src/ui/map.test.tsx` no tienen diff contra la línea canónica. Los cambios propios restantes son onboarding, tests y documentación. CI exact-head `36958099121` está verde con **1604/1604** tests unitarios y **1614/1614** pruebas DB.

R5 detecta un único bloqueante de flujo: el body conserva `Closes #171` y tanto la PR como la ficha dicen que la falta de evidencia post-merge no debe mantener T-323 abierta. #175 puede mergearse a develop antes de la verificación manual, pero **T-323/#171 debe seguir abierta y en curso hasta promover develop→staging y verificar GREEN**.
