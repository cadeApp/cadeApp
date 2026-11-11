# Lecciones — PR #688 (T-431), ronda 1

No se agrega un AG-NN nuevo: el entorno de revisión no puede enumerar el máximo en todas las ramas remotas. Se usan patrones y referencias existentes con carpeta para evitar numeración duplicada.

1. **P08 / pr-82/AG-93:** cuando una extracción cambia el punto de carga (barrel que tenía error boundary → next/dynamic directo), los tests de consumidores deben cubrir el manejo de excepciones, no únicamente el contenido visible. H03 no es un fallo de los textos del comercio; es una regresión de la pantalla del repartidor.
2. **P11:** exponer un objeto de textos parcial obliga a que cada flujo (principal, validaciones, error y reintentos) lo consulte. En H04, nueve códigos de subscribeErrorMessage ignoraban ese objeto. Enumerar la clase entera antes de cerrar.
3. **pr-56/AG-36:** el autor no debe firmar verificación independiente ni escribir docs/revision-pr/**. En este caso, evidencia/red.md es del autor y se conserva con procedencia; solo la batería propia del revisor tiene autoría independiente.
4. **P03:** tras el cambio de diseño de audience a copy, actualizar también el cuerpo del PR. La ficha y bitácora correctas no sustituyen el resumen visible en GitHub.

Las observaciones H03/H04 son por inspección. No se declara RED reproducido ni verificado_en_sha ficticio; se adjunta un harness para ejecución posterior.