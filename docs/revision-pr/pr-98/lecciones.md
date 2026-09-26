# Lecciones de la PR #98

## Ronda 6

### Un fake stateful puede ser una mutation proof válida

No hace falta fabricar un segundo mock mutado. Si el mismo fake modela la constraint real y expone la operación segura y la insegura sobre el mismo estado, una mutación de producción cambia naturalmente el camino ejecutado y rompe las expectativas existentes.

### La salida de herramientas manda sobre los resúmenes

Axe y bundle-budget mostraron que los resúmenes humanos deben derivar de los artefactos, no al revés.

No se propone AG nueva; las reglas y patrones actuales ya cubren ambas clases.