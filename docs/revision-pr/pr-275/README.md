# PR #275 — T-343 · Vocabulario canónico del feed

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/275 |
| **Tarea** | T-343 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-343-feed-canonical-vocabulary` → `develop` |
| **Base** | `83aeb34f00d2a4e78332d4da9004e1bdaab6def5` |
| **Estado** | bloqueada en ronda 3: implementar decisión B para estabilizar `pnpm test` |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `4d9b4a19917a94b979f67add1a78f159c9b2cf3c` | 3 hallazgos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `bee887e9ee66313be532354b2ead22b4329f7a14` | 1 bloqueante nuevo | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `08dffbfb6c8c05750680b876c7b2d55a3eb38c4c` | decisión B: ampliar T-343 y corregir 2 tests de infraestructura | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR275-H01 | El SSR convertía un enum inválido en feed vacío | alto | **arreglado-verificado** |
| PR275-A01 | `feed-privacy.test.tsx` fuera de ficha base | decision | **aceptado** por Lautaro073 |
| PR275-H03 | Body sin formato requerido por `approval-policy` | medio | **arreglado-verificado** |
| PR275-H04 | `pnpm test` local no termina GREEN por dos fallos preexistentes de infraestructura | medio | **abierto — decisión B, arreglo autorizado** |

## Decisión de Lautaro073 — 2026-10-06

Lautaro073 eligió **B**: T-343 absorbe dentro de #275 los dos arreglos de infraestructura necesarios para cumplir el DoD local.

Archivos añadidos al alcance por el commit `eda5e34`:

- `src/server/rpc/cc007.test.ts`: solo aislar las mutaciones para que nunca reescriban el checkout real compartido.
- `tools/verify-scaffold.test.ts`: solo hacer determinista el lint bajo la suite completa, sin subir timeouts ni debilitar assertions.

## Qué queda por hacer

1. Corregir la carrera de `cc007.test.ts` sin tocar `guards.ts`, `guards.test.ts`, configuración global ni dependencias.
2. Corregir `verify-scaffold.test.ts` evitando que cada `it` pague un arranque en frío de ESLint; no aumentar timeouts.
3. Obtener **dos corridas consecutivas** de `pnpm test` completas con exit 0.
4. Actualizar bitácora y body con evidencia literal.
5. Pedir ronda 4.

El código funcional de T-343 ya está correcto; el único bloqueo restante es la estabilidad reproducible de la suite completa.
