# Lecciones de la PR #188 para `AGENTS.md` y las reglas

**Fuente:** 4 hallazgos de la Ronda 1.

## Patrón dominante

La batería RED se escribió alrededor de la implementación imaginada, pero dejó fuera dos clases del contrato: **el punto de integración real** (P08) y **variantes válidas del dominio** (P06).

## Lecciones propuestas

No se propone un AG nuevo en esta ronda. P06 y P08 ya describen exactamente los dos problemas y todavía no hay evidencia de que una regla nueva mejore sobre el catálogo existente.

## Qué cambiar, en orden de impacto

1. Antes de implementar T-324, agregar un test del Server Component real; no aceptar solo unit tests de query y leaf component.
2. Enumerar el enum completo y la cardinalidad real de la tabla, no solo los ejemplos del bug report.
3. Hacer de `documents` una prop obligatoria para que typecheck también proteja el wiring.

## Advertencias

- Esta ronda revisa un commit RED deliberado, no una implementación terminada.
- Dos semánticas fueron decididas por P1 durante la revisión: `rejected = Observado` y latest-by-`uploaded_at`.
