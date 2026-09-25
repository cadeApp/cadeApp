# Lecciones de la PR #98 para `AGENTS.md` y las reglas

## Patrón dominante

R2 refuerza patrones existentes:

- **P03:** el documento legal es parte del comportamiento del producto; si dice “obligatorio” y el schema dice “opcional”, la documentación contradice el código.
- **P08:** una compensación no está cubierta si el test solo prueba el camino en que la compensación funciona.
- **AG-36:** confirmado el cierre de separación implementador/revisor: el autor no tocó la carpeta de revisión tras R1.

## No se propone AG nueva

H11 es un caso específico de P03 y H06 un caso de P08. Primero observar recurrencia en otras PR antes de agregar reglas globales.
