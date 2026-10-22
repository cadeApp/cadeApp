# Lecciones — PR #160

## Rondas 1-5

Se mantienen P08, P04, P06, P03, P19, P16, P10 y P01.

## Ronda 6

No se abre AG nuevo.

- **Sincronización no debe convertirse en bucle para el operador:** cuando develop avanza durante una revisión y los diffs no se superponen, la revisión puede efectuar el merge normal y revalidar CI en vez de devolver otra ronda solo por behind.
- **No usar `Closes` en tareas con gate post-merge:** si una tarea solo termina después de staging, el PR a develop debe usar `Refs #issue` y el issue debe permanecer abierto/en-curso hasta la verificación GREEN.
- **La acción manual debe quedar visible:** el comando y el orden develop→staging→E2E se dejaron tanto en el PR como en el issue, no solo en documentación interna.

### Decisiones P1 vigentes

- Ronda 1 — 1-A: ampliación mínima del arnés.
- Ronda 4 — 1-B: sin mutación RED local; evidencia real en staging.
- Ronda 5/6 — merge a develop no termina T-303; cierre solo tras staging GREEN.
