# Lecciones — PR #471 (T-387)

## Ronda 1
No se asigna un AG nuevo sin haber comprobado primero las causas mediante una mutación RED/GREEN del test afectado en un checkout reproducible.

- **H01 / P08:** una prueba E2E que usa un objeto con magic bytes correctos no prueba que sea un archivo renderizable. Comprobar estructura del fixture con un parser real y comparar Storage byte a byte con el archivo cargado.
- **H02 / P08:** si una validación asíncrona precede al estado `busy`, la interacción sigue habilitada. Probar una carrera con `FileReader` diferido, sin mockear el código productivo de validación/subida.
- **H03 / P03:** una bitácora append-only debe agregar sesión nueva que aclare hechos posteriores; no actualizar retrospectivamente un SHA que la sesión no podía conocer.
- **Proceso:** esta revisión tuvo acceso de lectura a código remoto y no clon local; registrar `analisis` cuando no exista reproducción ejecutada. El control `pdfinfo` sí se reprodujo sobre los bytes del E2E.
