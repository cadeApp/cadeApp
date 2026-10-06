# Lecciones de la PR #282

## Inventariar consumidores antes de revocar privilegios

PR282-H01 repite P06: una barrera de seguridad correcta puede romper producción si el inventario de consumidores está incompleto. Para un cambio de grants, la enumeración tiene que cubrir todas las lecturas directas del rol afectado, no solo el flujo que originó el incidente.

## ALTER PUBLICATION SET no es una edición puntual

PR282-H02 refuerza P01: `ALTER PUBLICATION ... SET TABLE` reemplaza el conjunto publicado. Cuando una publicación es compartida por varias features, una corrección de privacidad de una tabla no debe borrar silenciosamente las demás.

## Ronda 2 — el rollout también tiene que respetar el modelo de coordinación

PR282-H03 muestra que un rollout técnicamente correcto puede ser inválido para el proceso del repo: si hacen falta tres merges independientes para seguridad, deben modelarse como unidades de trabajo compatibles con «una tarea = un issue = una rama = un PR», o existir una excepción humana explícita y reconciliada.

PR282-H04 refuerza P15: en un repo con drift check de tipos, la migración y el archivo generado forman un entregable atómico. Postergar `database.types.ts` a un PR posterior hace que el primer PR no sea mergeable aunque su SQL sea correcto.

No se asigna un nuevo número AG en esta ronda; H03/H04 reutilizan patrones existentes.
