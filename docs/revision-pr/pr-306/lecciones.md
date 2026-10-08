# Lecciones de la PR #306 — T-351

**Fuente:** 3 bloqueantes y una mejora de especificación. No se agrega numeración AG nueva porque son formas reconocibles de P08, P04 y P03.

## P08 — No basta auditar el primer estado de un componente con estados

H01: el diseño dice «todos los estados» y un test solo audita `idle`. En UI de documentos, las ramas `uploading`, `success` y `error` presentan colores/textos distintos. La clase entera se enumera antes de prometer un axe GREEN general. Reusar la lección **pr-56/AG-37**.

## P08 — A11Y exige precondiciones semánticas

H02 reincide directamente en PR253-H02: una pantalla puede tener cuatro `data-slot` y cuatro textos «Subir» sin que los inputs sigan enlazados a un label accesible. La precondición debe usar `getByLabel` como el test de T-309; `data-status` sirve para diagnóstico auxiliar, no para acreditar accesibilidad.

## P04 — El RED de una prueba no es cambiar su expected a una mentira

H03: `idle` sustituido por `success` en el selector del test da rojo en cualquier implementación sana. El mutante debe degradar la **UI** mientras la expectativa positiva queda intacta; evidencia real, no ensayo que siempre falla por definición. Relacionado con pr-63/AG-68.

## Precisión de copy

H04: el texto visible de éxito es «Cargado». Los tests y tablas deben derivarse de `COURIER_ONBOARDING_COPY.btnUploaded`, no del nombre de estado inglés ni de la intuición del autor.

## Advertencia

Esta es una PR **documental** que define trabajo posterior; los hallazgos acreditan insuficiencias de contrato, no un fallo de ejecución de un arreglo aún inexistente.
