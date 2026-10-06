# PR #275 — T-343 · Vocabulario canónico del feed

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/275 |
| **Tarea** | T-343 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-343-feed-canonical-vocabulary` → `develop` |
| **Base** | `83aeb34f00d2a4e78332d4da9004e1bdaab6def5` |
| **Estado** | bloqueada en ronda 2 por evidencia local de `pnpm test` |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `4d9b4a19917a94b979f67add1a78f159c9b2cf3c` | 3 hallazgos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `bee887e9ee66313be532354b2ead22b4329f7a14` | 1 bloqueante nuevo | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR275-H01 | El SSR convertía un enum inválido en feed vacío | alto | **arreglado-verificado** |
| PR275-A01 | `feed-privacy.test.tsx` fuera de ficha base | decision | **aceptado** por Lautaro073 |
| PR275-H03 | Body sin formato requerido por `approval-policy` | medio | **arreglado-verificado** |
| PR275-H04 | El body marca `test ✅` aunque `pnpm test` local terminó con 4 fallos | medio | **abierto** |

## Qué queda por hacer

1. Reejecutar `pnpm test` completo hasta obtener una corrida GREEN real, o si vuelve a fallar, dejar el check local como ❌ y tratar los timeouts según corresponda.
2. Corregir el body para que `Checks locales:` refleje exactamente el resultado real; no mezclar targeted tests o CI como si fueran el resultado de `pnpm test` local.
3. Pedir ronda 3.

## Estado de CI observado sobre `bee887e`

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- e2e-preview ✅
- approval-policy ✅
- audit ❌ — advisories externos a T-343

El código funcional de H01 quedó correcto; el único bloqueante restante es de evidencia/DoD.
