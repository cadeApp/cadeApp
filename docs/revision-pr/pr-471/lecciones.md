# Lecciones — PR #471 (T-387)

## Ronda 1
No se asigna un AG nuevo sin haber comprobado primero las causas mediante una mutación RED/GREEN del test afectado en un checkout reproducible.

- **H01 / P08:** una prueba E2E que usa un objeto con magic bytes correctos no prueba que sea un archivo renderizable. Comprobar estructura del fixture con un parser real y comparar Storage byte a byte con el archivo cargado.
- **H02 / P08:** si una validación asíncrona precede al estado `busy`, la interacción sigue habilitada. Probar una carrera con `FileReader` diferido, sin mockear el código productivo de validación/subida.
- **H03 / P03:** una bitácora append-only debe agregar sesión nueva que aclare hechos posteriores; no actualizar retrospectivamente un SHA que la sesión no podía conocer.
- **Proceso:** esta revisión tuvo acceso de lectura a código remoto y no clon local; registrar `analisis` cuando no exista reproducción ejecutada. El control `pdfinfo` sí se reprodujo sobre los bytes del E2E.

---

## Ronda 2

No se requiere crear una regla nueva AG: esta ronda confirma los patrones P08 y P03 ya documentados, sin introducir otro hallazgo bloqueante.

- **Aislar las garantías:** el orden de las guardas async puede comprobarse estáticamente por contraste de posición y mutación; eso no reemplaza ejecutar un evento React y su prueba RED bajo FileReader retenido. El informe debe separar ambas fuentes de evidencia y no atribuirse la ejecución del autor.
- **Un test unitario con mocks no es falso por usar mocks:** el comentario del test debe decir que las dependencias de Storage/acciones se simulan y que lo real es la lectura FileReader, validación y el flujo del componente. El E2E cubre Storage/RPC.
- **CI cuantitativo:** el aviso de bundle puede quedar `success` mientras reporta exceso. Comparar antes/después (259 → 258 kB courier) antes de atribuir una regresión a la tarea.
- **No convertir informe documental en nueva obligación de revalidar código:** conservar los runs del SHA de código/bitácora; el gate E2E sí debe quedar verde para merge por DoD de T-387.
