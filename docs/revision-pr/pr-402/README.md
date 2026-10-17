# PR #402 — T-369 · Paso 2/3 UI de créditos y planes

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/402 |
| Tarea | T-369 / CC-029 / issue #356 |
| Autor | Lautaro073 |
| Rama | `feat/T-369-ui` → `develop` |
| SHA de código auditado (ronda 1) | `81f277970928dc50ddb1fcea709bf0319f9e6f64` |
| Ronda 1 | **CON BLOQUEANTES (4)**, D01-B resuelta |

## Rondas

- [Ronda 1](revisiones/ronda-1.md): H01 clave idempotente efímera; H02 error no-show solo toast; H03 100 planes sin paginación; H04 lectura con service role que debe migrar a RPC con AAL2 (D01-B).

## Estados

- **PR402-H01:** `abierto` (alto) — La clave de idempotencia de acreditación/plan se pierde al remontar el diálogo o recargar la página.
- **PR402-H02:** `abierto` (medio) — Un error al reportar no-show desde el diálogo solo se comunica con un toast genérico.
- **PR402-H03:** `abierto` (medio) — El catálogo está limitado a 100 planes sin paginación ni recuperación de registros restantes.
- **PR402-H04:** `abierto` (alto) — La lectura con service role no satisface la arquitectura D01-B aprobada; falta RPC de listado con permisos DB.
- **PR402-D01:** `aceptado` — D01-B elegida por Lautaro073; **aceptación de la decisión, NO de la implementación de H04**.

[Datos JSONL](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

Próxima ronda la hace la revisión independiente cuando agy publique nuevo código. No se aprobó ni mergeó la PR. El issue #356 sigue abierto, piloto gratis vigente.