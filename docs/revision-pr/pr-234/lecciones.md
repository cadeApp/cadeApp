# Lecciones de la PR #234 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 2 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

No aparece una familia nueva. H01 vuelve a ser `P08-control-no-cubre-lo-que-dice`: pasar de un regex barato a una validación estructural parcial cerró los bypasses conocidos, pero dejó abierto el entorno de ejecución del mismo step.

## Lecciones

No se asigna un AG nuevo.

- **H01 / R1:** presencia textual no demuestra que el comando sea alcanzable/bloqueante.
- **H01 / R2:** una blacklist de claves peligrosas tampoco cierra la clase; para un job de seguridad pequeño conviene allowlist de estructura y secuencia de steps.
- **H02:** D01 quedó correctamente codificada en la regla 00 y el scope se amplió solo al archivo exacto.

## Qué cambiar, en orden de impacto

1. Convertir H01 a allowlist estructural del job y sus cinco steps.
2. Mergear develop y conservar T-332/T-333 en el plan.
3. Recién con mergeability limpia, auditar CI final.

## Advertencias

- No agregar otro catálogo infinito de palabras prohibidas. La próxima corrección debe definir qué estructura **sí** es válida.
- El conflicto con T-333 es integración concurrente, no un defecto funcional de T-332.
