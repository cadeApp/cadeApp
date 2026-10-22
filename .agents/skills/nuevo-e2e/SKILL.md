---
name: nuevo-e2e
description: >-
  Usar para escribir un spec de Playwright de un flujo de cadeApp.
---
# Nuevo E2E

1. Un archivo por flujo: `e2e/specs/<flujo>.spec.ts`. Reutilizá fixtures y page objects; si necesitás uno nuevo y
   la ficha no lo lista, pedíselo a P3.
2. Datos por fixtures (API o seed de staging), nunca por UI salvo el flujo probado. Nada de datos reales.
3. Selectores accesibles (`getByRole`, `getByLabel`); esperas con `expect`/`poll`; sin timeouts fijos.
4. Si el spec cambia `platform_settings`, va en el proyecto `global-settings` y restaura el valor en el teardown.
5. Cubrí cada aserción del DoD de la ficha y agregá `axe` en las pantallas que la ficha indique.
6. Rompé la regla que probás (en local o staging, nunca producción) y mostrá que el spec falla; anotalo en la bitácora.
