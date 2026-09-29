# Lecciones — PR #122 (T-205)

La revisión descartada original sigue fuera de vigencia. Este archivo resume la revisión válida iniciada sobre `5ff06783...` hasta Ronda 3 (`fc010850...`).

No se agrega número AG nuevo.

- **H01 → AG-37 / P06:** enumerar la clase completa antes de cerrar una pasada visual.
- **H02 → AG-75 / P08:** un control debe fallar al romper la propiedad real; no usar proxies tautológicos.
- **H03 → P03:** no cerrar aceptación runtime sin evidencia reproducible.
- **R01 → P10:** no reescribir un criterio de aceptación para reflejar una limitación operativa.
- **R02 → P03:** la bitácora no puede afirmar “Cero !” si el código nuevo contiene non-null assertions.
- **R03 → P08:** “no hay scroll horizontal” no equivale a “no hay contenido fuera del viewport”. Con `overflow-x:hidden`, una UI puede quedar visualmente recortada y un check de `scrollWidth` dar verde.

Regla práctica reforzada para browser review:

1. medir scroll;
2. enumerar `getBoundingClientRect()` de elementos visibles;
3. inspeccionar capturas reales;
4. exigir 0 elementos fuera del viewport;
5. conservar el harness/URL/comando usado para poder reproducirlo.

La captura no es decoración: si contradice la tabla, prevalece el defecto visible hasta que se explique/reproduzca correctamente.
