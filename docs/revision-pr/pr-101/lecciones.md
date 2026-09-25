# Lecciones — PR #101 / CC-007

## Ronda 2

### SECURITY DEFINER forma su propia clase de bypass
Endurecer RLS no protege una RPC `SECURITY DEFINER` que implementa autorización por su cuenta. Al revisar un invariante, hay que enumerar **todas** las funciones definer de la clase, no solo las reescritas por la tarea.

### Evidencia legal también necesita autoridad de escritura
Bloquear el estado `active` no alcanza si el cliente puede fabricar filas en `consents`. La provenance del consentimiento es parte del contrato: documento y versión deben validarse en una frontera confiable.

### “Mutación” significa ejecutar la suite mutada
Cambiar un string y demostrar que una regex desapareció no es mutation testing. La mutación debe modificar la fuente real temporalmente, correr el test y producir rojo.

No se propone AG nueva: refuerza P08/AG-61–63 y la regla existente de autoridad DB/RLS.
