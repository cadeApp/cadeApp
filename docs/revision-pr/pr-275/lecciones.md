# Lecciones de la PR #275 para `AGENTS.md` y las reglas

**Fuente:** 3 hallazgos de ronda 1.

## Patrón dominante

La alineación de vocabulario canónico está bien implementada en el camino feliz, pero el caso de dato inválido quedó con semántica distinta entre SSR y live: live falla explícitamente; SSR silencia el problema como lista vacía.

## Lecciones propuestas

### AG-01 · Un error de contrato no debe degradarse a “sin datos”
**Origen:** PR275-H01

Cuando una frontera valida datos externos con Zod, un fallo de contrato no debe reutilizar el mismo valor que representa un resultado legítimamente vacío.

> **Regla propuesta.** Si la UI tiene estado de error separado, un fallo de parseo/contrato en una consulta de datos debe activar ese estado; no convertirlo en `[]`, `null` o un default que también signifique “sin datos”.

### AG-02 · Mantener el informe de PR como contrato machine-readable
**Origen:** PR275-H03

Mismo patrón ya visto en #273: resumir `revisar-pr` rompe `approval-policy`.

> **Regla propuesta.** El bloque emitido por `revisar-pr` se pega completo y con sus encabezados exactos; un resumen adicional no lo reemplaza.

## Qué cambiar, en orden de impacto

1. Corregir la semántica de error SSR y su test.
2. Resolver la decisión de alcance de `feed-privacy.test.tsx`.
3. Pegar el formato exacto de `revisar-pr` en el body.

## Advertencias

- El hallazgo de alcance es una decisión, no un defecto funcional del fixture.
- `audit` no se atribuye a T-343.
