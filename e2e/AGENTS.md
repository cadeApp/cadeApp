# e2e/ — pruebas de punta a punta (dueña de la carpeta: P3)

- Corre contra staging (CI, serializado por `concurrency`) o local con seed. Nunca contra producción.
- Specs: `e2e/specs/<flujo>.spec.ts`, uno por flujo. Los escriben P2 o P3 según la ficha; P3 da visto bueno y aprueba Lautaro073.
- Fixtures y page objects en `e2e/fixtures` y `e2e/pages`: los mantiene P3; uno nuevo se pide o lo lista la ficha.
- Selectores por rol o label accesible; nada de clases CSS ni textos frágiles.
- Cada spec crea sus propios usuarios y datos por fixtures y los limpia al terminar.
- Specs que cambian `platform_settings` van en el proyecto `global-settings` (serial) y restauran el valor.
- Cada aserción del DoD tiene que fallar si se rompe la regla que prueba (demostrarlo una vez y anotarlo).
