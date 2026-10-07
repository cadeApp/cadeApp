# Lecciones de la PR #302 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

El código de RLS puede ser correcto y aun así la prueba negativa no proteger la frontera que su nombre promete. En seguridad, «deniega otro actor» no equivale a «deniega self».

## Lecciones propuestas

No se agrega una regla global nueva en esta ronda.

- H01 reutiliza **P08 — control no cubre lo que dice**.
- H02 reutiliza **P15 — entregable declarado pero no ejecutable/demostrado**.

La regla de pruebas vigente ya exige RED real. La corrección debe mejorar la instancia de prueba, no sumar más prosa global.

## Qué cambiar, en orden de impacto

1. Hacer que los negativos RLS usen exactamente la identidad/frontera declarada por el DoD.
2. No marcar «cada prueba nueva RED» usando como evidencia el RED de otro caso de la misma suite.

## Advertencias

- Esta PR es pequeña y atípicamente centrada en RLS; no generalizar una nueva AG solo por este caso.
- El problema no está en la policy productiva actual sino en la capacidad del test para detectar una regresión futura.
