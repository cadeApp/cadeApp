# Lecciones — PR #115 / CC-012

## Ronda 1

- El contrato canónico debe barrer fixtures viejos.
- Un fake stateful solo vale como prueba de contrato si conserva las mismas precondiciones que Postgres.
- La precisión temporal es parte del contrato de keyset.
- CI verde del estado final no sustituye una mutation battery.
- Los checks focales correctos pueden coexistir con una suite completa roja.
- La trazabilidad de bloqueo/desbloqueo también es contrato operativo.

## Ronda 2

No aparece un patrón nuevo; se confirman lecciones anteriores.

- **P08:** el fake quedó útil recién cuando participación y consentimiento reproducen las fronteras SQL reales, no una aproximación.
- **P01:** la diferencia de precisión entre `Date` y `timestamptz` quedó cubierta por un test de dos valores dentro del mismo milisegundo.
- **P15 / Regla 40:** la evidencia de mutaciones es verificable cuando cada commit RED tiene una falla específica y su revert vuelve a GREEN. Los logs M1–M5 muestran exactamente esa cadena.
- El cambio de fixture `delay → other` es una actualización legítima por cambio explícito de contrato, no adulteración: el CHECK, la enum y los controles no fueron debilitados.
- Para contract-changes, el criterio de cierre debe incluir siempre la regeneración local de tipos dentro del CI del schema nuevo. R2 alcanzó `db:types --local` y terminó sin drift.

## Cierre

R2 termina con 0 bloqueantes sobre `391697a`.
