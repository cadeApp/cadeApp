# Lecciones de la PR #234 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 4 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

H01 continúa siendo `P08-control-no-cubre-lo-que-dice`. La protección fue cerrando capas: línea → job → steps → top-level. R4 muestra que una allowlist de nombres no basta si un bloque permitido (`on:`) conserva semántica mutable que puede desactivar el gate.

## Lecciones

No se asigna AG nuevo.

- R1: presencia textual no prueba ejecución.
- R2: blacklist parcial no prueba estructura.
- R3: allowlist del job no prueba contexto heredado.
- R4: allowlist de claves top-level no prueba el contenido de un bloque que controla si el workflow se dispara.

## Qué cambiar

1. Fijar el bloque `on:` por igualdad positiva.
2. Conservar las allowlists ya ganadas de top-level/job/steps.
3. Auditar CI solo cuando H01 cierre.
4. Mantener el problema de T-333 fuera de esta PR.

## Advertencias

- No seguir agregando palabras prohibidas; el trigger debe expresarse como estructura esperada.
- El fallo T-333 sigue heredado de develop y no corresponde corregirlo desde T-332.
