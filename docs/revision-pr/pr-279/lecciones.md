# Lecciones de la PR #279

No se abre un hallazgo ni una lección global nueva en esta ronda.

La revisión sí confirma dos prácticas ya exigidas por el proceso:

- una actualización de dependencias se valida con el RED del advisory anterior y el GREEN del árbol final, no solo mirando que el job quede verde;
- cuando una migración de runner cambia el aislamiento de mocks, el arreglo debe preservar las assertions originales y atacar la fuga de estado, no limpiar el contador justo antes de la aserción.

Como no hubo un hallazgo nuevo de la revisión, no se asigna un nuevo número `AG-xx`.
