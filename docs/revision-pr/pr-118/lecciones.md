# Lecciones — PR #118 (T-206)

## Ronda 1

No se agrega una regla AG nueva en esta ronda.

Los hallazgos reutilizan reglas ya existentes:

- **PR118-H01:** enumeración completa de casos semánticos e idempotencia; la salida exitosa no implica una transición nueva.
- **PR118-H02:** pr-56/AG-37 — enumerar toda la clase de destinatarios; no usar una muestra como proxy.
- **PR118-H03:** pr-68/AG-74 — los efectos colaterales salen de las filas realmente actualizadas, no de una reconsulta más amplia.
- **PR118-H04:** P08 + pr-56/AG-37 — el test debe proteger los predicados que seleccionan al destinatario y prohibir extras.
- **PR118-H05 / M01:** pr-63/AG-68 y pr-68/AG-75 — la evidencia debe ser reproducible y la batería de mutaciones no puede reducirse a lo que el autor esperaba ver.
