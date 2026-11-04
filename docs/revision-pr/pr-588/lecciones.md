# Lecciones — PR #588 (ronda 1)

Sin numeración AG nueva: no hay evidencias independientes de mutación ejecutada en esta ronda y la numeración debe obtenerse del máximo de todas las ramas remotas antes de asignarla.

- **H01** repite el patrón de diferencia entre `false` explícito y desconocido: el login/guard ya separan `undefined`, pero `auth/confirm` volvió a colapsar error de consulta y `false`. La prueba de contrato debe abarcar **todos los lectores del mismo atributo**, no solo el parser; relacionar con `pr-56/AG-37`.
- **H02** es `P08-control-no-cubre-lo-que-dice` y repite `pr-64/AG-61` y `pr-64/AG-62`: una prueba secuencial no da evidencia de una carrera; el control estructural debe localizar el `FOR UPDATE` en su sentencia y matarlo por mutación en CI. Una prueba de concurrencia real es trabajo posterior explícito (#601).
- **H03** es una variante de `P05-semantica-invertida-vs-dod`/`P08`: hacer pasar el fixture con un bypass de dueño crea un estado que el flujo productivo no podría producir. Al ampliar una ficha para resolver incompatibilidad, el objetivo del test tiene que conservar el camino real de dominio, no solo el color de CI. La autorización D02=C exige migrarlo a RPC.
- **Proceso:** CI verde sobre `d9012249` sí acredita las suites registradas, pero no acredita E2E: la puerta devolvió `BLOCKED / REQUIRES DEVELOP MIGRATION`. D01=A conserva el deber de ejecutar el E2E posmerge, sin falsear un verde. Además, no se debe cambiar `verificado_en_sha` desde la autorrevisión: `pr-56/AG-36`.

Antes de proponer una regla nueva en `AGENTS.md`, comprobar repetición inter-PR y la respuesta a las mutaciones de la próxima ronda.
