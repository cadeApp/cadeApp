# Lecciones — PR #613 · T-422

No se asigna identificador AG nuevo en esta ronda porque no se encontró un defecto introducido dentro del alcance T-422.

## Distinción relevante
- **Sincronización del oráculo E2E vs. persistencia del producto.** La espera previa a `reload()` comprueba el contrato previsto para la prueba; no demuestra que el cierre optimista en producción sobreviva a una navegación inmediata. El problema del producto es preexistente y se sigue en [#614](https://github.com/cadeApp/cadeApp/issues/614). Resolución D01=A de Lautaro073.
- **CI del SHA correcto.** Para `workflow_run` el SHA superficial puede ser el de develop. El log de `checkout` y el commit status `TARGET_SHA` son los que permiten atribuir el resultado real a `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`.
- **El timeout no es una garantía de duración.** Los 75 minutos se validaron mediante test de configuración y una ejecución real de 37 minutos con ambos proyectos; no es una prueba de margen bajo cualquier carga. Un cambio posterior debe conservar la cota de los dos proyectos sin adulterar los checks.

La separación del bug en #614 evita que quien repara el gate también certifique una solución nueva de UX/consistencia de datos sin revisión independiente.
