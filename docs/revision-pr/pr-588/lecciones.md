# Lecciones — PR #588 (rondas 1–2)

Sin numeración AG nueva: no hay evidencias independientes de mutación ejecutada en esta ronda y la numeración debe obtenerse del máximo de todas las ramas remotas antes de asignarla.

- **H01** repite el patrón de diferencia entre `false` explícito y desconocido: el login/guard ya separan `undefined`, pero `auth/confirm` volvió a colapsar error de consulta y `false`. La prueba de contrato debe abarcar **todos los lectores del mismo atributo**, no solo el parser; relacionar con `pr-56/AG-37`.
- **H02** es `P08-control-no-cubre-lo-que-dice` y repite `pr-64/AG-61` y `pr-64/AG-62`: una prueba secuencial no da evidencia de una carrera; el control estructural debe localizar el `FOR UPDATE` en su sentencia y matarlo por mutación en CI. Una prueba de concurrencia real es trabajo posterior explícito (#601).
- **H03** es una variante de `P05-semantica-invertida-vs-dod`/`P08`: hacer pasar el fixture con un bypass de dueño crea un estado que el flujo productivo no podría producir. Al ampliar una ficha para resolver incompatibilidad, el objetivo del test tiene que conservar el camino real de dominio, no solo el color de CI. La autorización D02=C exige migrarlo a RPC.
- **Proceso:** CI verde sobre `d9012249` sí acredita las suites registradas, pero no acredita E2E: la puerta devolvió `BLOCKED / REQUIRES DEVELOP MIGRATION`. D01=A conserva el deber de ejecutar el E2E posmerge, sin falsear un verde. Además, no se debe cambiar `verificado_en_sha` desde la autorrevisión: `pr-56/AG-36`.

Antes de proponer una regla nueva en `AGENTS.md`, comprobar repetición inter-PR y la respuesta a las mutaciones de la próxima ronda.

## Ronda 2 — Comprobaciones

- **H01:** el estado `undefined` tiene ruta explícita y unitarias que ejercen el caso de error; el test correcto complementa a `parseOnboardingComplete`, no lo reemplaza. El RED local está reportado por el autor, pero no reproducido por la revisión; la fortaleza del cierre es la inspección de la ruta más Vitest ejecutado en CI.
- **H02:** el control estructural quedó vinculado a la sentencia de `couriers` y al orden. La mutación que elimina `FOR UPDATE` mató ese control en `cc043` test 5. No elevar una prueba de forma a prueba de ejecución paralela; está explicitada como deuda en #601.
- **H03:** la prueba nueva no se limita a que una consulta devuelva campos de proyección; comprueba estado de envío real y falló en la mutación de bypass. La ampliación aprobada de la ficha quedó circunscripta al fixture.
- **Disciplina de CI:** el código `f3c43113` tuvo build verde y la bitácora `22d7d9c`, sin cambios de código, un fallo de compilación `next/font`. Distinguir incidente externo/no causal de defecto de implementación, y nunca afirmar que el head está totalmente verde si no lo está.
- **Lecciones AG:** sin numeración nueva ni cambio en `AGENTS.md`: la ronda no introdujo un hallazgo nuevo ni una batería independiente que lo justifique. Evitar atribuir pruebas ejecutadas por el autor a una ejecución propia del revisor.
