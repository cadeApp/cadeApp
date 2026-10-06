# PR #275 — T-343 · Vocabulario canónico del feed

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/275 |
| **Tarea** | T-343 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-343-feed-canonical-vocabulary` → `develop` |
| **Base** | `83aeb34f00d2a4e78332d4da9004e1bdaab6def5` |
| **Estado** | **SIN BLOQUEANTES — ronda 4** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `4d9b4a19917a94b979f67add1a78f159c9b2cf3c` | 3 hallazgos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `bee887e9ee66313be532354b2ead22b4329f7a14` | 1 bloqueante nuevo | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `08dffbfb6c8c05750680b876c7b2d55a3eb38c4c` | decisión B; ampliar T-343 para estabilizar suite | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `44f61124f5fa5e2c1a5b62b58f772cb283e84254` | **SIN BLOQUEANTES** | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR275-H01 | El SSR convertía un enum inválido en feed vacío | alto | **arreglado-verificado** |
| PR275-A01 | `feed-privacy.test.tsx` fuera de ficha base | decision | **aceptado** por Lautaro073 |
| PR275-H03 | Body sin formato requerido por `approval-policy` | medio | **arreglado-verificado** |
| PR275-H04 | Suite completa inestable por mutaciones compartidas + cold-start de ESLint | medio | **arreglado-verificado** |

## Verificación final sobre `44f6112`

- alcance de ronda 3 respetado: solo `src/server/rpc/cc007.test.ts`, `tools/verify-scaffold.test.ts` y bitácora;
- `docs/revision-pr/pr-275/**` no fue tocado por el autor;
- `cc007.test.ts`: las mutaciones escriben solo en un worktree temporal detached y los Vitest hijos usan ese `cwd`;
- `verify-scaffold.test.ts`: un solo `eslint.lintFiles` batch en `beforeAll`, manteniendo las assertions previas;
- evidencia local del autor: dos `pnpm test` consecutivos con exit 0, 121/121 archivos y 1921/1921 tests;
- CI `unit`: 121/121 archivos, 1921/1921 tests, 64.15 s;
- `db-tests`: 18 archivos, 1811 tests, PASS;
- E2E preview: 33 + 3 tests PASS; T-343 específico PASS;
- Vercel ✅;
- `approval-policy` run 37414360623 ✅;
- `audit` ❌ advisory externo: `tinypool` / `source-map-js`, sin cambios de dependencias en T-343.

No quedan bloqueantes técnicos ni decisiones pendientes de esta revisión.
