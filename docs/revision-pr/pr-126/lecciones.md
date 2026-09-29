# Lecciones — PR #126 (CC-013)

## Ronda 1

- **P08 — una clase de transformaciones necesita cobertura de toda la clase.** Un fixture con un solo helper puede dejar en verde una implementación que rompe cuatro variantes reales del mismo generador.
- Cuando el bug nace de diferencias de herramientas/generadores, conservar en la historia un artefacto real del fallo (`d52c4e7` → blob `caa03af`) permitió una verificación independiente mucho más fuerte que confiar en un fixture sintético.
- Las decisiones de contract-change se registran separadas de los hallazgos técnicos.
- No pedir cambios de estado manuales que una automatización del board va a revertir.

## Ronda 2

- La corrección de H01 quedó demostrada con la misma mutación que antes producía falso verde.
- Un gate automatizado también puede tener un hueco de dominio: `approval-policy` modela solo IDs `T-xxx` aunque el repo tiene ramas y PRs `CC-xxx`.
- No falsear metadatos para satisfacer un regex. Si P1 acepta una excepción, debe quedar explícita como excepción y no como check verde.
