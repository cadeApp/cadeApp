# Lecciones de la PR #275 para `AGENTS.md` y las reglas

## AG-01 · Un error de contrato no debe degradarse a “sin datos”
**Origen:** PR275-H01 — corregido en ronda 2.

Un fallo de parseo en una frontera debe activar el estado de error cuando la UI distingue error de lista vacía.

## AG-02 · Mantener el informe de PR como contrato machine-readable
**Origen:** PR275-H03 — corregido en ronda 2.

El formato exacto vuelve a ser necesario para `approval-policy`.

## AG-03 · No mezclar evidencia de comandos distintos
**Origen:** PR275-H04

Un targeted test verde o un job equivalente de CI no permite marcar otro comando como verde si ese comando local terminó en fallo.

> **Regla propuesta.** En `Checks locales`, cada símbolo refleja literalmente la última salida del comando nombrado. Evidencia complementaria de CI o ejecuciones aisladas se anota aparte y nunca reemplaza el resultado del comando.

Esto refuerza una regla que ya existe en `AGENTS.md §4`: nunca declarar verde sin evidencia.
