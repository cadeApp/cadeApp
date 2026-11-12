# Lecciones — PR #735 / ronda 1

**Fuente:** 6 bloqueantes + 1 mejora, todos documentales. Registro estructurado en [hallazgos.jsonl](hallazgos.jsonl). No se asigna un AG nuevo para evitar duplicar lecciones ya existentes y números ocupados en otras ramas remotas; vincular a AG previas por carpeta al recopilar.

## Clase completa de defectos comprobada

Se enumeró el ciclo `INSERT draft → UPDATE published`, los dos tipos de evento, los actores `merchant`, `courier[0]`, `courier[1]`, `anon` y `service_role`, los dos modos de publicación (completa/allowlist), los positivos y negativos, y las transiciones de éxito/fuga/rollback. Esa matriz destapó una especificación que aislaba controles pero no los hacía compatibles entre sí. Es una reiteración de **pr-56/AG-37**: inspeccionar la clase entera antes del primer arreglo.

## Reglas concretas para la próxima ronda

- **H01–H02 · AG-37 / AG-55:** una prueba de eventos se define a partir de la transición SQL real; para probar `INSERT`, el evento debe originarse en un INSERT real con valor presente y un consumidor privilegiado que lo compruebe. Un mero `null` o un evento de otro tipo no valida la captura.
- **H03 · AG-60:** una ausencia asíncrona requiere evidencia de que el canal funciona, observación causal y una ventana acotada; una comprobación inmediata de `events.length === 0` no es un oráculo.
- **H04–H05 · AG-37:** si el oráculo positivo busca un campo que el fallback elimina de la publicación, ese oráculo debe cambiar de forma sin dejar de demostrar que el dato existe en origen. El flujo exitoso y la alternativa de fuga forman **una sola matriz**.
- **H06:** en un contrato de privacidad, el rollback debe mantener o aumentar la protección aunque degrade disponibilidad de Realtime; nunca reinstalar directamente la fuga.
- **H07 · AG-60:** exigir eventos correlacionados y cleanup rastreado, no checks basados solo en conteos o una corrida afortunada.

No se proponen cambios inmediatos a `AGENTS.md` a partir de una única PR documental. Contrastar reincidencia tras la ronda 2.



## Ronda 2 · lección confirmada

Seis arreglos de documento cumplen sus predicados de control y mutaciones en memoria; queda H05 por una **segunda aparición del mismo oráculo incondicional en la ficha**. Es la reincidencia de **pr-56/AG-37**: al cambiar un requisito de «S siempre ve clave» a «S ve clave solo sin allowlist», hay que barrer **todas** sus formulaciones, incluidas las «Notas para quien retome», no solo el bloque principal del CC. En ronda 3, enumerar CC + ficha + fila del plan + bitácora antes de dar H05 por verificado. No se numera una nueva lección AG por tratarse del mismo patrón.
