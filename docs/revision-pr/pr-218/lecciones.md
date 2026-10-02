# Lecciones — PR #218

## Shared UI

Un wrapper no debe mantener una segunda máquina de estado invisible de un primitive externo si sus items reales no pertenecen a ese primitive. CC-018 agrega cobertura directa al modo controlado.

## Contrato end-to-end

Una propiedad protegida en la action puede volver a romperse en una RPC posterior. Después de T-328, la semántica de distancia debe probarse también en `publish_request`. T-330 formaliza ese hueco.

## Data migration

Cuando una tarea versiona una clasificación exacta `derivado/null`, el camino `ON CONFLICT` también debe converger a esa clasificación o el resultado depende del estado previo del ambiente.

## Fuentes

Una aprobación de lista basada en una captura/transcripción anterior debe reabrirse si una fuente primaria posterior revela una entrada adicional. El agente actuó correctamente al no incorporar `1º de Mayo` sin nueva decisión.

## Georreferenciación

La evidencia distingue correctamente “punto representativo derivado” de “centroide oficial”. Mantener esta distinción en UI/docs: error LOO de decenas de metros es compatible con recentrado aproximado, no con ubicación precisa.
