# PR #582 — T-400 · Auditoría legible: motivos, nombres y etiquetas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/582 |
| **Tarea** | T-400 (Fase 4) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-400-audit-readable` → `develop` |
| **Base** | `f4bd475bdec8378fa819fc75388fc505b808bd25` |
| **SHA revisado** | `9a25af62e93b65f04a384758327ce608d98d3e5c` |
| **Tamaño** | 15 archivos, +793 / -54 líneas |
| **Estado** | **Ronda 1: CON BLOQUEANTES (2)**; PR Draft, sin aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9a25af62e93b65f04a384758327ce608d98d3e5c` | H01, H02 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR582-H01 | El recorte del motivo altera el dato auditado | medio | abierto |
| PR582-H02 | El catálogo dinámico no detecta ampliaciones de `p_action` | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué queda por hacer

1. Corregir H01 sin modificar nombres ni filtros: preservar exactamente el motivo registrado y probar espacios periféricos y saltos de línea.
2. Corregir H02 con dominio dinámico reconciliado **en ambos sentidos** y por origen, no solo presencia de los siete literales anteriores.
3. Probar RED→GREEN con casos reales, sin tests falsos ni expectativas debilitadas. La mutación propia de la revisión no se pudo correr como Vitest en este entorno.
4. Completar E2E del Preview y checks del SHA que implemente los arreglos. Revisión independiente de ronda 2.

**Alcance:** los 15 archivos de la PR están permitidos por la ficha, que es idéntica en `develop` y el head revisado. No se detectaron decisiones 🔵 que requieran cambiarla.

## Limitaciones

Este entorno no logró resolver `github.com` para clonar (`git ls-remote`: `Could not resolve host: github.com`) y no dispone de `pnpm`. No se ejecutaron `typecheck`, lint, Vitest, E2E ni `analizar.mjs` contra un clon local. Solo hay revisión por inspección y una sonda de mutación **en memoria del texto SQL**, no un RED de Vitest. Conforme al protocolo, se pospone la inspección de CI detallada mientras haya bloqueantes.
