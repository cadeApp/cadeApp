# Lecciones de la PR #234 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 3 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

H01 sigue siendo `P08-control-no-cubre-lo-que-dice`. La progresión fue clara: texto del step → estructura del job → allowlist del job. Cada capa cerró lo anterior, pero la revisión anterior no enumeró el contexto top-level que heredan los `run`.

## Lecciones

No se asigna AG nuevo.

- **H01 / R1:** presencia textual no prueba alcanzabilidad.
- **H01 / R2:** blacklist de claves no prueba estructura completa.
- **H01 / R3:** allowlist del job no basta si el framework permite defaults heredados desde el workflow.
- **H02:** D01 quedó correctamente codificada y no regresa.

## Qué cambiar, en orden de impacto

1. Añadir allowlist top-level del workflow, conservando las allowlists ya presentes.
2. Mantener T-333 fuera del scope de T-332; arreglar su desincronización en su propio canal.
3. Auditar CI solo cuando ambos bloqueos desaparezcan.

## Corrección de la revisión

R2 sobrescribió por error `evidencia/comandos.md` y perdió el bloque de R1. R3 lo restaura. No se atribuye al autor.

## Advertencias

- No convertir el nuevo arreglo en otra blacklist de `defaults|env`; usar igualdad positiva de las claves top-level revisadas.
- El fallo de T-333 es heredado de develop y no debe contaminar el alcance de T-332.
