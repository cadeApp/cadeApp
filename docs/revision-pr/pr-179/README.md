# Revisión PR #179 — T-304

- **PR:** #179
- **Rama:** `feat/T-304-request-states`
- **SHA funcional revisado:** `4718ce7fcd2714009776b3da2321e553d8ee2c86`
- **Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 1
- **Resultado:** **CON BLOQUEANTES (5)**
- **CI:** no consultado por bloqueantes.
- **Decisiones P1:** D01 = 1-A; D02 = 2-A.

La PR declara una suite E2E de estados, pero el spec actual ejecuta funciones puras de dominio y schemas Zod dentro del runner de Playwright. No toca staging, autenticación real, RPC, persistencia ni efectos laterales.

P1 autorizó ampliar de forma acotada el arnés E2E para probar el sistema real. También resolvió que `in_transit → cancelled` por admin significa literalmente **solo si existe un incidente registrado previamente**. El backend actual no aplica esa precondición; debe corregirse mediante un contract-change separado antes de cerrar T-304.
