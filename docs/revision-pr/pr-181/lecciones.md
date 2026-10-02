# Lecciones — PR #181 / CC-015

## Ronda 1

No se crea un AG nuevo.

Se refuerzan patrones existentes:

- **P15:** una migración histórica modificada puede hacer pasar una reconstrucción desde cero y aun así no desplegar ningún cambio sobre un remoto ya migrado.
- **P03:** el contrato debe distinguir el error de rol (`UNAUTHORIZED_ACTOR`) del error de transición (`INVALID_STATE_TRANSITION`); agrupar actores en prosa vuelve inconsistente la fuente de verdad.
- **P19:** un documento contractual pegado en el body no reemplaza el template, la evidencia ni la auto-revisión.

Para cambios de DB, la revisión debe preguntar siempre “¿qué ejecutará un entorno que ya aplicó las migraciones anteriores?”, no solo “¿qué pasa al reconstruir la base desde cero?”.
