# Lecciones de la PR #509 para las reglas

**Fuente:** 1 hallazgo (PR509-H01), registrado en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

P08-control-no-cubre-lo-que-dice: una prueba específica del bug se puso verde en el parche correcto, pero dejó pasar otro `if` que reproduce el mismo fallo operativo (job salteado durante `schedule`). También tolera un `if` multilínea con `vars`.

## Lección para controles de workflows

Si el contrato exige que un job no tenga condiciones, afirmar **ausencia del campo `if` completo**, no solo que su texto no incluya una variable problemática. En la mutación, usar al menos una condición semánticamente equivalente con otra expresión (por ejemplo, ejecutar solo en `workflow_dispatch`) y otra con forma YAML distinta (bloque escalar). Confirmar verde sin mutar y rojo para cada variante.

Este caso refuerza P08 ya catalogado. No se asigna un número `AG-xx` nuevo sin corroborar el máximo en todas las ramas remotas; no editar `AGENTS.md` por una sola PR.

## Advertencias

La reproducción realizada aquí evalúa el predicado del test en un harness aislado y **no** sustituye la ejecución del archivo de tests completo. El control nuevo debe verificarse en la siguiente ronda contra el código pusheado. La validez operativa del job requiere una corrida programada tras el merge al branch predeterminado.
