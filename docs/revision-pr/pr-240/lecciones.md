# Lecciones — PR #240 / T-334

**Fuente:** 3 hallazgos en Ronda 1. Datos estructurados en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

La implementación cubrió bien el caso nominal “fila recién creada”, pero no enumeró dos bordes del mismo contrato: **descendientes reales de una ruta exceptuada** y **estados parciales de una action multi-paso**.

No se propone un AG nuevo en esta ronda.

## Reutilización de lecciones existentes

- **H01** es `P07-coincidencia-demasiado-amplia`: una excepción exacta se implementó con un matcher de segmento. La defensa barata es enumerar las rutas reales del árbol cuando una regla dice “todas salvo X”.
- **H02** refuerza la lección de enumerar la clase completa antes de cerrar: una columna usada como marcador de completitud debe analizarse contra **todos los puntos de fallo que ocurren antes y después de escribirla**, no solo contra el happy path.
- **H03** no necesita regla nueva: la ficha ya declara el checkpoint manual y el proceso ya prohíbe afirmar evidencia no ejecutada.

## Qué cambiar, en orden de impacto

1. Hacer exacta la excepción de `/courier/profile` y matar la mutación de prefijo.
2. Convertir `vehicle_type` en marcador final real, conforme D01=1-A.
3. Fijar D02=2-A con tests de error de lectura y mutación.
4. Recién después ejecutar el checkpoint manual de Develop.

## Advertencias

- La revisión no debe implementar H02: toca una action sensible y su persistencia multi-paso; lo implementa agy y una ronda posterior lo verifica.
- La ampliación de ficha sí se registra desde la revisión porque fue una decisión explícita de Lautaro073.
