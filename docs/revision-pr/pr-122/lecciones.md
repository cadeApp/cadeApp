# Lecciones — PR #122 (T-205)

La revisión anterior de PR #122 fue descartada por indicación de Lautaro073. Este archivo corresponde únicamente a la revisión vigente sobre `5ff06783...`.

No se agrega número AG nuevo en esta ronda; los defectos ya están cubiertos por lecciones existentes:

- **PR122-H01 → AG-37 / P06:** cuando una tarea dice “todas las superficies”, no alcanza con corregir los primeros controles encontrados. Hay que enumerar la clase completa antes de cerrar. T-205 dejó fuera `MyOffersList`, un estado de `CourierFeed` y varias animaciones.
- **PR122-H02 → AG-75 / P08:** el revisor y el autor deben demostrar mutaciones que hagan fallar el control. Un `toBeDefined()` sobre un export no prueba code-splitting; un test de dos componentes no prueba “todas las superficies”.
- **PR122-H02 → AG-92:** un presupuesto de bundle es cuantitativo. El dato válido es el First Load JS del build canónico; no se sustituye por una aserción estructural indirecta.
- **PR122-H03 → P03:** no marcar `[x]` ni escribir “Falta: nada” si la evidencia obligatoria de la ficha todavía no existe. El documento de cierre tiene que describir el estado que el código y las pruebas realmente sostienen.
- **PR122-H04 → P03:** las referencias de SHA en bitácora son evidencia, no texto decorativo; deben resolverse realmente.

Regla práctica para próximas tareas visuales: separar **regresiones unitarias concretas** de **auditoría de aceptación en navegador**. Ninguna de las dos reemplaza a la otra.
