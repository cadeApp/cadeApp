# Lecciones — PR #122 (T-205)

La revisión descartada original sigue fuera de vigencia. Este archivo resume la revisión válida hasta Ronda 4 (`732a9bdc...`).

- **H01 / P06:** una pasada visual exige enumerar la clase completa.
- **H02 / P08:** un control debe observar la propiedad real, no un proxy.
- **H03 / P03:** no cerrar criterios runtime sin evidencia reproducible.
- **R01 / P10:** no reescribir el DoD para acomodar una limitación operativa.
- **R02 / P03:** reglas de AGENTS también deben auditarse aunque ESLint no las imponga.
- **R03 / P08:** `scrollWidth` no demuestra ausencia de clipping.
- **R04 / P15:** documentar un harness no equivale a entregarlo. Si la evidencia depende de una herramienta, script o test, ese mecanismo debe existir y poder ejecutarse por un tercero. Una captura “correcta” que proviene de un árbol manual distinto a la ruta real no prueba la ruta canónica.

Regla práctica para evidencia browser:

1. versionar el harness;
2. reutilizar pages/layouts/componentes reales;
3. registrar comando reproducible;
4. medir offenders;
5. inspeccionar capturas;
6. no duplicar manualmente UI que ya vive dentro de los componentes;
7. si el harness no puede reproducirse desde el repo, el resultado queda como evidencia auxiliar, no como verificación.
