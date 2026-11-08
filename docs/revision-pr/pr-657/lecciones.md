# Lecciones de PR #657 — CC-047 / T-408

**Fuente:** cuatro hallazgos de la ronda 1, todos por inspección; ver `hallazgos.jsonl`.

## Patrón dominante

El CC enumeró sus policies principales, pero no toda la superficie impactada: se pasó por alto la semántica efectiva de `SECURITY DEFINER` (H01), pruebas históricas de corrección administrativa CC-031 (H02), otra suite que depende de notas (H03) y la insuficiencia de igualdad textual como prueba de procedencia para un backfill destructivo (H04).

## Candidatos a lección para próxima consolidación (sin nuevo número AG)

- **H01:** ante un trigger condicionado al rol SQL, probar `current_user` bajo el modo real de seguridad de la función; no confundir la identidad del invocador con la del propietario.
- **H02/H03:** antes de prometer una lista exhaustiva de pgTAP afectados, recorrer todas las suites y los scripts de integración que escriben o consultan la API modificada, incluidos controles de carrera históricos. No debilitar assertions: migrar al nuevo contrato conservando su propiedad.
- **H04:** prohibir borrados automáticos de datos de usuario cuando su procedencia se infiere solo por coincidencia textual; separar la lista SELECT de candidatos de la decisión humana por ambiente.

**Numeración AG:** no asignada en esta ronda. El entorno no dispone de un clon con todas las referencias remotas para calcular el máximo global de AG; se evita reutilizar un identificador. Revaluar en consolidación cuando se pueda ejecutar el comando de la norma sobre todas las ramas remotas.

## Prioridad de controles

1. pgTAP del trigger con fallo inducido y modo invoker/definer.
2. pgTAP e integración CC-031 compatibles con RPC auditadas y locks.
3. pgTAP de invariante sobre `merchants.notes` con nota enviada a auditoría.
4. Suite de consulta de candidatos sin mutación de notas; evidencia manual por ambiente.

Esta PR es contractual: no se deduce éxito de los futuros tests a partir de que el texto esté corregido.
