# Lecciones de PR #737 — T-434 / CC-050

**Fuente:** ronda 1, `0` hallazgos demostrados. **No se asigna AG nuevo** sin un defecto verificable.

## Observaciones comprobadas

- Una fixture originalmente adecuada para un administrador que decidía sobre un `pending` sin alta dejó de ser válida tras la guarda CC-050. La nueva precondición se crea mediante la RPC existente `finalize_courier_application`, no forzando la bandera directamente.
- Se conservaron exactamente las aserciones anteriores del spec: ninguna fue quitada ni adulterada. El corte estructural RED de M1, M2 y M3 no debe confundirse con Playwright RED/GREEN.
- El error 500 del feed ya tiene la issue abierta [#478](https://github.com/cadeApp/cadeApp/issues/478). Mantenerlo fuera del cambio mínimo no equivale a aceptar el gate rojo.

## Reglas existentes aplicables

- P08: contrastar lo que cubre el control con su invariante; no atribuirle cobertura funcional a la inspección de texto.
- AG-37: enumerar la clase entera (las tres pruebas administrativas) antes de declarar que las fixtures quedaron corregidas.
- Regla de pruebas T-434: no comentar código, simular verdes, degradar expectativas, introducir condicionales de test ni mocks que salteen producción.

**No se propone modificación a AGENTS.md** por esta ronda: el aprendizaje es aplicación de reglas existentes, no un patrón nuevo demostrado.
