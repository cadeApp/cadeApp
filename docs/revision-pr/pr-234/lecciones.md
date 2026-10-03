# Lecciones de la PR #234 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos de Ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Esta ronda no descubre una familia nueva. Repite dos problemas ya conocidos: un control textual que protege menos de lo que su nombre promete y una decisión de seguridad correcta que todavía no quedó codificada en la regla normativa correspondiente.

## Lecciones

No se asigna un AG nuevo en Ronda 1.

- **H01** es otra instancia de `P08-control-no-cubre-lo-que-dice` y refuerza AG-75: la batería de mutaciones del autor cubría exactamente los bypasses que el autor había pensado; tres mutaciones nuevas de la revisión dejaron el control verde.
- **H02** encaja en `P20-justificacion-de-seguridad-no-escrita`: D01 aprueba el mecanismo, pero la regla 00 todavía expresa la política anterior.

## Qué cambiar, en orden de impacto

1. Hacer que el guard del audit pruebe el job/step bloqueante, no solo la presencia de una línea.
2. Codificar D01 en la regla 00 y acotar la ampliación de alcance a ese único archivo.
3. Recién con ambos cerrados, usar el CI del SHA corregido como evidencia de cierre.

## Advertencias

- La excepción GHSA en sí no es el hallazgo: el advisory sigue sin parche y pnpm 10.x soporta `auditConfig.ignoreGhsas`.
- No convertir H01 en una lista infinita de strings prohibidos. El arreglo debe proteger la estructura/semántica concreta del job actual.
