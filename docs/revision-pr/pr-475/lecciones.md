# Lecciones — PR #475

Seis hallazgos documentales en ronda 1, corregidos por el autor y revalidados en ronda 2 contra otro SHA. No hubo implementación de código en este PR.

## Cerrar cadenas completas de lectura
Al planificar el cambio de un dato visible, inventariar **queries directas, vía viva, joins RLS, DTO, superficies de UI y tests**. Las rutas permitidas deben incluir todas las capas reales; el problema inicial era la lista incompleta.

## Separar nulos semánticos
Para una distancia: 0 m válido no es NULL sin cálculo y una relación no visible por RLS tampoco es NULL de distancia. La UI necesita un estado inequívoco, sin inventar barrios ni filtrar información no autorizada.

## Probar la proyección que se ejecuta
Los mocks deben respetar el `.select()`; una prueba que devuelve un campo no seleccionado puede dejar pasar un bug que hace invisible el valor real.

## Evitar falsa alarma en pruebas visuales
`elementFromPoint` puede devolver un descendiente del botón. El test correcto acepta el botón o su descendiente y ejerce la acción.

## Alcance
Estas son lecciones derivadas de una PR exclusivamente de fichas. No se agrega una regla global `AG-xx` sin corroborar numeración y repetición en otras PRs; por ahora no se modifica AGENTS.md.
