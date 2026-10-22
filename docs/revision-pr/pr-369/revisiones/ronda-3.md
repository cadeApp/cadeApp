# T-368 / PR #369 — Ronda 3: render real falló antes de asserts

**HEAD con error:** `6c12ab67c6c615e915223e3b304ef06254268b0b`.

El [CI 38684140730](https://github.com/cadeApp/cadeApp/actions/runs/38684140730) reportó `unit` FAILED: 6 tests nuevos de `src/app/(merchant)/merchant/plan/page.test.tsx` fallaron con `ReferenceError: React is not defined` en el módulo `page.tsx` al invocar `MerchantPlanPage()`, sin alcanzar las expectativas del CTA/link. Los demás 129 archivos de test y 2159 tests pasaron. `typecheck`, `lint`, `build`, `audit` y `bundle-budget` pasaron.

**Causa por inspección:** el transform de JSX del entorno de Vitest necesita `React` en el scope del módulo. La página de courier ya sigue el mismo patrón de `import * as React from 'react'`. No es un error funcional de WhatsApp; sí impide verificar por test real la pantalla.

**Corrección mínima:** importar React en `src/app/(merchant)/merchant/plan/page.tsx`. **NO** se cambian tests, mocks, expectativas, `vitest.config` ni gates. Al pasar todos los tests recién será GREEN; no declarar por anticipado.

**Estado:** arreglado-sin-verificar hasta nuevo CI sobre HEAD corregido. Este rojo de ejecución es genuino, **no es** la mutación RED de comportamiento solicitada: no confundirlos.
