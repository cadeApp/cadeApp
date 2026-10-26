# PR #555 — T-416 · Seguridad: migración Zod 3 → 4

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/555 |
| Tarea | T-416 · Fase 4 (urgente) · #553 |
| Autor | @Lautaro073 |
| Rama | `feat/T-416-zod-v4` → `develop` |
| Base de comparación | `24b2e374f90f7fd1257e53ed5a750b2a0e4724bb` |
| Código y bitácora revisados | `48ec95b3b86b502a4349ae789f5fb7f0b258a9c4` |
| Alcance | 29 archivos; +232 / −98 líneas |
| Estado R1 | **CON BLOQUEANTES (2)**; una mejora no bloqueante |
| Decisión | D01 = A, comunicada por Lautaro073; no cambiar validador, fijar test |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `48ec95b3` | 2 bloqueantes de cierre; 1 mejora | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Hallazgo | Clase | Estado |
|---|---|---|---|
| PR555-H01 | Falta test explícito que rechace offset `+0300` | BLOQUEANTE (cobertura) | abierto |
| PR555-H02 | `e2e-preview` del HEAD quedó en error/cancelled | BLOQUEANTE (gate) | abierto |
| PR555-H03 | +13 kB First Load JS en 28 rutas | MEJORA | abierto · issue #561 |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Qué queda por hacer

1. Agregar en `src/domain/t416-zod-v4.test.ts` el negativo `2026-10-26T10:00:00+0300` y el positivo `2026-10-26T10:00:00+03:00`, con mutación RED y GREEN reales.
2. Tras el commit del autor, permitir que el próximo `e2e-preview` se ejecute hasta terminar sin cancelarlo, y conservar el resultado para el SHA nuevo.
3. Revisar ronda 2 y sus evidencias. No mergear antes de que termine sin bloqueantes.
4. La mejora de bundle y los límites de arrays se siguen por separado en issues #561 y #560, sin ampliar T-416.

**Alcance de esta revisión:** inspección GitHub, contraste de bitácora, tests y logs públicos de CI; no se ejecutó un clon local (no hay salida de red Git disponible en el entorno). No se da por reproducida independientemente ninguna mutación declarada por el autor. No se editó código de producción.

## Lecciones

Ver [lecciones.md](lecciones.md). No se crea AG nuevo sin poder enumerar el máximo en todas las ramas remotas.
