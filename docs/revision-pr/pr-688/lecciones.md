# Lecciones — PR #688 (T-431), ronda 1

No se agrega un AG-NN nuevo: el entorno de revisión no puede enumerar el máximo en todas las ramas remotas. Se usan patrones y referencias existentes con carpeta para evitar numeración duplicada.

1. **P08 / pr-82/AG-93:** cuando una extracción cambia el punto de carga (barrel que tenía error boundary → next/dynamic directo), los tests de consumidores deben cubrir el manejo de excepciones, no únicamente el contenido visible. H03 no es un fallo de los textos del comercio; es una regresión de la pantalla del repartidor.
2. **P11:** exponer un objeto de textos parcial obliga a que cada flujo (principal, validaciones, error y reintentos) lo consulte. En H04, nueve códigos de subscribeErrorMessage ignoraban ese objeto. Enumerar la clase entera antes de cerrar.
3. **pr-56/AG-36:** el autor no debe firmar verificación independiente ni escribir docs/revision-pr/**. En este caso, evidencia/red.md es del autor y se conserva con procedencia; solo la batería propia del revisor tiene autoría independiente.
4. **P03:** tras el cambio de diseño de audience a copy, actualizar también el cuerpo del PR. La ficha y bitácora correctas no sustituyen el resumen visible en GitHub.

Las observaciones H03/H04 son por inspección. No se declara RED reproducido ni verificado_en_sha ficticio; se adjunta un harness para ejecución posterior.

## Ronda 2

No se agrega AG-NN nuevo: esta sesión carece de clon para enumerar todas las ramas remotas. Se refuerzan estas lecciones existentes:

- **pr-82/AG-93 / P08:** recuperar una dependencia de manejo de errores requiere probar el fallback que realmente consume la pantalla. En R2, el mismo wrapper sirve a merchant y courier, y ambos montan el boundary existente. Los tests de error deben identificar el texto y la acción del fallback, además de verificar que exista un alert.
- **P11:** cuando la API recibe copy para todos los textos, no basta con un test del código de error más frecuente. La tabla debe recorrer los distintos códigos, incluidos los que comparten salida (`missing_vapid_key` y `missing_keys`) y el default. H04 cubre nueve escenarios.
- **pr-56/AG-36:** en R2 el agente escribió su evidencia RED/GREEN exclusivamente en la bitácora; no modificó la carpeta de revisión. La evidencia histórica del autor se conserva y sigue etiquetada como tal.
- **Autocorrección del revisor:** el M01 del harness de R1 mutaba el error boundary del entry point antiguo, que el nuevo wrapper ni utilizaba. Ese control no podía cubrir H03. En R2 se añaden mutaciones del texto y botón del boundary **ya conectado**, distintas de las M1/M2 del autor.
- **Criterio de evidencia:** inspección del código + un job CI verde del SHA correcto soportan una conclusión estática favorable, pero sin leer el resumen real de unit ni ejecutar mutaciones propias no justifican reportar un número de tests como «verificado por el revisor». Por eso los estados estructurados mantienen la distinción `arreglado-sin-verificar`.
