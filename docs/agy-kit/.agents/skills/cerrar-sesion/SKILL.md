---
name: cerrar-sesion
description: >-
  Usar siempre antes de terminar una sesión de trabajo en una tarea T-xxx de cadeApp, esté o no terminada,
  para que cualquier otra persona pueda continuarla.
---
# Cerrar la sesión

1. Corré `pnpm typecheck && pnpm lint && pnpm test` (y `pnpm test:db` si aplica). No hace falta que pase todo,
   pero el resultado va a la bitácora tal cual.
2. Agregá una entrada al final de `docs/tasks/log/T-xxx.md` con la plantilla: fecha y hora, persona, qué se hizo,
   decisiones tomadas y por qué, estado de cada prueba, qué falta, bloqueos y **Próximo paso** concreto.
3. Actualizá las casillas del DoD en la descripción del PR (solo las verificadas en esta sesión).
4. Commit de todo lo pendiente (aunque sea WIP): `wip(T-xxx): <resumen> [T-xxx]`.
5. Escribí el hash en "Último commit" de la entrada, commiteá la bitácora (`docs(T-xxx): session log`) y `git push`.
6. Si la tarea está terminada: verificá el DoD completo, pegá la salida de los checks en el PR y pedile a la persona
   que lo pase a "Ready for review" y mueva el issue a "En review".
7. Si la persona suelta la tarea: que comente en el issue "Suelto T-xxx; bitácora al día en <hash>" y se desasigne.
