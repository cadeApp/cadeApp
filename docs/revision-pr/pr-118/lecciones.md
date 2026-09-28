# Lecciones — PR #118 (T-206)

## Ronda 1

No se agrega una regla AG nueva en esta ronda.

Los hallazgos reutilizan reglas ya existentes:

- **PR118-H01:** enumeración completa de casos semánticos e idempotencia; la salida exitosa no implica una transición nueva.
- **PR118-H02:** pr-56/AG-37 — enumerar toda la clase de destinatarios; no usar una muestra como proxy.
- **PR118-H03:** pr-68/AG-74 — los efectos colaterales salen de las filas realmente actualizadas, no de una reconsulta más amplia.
- **PR118-H04:** P08 + pr-56/AG-37 — el test debe proteger los predicados que seleccionan al destinatario y prohibir extras.
- **PR118-H05 / M01:** pr-63/AG-68 y pr-68/AG-75 — la evidencia debe ser reproducible y la batería de mutaciones no puede reducirse a lo que el autor esperaba ver.

## Ronda 2

No se agrega una regla AG nueva; los problemas encajan en lecciones ya existentes.

- **H04/H05:** pr-63/AG-70 — un rojo causado por la forma incompleta del mock/TypeError no demuestra la propiedad semántica. La mutación sin `decided_at` debe incluir un histórico y fallar por destinatario extra.
- **H06/H07:** pr-56/AG-37 — al integrar side effects best-effort hay que enumerar fallos por throw y fallos in-band `{ error }`; ninguno puede alterar el flujo principal ni producir destinatarios distintos.
- **R01:** P08 — no introducir una rama productiva que omita el mismo control que el test dice exigir.
- **M02:** pr-63/AG-68 — cifras de evidencia pertenecen al SHA/run concreto y no deben mezclarse entre local y CI.
