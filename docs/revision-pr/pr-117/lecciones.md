# Lecciones de la PR #117 para `AGENTS.md` y las reglas

**Fuente tras R4:** A01 + H01–H10.

## Patrón dominante

P08 sigue siendo la lección principal: el control debe alcanzar exactamente el invariante que declara. H10 ya quedó cerrado agregando el contracaso iOS Chrome/Firefox que faltaba.

## Estado al cierre de R4

- No quedan bloqueantes de código identificados.
- Queda una deuda de **evidencia de entorno real**, H04.
- No corresponde crear otra regla AG para una obligación que `visual-task-directive.md` ya expresa de forma explícita.

## Lección operativa

Cuando una tarea visual tiene DoD de navegador/captura, no permitir que una suite jsdom ni un comentario “verificación responsive” ocupe ese lugar. El checkbox debe permanecer abierto hasta que exista evidencia reproducible.
