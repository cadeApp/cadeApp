# Lecciones — PR #126 (CC-013)

## Ronda 1

- **P08 — una clase de transformaciones necesita cobertura de toda la clase.** Un fixture con un solo helper puede dejar en verde una implementación que rompe cuatro variantes reales del mismo generador.
- Cuando el bug nace de diferencias de herramientas/generadores, conservar en la historia un artefacto real del fallo (`d52c4e7` → blob `caa03af`) permitió una verificación independiente mucho más fuerte que confiar en un fixture sintético.
- Las decisiones de contract-change se registran separadas de los hallazgos técnicos. La aprobación de P1 no convierte el código en aprobado para merge mientras haya bloqueantes.
- No pedir cambios de estado manuales que una automatización del board va a revertir. En T-300, `board-sync` fuerza `en-review` porque PR #123 está abierta.
