# Lecciones de la PR #278 para `AGENTS.md` y las reglas

**Fuente:** 0 hallazgos en ronda 1.

## Patrón dominante

No apareció un patrón defectuoso nuevo en esta PR documental. La ficha nace de un fallo externo de advisories y lo convierte en una tarea con controles explícitos.

## Lecciones propuestas

Ninguna en esta ronda.

## Qué cambiar, en orden de impacto

1. No corresponde cambiar reglas por esta PR.
2. Durante la implementación de T-344, conservar la evidencia RED/GREEN de audit y verificar la migración completa de Vitest 4, especialmente cobertura y mocks.

## Advertencias

- El `audit` rojo es el origen de la tarea, no evidencia contra la ficha.
- La futura implementación puede descubrir cambios de API de Vitest 4 en tests concretos; cualquier ampliación de alcance requiere decisión explícita y no puede cambiar aserciones para fabricar GREEN.
