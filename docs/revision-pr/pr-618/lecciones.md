# Lecciones de PR #618 — CC-045 / T-423

**Fuente:** 5 hallazgos, cuatro tratados en documentación y uno trasladado a un issue de rollout (#619).

## Patrones que aparecieron

- **P06 — enumeración incompleta:** el contrato de Geocoding no distinguía `RANGE_INTERPOLATED`; el DoD inicial no reflejaba todas las condiciones del plan.
- **P01 — contrato externo no verificado:** `AGUILARES_BOUNDS` es válido para validación de dominio, pero no tiene la forma de `LatLngBoundsLiteral` exigida por Google.
- **P08 — control insuficiente:** descartar solo consultas viejas por id no preserva la elección manual cuando el usuario actúa durante una misma consulta.
- **P20 — justificación de seguridad incompleta:** actualizar una regla interna de privacidad no garantiza que el aviso legal dirigido a usuarios describa una nueva transferencia a un tercero.

## Regla candidata (sin nuevo AG por falta de recurrencia)

> Cuando una tarea incorpore APIs de geolocalización con datos personales, comprobar los tipos de parámetros contra el SDK real, enumerar todos los estados de calidad, agregar a la prueba de carreras las acciones manuales que ocurren *durante* la llamada y documentar en un aviso versionado cualquier nuevo destinatario externo de los datos antes del rollout.

No se agrega una numeración AG permanente: hace falta comprobar recurrencia contra otras PRs y consultar el máximo de todas las ramas remotas, que no puede obtenerse con git fetch en este entorno. No inventar un número.

## Advertencias

- Esta PR agrega solo documentación: los controles documentales no prueban que T-423 implemente correctamente la API.
- El issue #619 no significa que ya se informó a usuarios ni que se verificó la base jurídica. El cierre exige evidencia propia y versión del aviso.
- No exigir un nuevo CI solo por actualizar luego la bitácora de revisión; sí verificar que el cambio del DoD ya no deje `unit` rojo antes de mergear.
