# Lecciones — PR #115 / CC-012

## Ronda 1

- **El contrato canónico debe barrer fixtures viejos.** Agregar un CHECK correcto y actualizar los tests focales no alcanza si una suite estructural todavía inserta un valor histórico fuera de la nueva enumeración.
- **Un fake stateful solo vale como prueba de contrato si conserva las mismas precondiciones que Postgres.** PR98 ya mostraba que puede ser una mutation proof válida; H03/H04 muestran la condición inversa: si simplifica participación o consentimiento, fabrica falsos verdes.
- **La precisión temporal es parte del contrato de keyset.** Si SQL usa microsegundos y el fake usa `Date.parse`, dos filas distintas pueden colapsar al mismo milisegundo. El test debe atacar ese borde explícitamente.
- **CI verde del estado final no sustituye una mutation battery.** M1–M5 deben existir como resultados RED reales y reproducibles; “pendiente” en el documento es un entregable faltante, no una formalidad.
- **Los checks focales correctos pueden coexistir con un suite completo rojo.** En este SHA, RLS/RPC nuevos pasan y `structure.sql` falla. El criterio de merge sigue siendo el conjunto completo.
- **Trazabilidad del bloqueo también es contrato operativo.** #27 quedó corregida a `bloqueada` mientras el CC esté abierto; al mergear el CC deberá volver a estado activo antes de retomar GREEN.
