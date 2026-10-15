# Lecciones — PR #361, ronda 1

El objeto de esta revisión es un Draft TDD **todavía sin implementación**, de modo que no se atribuye a producción un defecto no implementado. Lo observado en tests es relevante desde ahora:

- **H02:** no compartir mocks acumulados entre casos que se verifican con `toHaveBeenCalled()`. Requerir aislamiento y mutación de la rama exacta.
- **H03:** los dobles deben representar la unión discriminada real de `ActionResult`; idealmente el tipo de TypeScript debe impedir la forma ficticia `{error: ...}`.
- **H04:** las pruebas de estados temporales deben congelar fecha/hora e incluir caducidad efectiva del backend, no solo el nombre del estado.

No se asigna un número AG nuevo ni se modifica `AGENTS.md` en esta ronda inicial. Revaluar tras tener código y evidencia independiente.
