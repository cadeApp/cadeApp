# Lecciones de la PR #117 para `AGENTS.md` y las reglas

**Fuente tras R2:** A01 + H01–H09. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

**P08-control-no-cubre-lo-que-dice** sigue dominando y ahora aparece en cuatro formas de la misma raíz:

1. un botón artificial en R1 en lugar del componente real;
2. Retry clickable sin afirmar la postcondición entre múltiples consumidores;
3. submit offline probado mediante click sobre un botón disabled, sin atravesar `handleSubmit`;
4. iconos “maskable” validados solo por nombre/peso, sin demostrar dimensiones ni variante segura.

El patrón común no es “faltan más tests”, sino **el control termina antes del invariante real**.

## Lecciones propuestas

No se agrega un AG nuevo: P08 ya está en el catálogo y el protocolo ya exige mutación adversaria. R2 aporta ejemplos nuevos para endurecer cómo se aplica:

> Para una acción con defensa visual + guarda lógica, la mutación debe atacar ambas capas por separado. Un botón disabled no demuestra la guarda del handler.

> Para archivos binarios con semántica declarativa (maskable, tamaño de icono), validar metadatos/estructura del archivo y una propiedad que distinga la variante, no solo existencia y peso.

## Qué cambiar, en orden de impacto

1. Hacer que los tests de Retry observen **otro consumidor** del estado, no solo el componente clickeado.
2. Probar handlers defensivos enviando el form directamente, aunque el botón esté disabled.
3. Validar PNGs leyendo IHDR y diferenciando hashes de variantes.
4. Mantener la separación entre test DOM y evidencia visual real.
5. En harnesses de `node:vm`, tipar el borde con tipos mínimos locales: no usar `any` para “salir del paso”.

## Advertencias

- H04 no es solucionable con más unit tests: necesita URL/dispositivo/navegador real y capturas persistentes.
- La inspección de R2 no sustituye ejecución: H01–H03 quedan `arreglado-sin-verificar` hasta una ronda sin bloqueantes.
