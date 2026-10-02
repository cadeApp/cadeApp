# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional final:** `97cc60791ab6d8f589d2f0cb83388d5c68dc6426`
- **Base develop:** `01f8fb20587beb5b43b606103051deb49e1c01d1`
- **Ronda:** 6
- **Resultado:** **APTO PARA MERGE A DEVELOP — SIN BLOQUEANTES**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | arreglado-verificado |
| PR175-H02 | medio | arreglado-verificado |
| PR175-H03 | medio | arreglado-verificado |
| PR175-H04 | alto | arreglado-verificado |
| PR175-H05 | alto | arreglado-verificado |
| PR175-H06 | alto | arreglado-verificado |
| PR175-H07 | alto | arreglado-verificado |

## Resumen

T-323 queda apta para merge de código a `develop`. CC-014 está absorbido canónicamente; no hay diff local en `src/ui/map.tsx` / `src/ui/map.test.tsx`; onboarding y cobertura de fallback permanecen correctos; el flujo de cierre quedó separado del merge.

PR #175 usa `Refs #171`, por lo que el merge no cierra automáticamente T-323. #171 permanece abierta y `en-curso` hasta promoción `develop → staging` y validación manual GREEN.

CI exact-head `36959413505`: **1604/1604** unitarios, **1614/1614** DB, typecheck/lint/build/audit/bundle verdes.

**Importante:** mergeable no significa tarea terminada. Después del merge hay que promover a staging y ejecutar el gate manual antes de cerrar #171.
