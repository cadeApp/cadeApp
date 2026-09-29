# Lecciones — PR #122 (T-205)

La revisión anterior descartada sigue fuera de vigencia. Este archivo resume únicamente la revisión válida iniciada sobre `5ff06783...` y su Ronda 2 sobre `2e3d6eda...`.

No se agrega número AG nuevo; los defectos siguen cubiertos por patrones/lecciones existentes:

- **PR122-H01 → AG-37 / P06:** cuando una tarea dice “todas las superficies”, hay que enumerar la clase completa antes de cerrar.
- **PR122-H02 → AG-75 / P08:** una regresión debe fallar al romper la propiedad real; `toBeDefined()` no prueba code-splitting.
- **PR122-H02 → AG-92:** un presupuesto cuantitativo se demuestra con el valor canónico del build.
- **PR122-H03 → P03:** no marcar `[x]` ni escribir “Falta: nada” sin la evidencia que la ficha exige.
- **PR122-H04 → P03:** un SHA en bitácora debe existir realmente.
- **PR122-R01 → P10:** una decisión operativa (“no agregar dependencias”) no autoriza a reescribir el criterio de aceptación. El estado pendiente se documenta fuera del texto autoritativo.
- **PR122-R02 → P03:** si la documentación afirma “Cero `!`”, la revisión debe buscar la sintaxis prohibida en el código nuevo; una regla escrita en AGENTS puede no estar cubierta por ESLint.

Regla práctica reforzada: en tareas visuales separar tres capas y no sustituirlas entre sí:

1. **regresiones unitarias concretas**;
2. **métricas de build/Lighthouse**;
3. **auditoría browser/axe + capturas reproducibles**.

Que una capa esté verde no convierte automáticamente las otras en cumplidas.
