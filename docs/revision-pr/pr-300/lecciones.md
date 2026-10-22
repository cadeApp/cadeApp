# Lecciones de PR #300

La ficha T-349 no añadió defectos técnicos; el alcance fue consistente con #243 y el helper en `develop`.

## Trazabilidad de decisiones

Dos frases que atribuían decisiones a Lautaro073 en el body/bitácora eran datos del agente, no evidencia suficiente de consentimiento. Se pidió confirmación conjunta y Lautaro073 las aceptó (1-A, 2-A). Es un caso de documentación de proceso, no una regresión de código.

No se propone regla AG nueva: ya existe el patrón `P10-desvio-de-ficha-sin-consultar`.

## Checks exact-head

Una cancelación del gate E2E por concurrencia/operación no se transforma en un supuesto GREEN. Se reejecuta el job y se exige status posterior realmente `success` en el SHA exacto. De forma similar, la frase heredada en el body sobre `verify-fichas` rojo se reemplaza con evidencia nueva 7/7 GREEN.

La implementación del control de aislamiento y su mutación RED pertenecen a una PR posterior.
