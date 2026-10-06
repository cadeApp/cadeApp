# Lecciones de la PR #282

## Inventariar consumidores antes de revocar privilegios

PR282-H01 repite P06: una barrera de seguridad correcta puede romper producción si el inventario de consumidores está incompleto. Para un cambio de grants, la enumeración tiene que cubrir todas las lecturas directas del rol afectado, no solo el flujo que originó el incidente.

## ALTER PUBLICATION SET no es una edición puntual

PR282-H02 refuerza P01: `ALTER PUBLICATION ... SET TABLE` reemplaza el conjunto publicado. Cuando una publicación es compartida por varias features, una corrección de privacidad de una tabla no debe borrar silenciosamente las demás.

## Ronda 2 — el rollout también tiene que respetar el modelo de coordinación

PR282-H03 muestra que un rollout técnicamente correcto puede ser inválido para el proceso del repo: si hacen falta tres merges independientes para seguridad, deben modelarse como unidades de trabajo compatibles con «una tarea = un issue = una rama = un PR», o existir una excepción humana explícita y reconciliada.

PR282-H04 refuerza P15: en un repo con drift check de tipos, la migración y el archivo generado forman un entregable atómico. Postergar `database.types.ts` a un PR posterior hace que el primer PR no sea mergeable aunque su SQL sea correcto.

No se asigna un nuevo número AG en esta ronda; H03/H04 reutilizan patrones existentes.

## Ronda 3 — una excepción de proceso tiene que llegar hasta la automatización

PR282-H05 refuerza P03: documentar una excepción no cambia un workflow que calcula estado por otro criterio. Cuando una regla humana cambia la semántica de «terminado», hay que enumerar todos los automatismos que derivan ese estado —issue, tablero, dependencias y cierre— y reconciliarlos juntos.

PR282-H06 refuerza P01: un DoD no puede exigir un check en un momento donde el propio gate está diseñado para bloquearlo. En PRs con migraciones, el contrato real de T-327 es DB/CI pre-merge y E2E remoto post-merge; la ficha debe modelar ese orden explícitamente.

No se agrega numeración AG nueva en esta ronda.

## Ronda 4 — GREEN exact-head no reemplaza sincronización con el target

PR282-H07 refuerza P08: un check puede cubrir perfectamente el SHA que recibió y aun así no cubrir el árbol que realmente se integrará si el target avanzó. En este caso el gate E2E descubre todos los specs del SHA, pero la rama vieja ni siquiera contiene `incidents.spec.ts` ya presente en develop.

Antes de cerrar una ronda final hay que comparar HEAD contra el target actual y, si está detrás, sincronizar y repetir los checks. No se agrega numeración AG nueva.

## Ronda 5 — cierre

H07 quedó resuelto siguiendo la propia lección de Ronda 4: sincronizar primero y volver a ejecutar el gate completo. El E2E pasó de no contener `incidents.spec.ts` a ejecutarlo explícitamente con 4/4 casos verdes.

El fallo de `audit` no genera una lección de esta PR: el árbol de dependencias es idéntico a develop y el advisory apareció fuera del cambio revisado. Debe tratarse como mantenimiento de dependencias separado, sin expandir silenciosamente CC-023.

No se agrega numeración AG nueva.
