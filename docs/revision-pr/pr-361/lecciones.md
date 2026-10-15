# Lecciones — PR #361, ronda 1

El objeto de esta revisión es un Draft TDD **todavía sin implementación**, de modo que no se atribuye a producción un defecto no implementado. Lo observado en tests es relevante desde ahora:

- **H02:** no compartir mocks acumulados entre casos que se verifican con `toHaveBeenCalled()`. Requerir aislamiento y mutación de la rama exacta.
- **H03:** los dobles deben representar la unión discriminada real de `ActionResult`; idealmente el tipo de TypeScript debe impedir la forma ficticia `{error: ...}`.
- **H04:** las pruebas de estados temporales deben congelar fecha/hora e incluir caducidad efectiva del backend, no solo el nombre del estado.

No se asigna un número AG nuevo ni se modifica `AGENTS.md` en esta ronda inicial. Revaluar tras tener código y evidencia independiente.

## Ronda 2 — patrones nuevos (sin número AG nuevo)
- **H05 / P08:** un E2E puede usar datos y RPC reales pero no comprobar la UI que dice proteger. Revisar cada spec nueva por `page`, navegación, interacción y oráculo del DoD.
- **H06 / P01:** un modal controlado desde el padre debe limpiar su estado también ante cierre `open=false` programático, no solo cuando su propio control emite `onOpenChange`.
- **H07 / P08:** `disabled={isPending}` no reemplaza una exclusión sincrónica al inicio del handler async ni su test con promesa diferida.
- **H08:** distinguir `ActionResult.ok=false` de una promesa rechazada. Cubrir ambos con oráculos distintos.
- **H09 / P04:** no calcular en el test la expectativa invocando la misma función de traducción de errores que se está validando. Probar además el camino productivo, no exclusivamente un callback inyectado.

Estos problemas están identificados por inspección; no proclamar mutaciones exitosas sin poder correrlas. No cambiar `AGENTS.md` por un caso aislado.
