# Lecciones de la PR #254 para `AGENTS.md` y las reglas

**Fuente:** 6 hallazgos tras dos rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

El patrón sigue siendo P08: un control puede parecer alineado con el flujo y aun medir otra cosa. R1 lo mostró con fallbacks; R2 lo muestra con evidencia de `--list` presentada como si validara ejecución y con una precondición criptográfica que puede usar otra clave.

## Lecciones propuestas

No se agrega AG nueva en R2.

- H05 refuerza **AG-70 / P08**: descubrir tests no equivale a ejecutarlos, y un RED anterior no verifica una prueba que fue reescrita después.
- H06 refuerza la regla de paridad entre test y producción: una precondición criptográfica usa la misma clave/configuración o falla cerrada; nunca inventa un valor alternativo.

## Qué cambiar, en orden de impacto

1. Exigir GREEN real del E2E después de cada reescritura sustancial.
2. Guardar salida RED de las mutaciones exactas que protegen cada invariante.
3. Fallar cerrado cuando falta configuración sensible que define la semántica del escenario.

## Advertencias

- `approval-policy` rojo no es un hallazgo técnico aquí: pide la aprobación humana de Lautaro073 y debe quedar para el final.
- La bitácora es append-only: errores narrativos previos se aclaran en una entrada nueva, no se reescriben.