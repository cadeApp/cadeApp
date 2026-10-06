# Lecciones de la PR #282

## Inventariar consumidores antes de revocar privilegios

PR282-H01 repite P06: una barrera de seguridad correcta puede romper producción si el inventario de consumidores está incompleto. Para un cambio de grants, la enumeración tiene que cubrir todas las lecturas directas del rol afectado, no solo el flujo que originó el incidente.

## ALTER PUBLICATION SET no es una edición puntual

PR282-H02 refuerza P01: `ALTER PUBLICATION ... SET TABLE` reemplaza el conjunto publicado. Cuando una publicación es compartida por varias features, una corrección de privacidad de una tabla no debe borrar silenciosamente las demás.

No se asigna un nuevo número AG en esta ronda; ambos patrones ya existen en el catálogo.
