# PR #318 — T-340 Paso 2/4 — Lectores multi-drop

**Rama:** `feat/T-340-lectores` → `develop`. **Draft; sin merge.** [PR #318](https://github.com/cadeApp/cadeApp/pull/318).

## Revisiones

| Ronda | SHA del autor | Informe |
|---|---|---|
| 1 | `4e70e934` | [R1](revisiones/ronda-1.md) |
| 2 | `9c5e797` | [R2](revisiones/ronda-2.md) |
| 3 | `e61fab67` | [R3](revisiones/ronda-3.md) |
| 4 | `c7cab174` | [R4](revisiones/ronda-4.md) |
| 5 | `58811a30` | [R5](revisiones/ronda-5.md) |
| 6 | `5a6daeed` | [R6](revisiones/ronda-6.md) |
| 7 | `a71b338b` | [R7](revisiones/ronda-7.md) |
| **8** | **`c50f5dfa`** | **[R8](revisiones/ronda-8.md): código corregido; RED y E2E pendientes** |
| **9** | **`838c7686`** | **[R9](revisiones/ronda-9.md): H06/H12 verificados por sondas independientes; sin bloqueantes nuevos de código** |

**R9:** H01–H08 y H10–H12 cerrados/verificados con métodos registrados; H09 sigue **parcial** exclusivamente por checkpoint E2E postmigración acordado en R8. Sobre SHA `838c7686`, GitHub `unit` 129 suites/2116 tests PASS, `db-tests` 21 suites/1995 tests PASS y typecheck/lint/build/audit/bundle-budget/Vercel PASS; `e2e-preview` BLOCKED por migración y `approval-policy` requería informe estructurado en el cuerpo de la PR, incorporado tras esta ronda. Mutaciones propias sobre cuerpos reales de helpers JS aislados; no se ejecutó Vitest mutado ni Playwright. PR Draft, sin merge.

**Decisión Lautaro073 R8, opción A:** merge **controlado** únicamente tras cierre de revisión sin defectos, RED documentado, CI técnico verde y autorización expresa del usuario. Después del merge, `migrate-develop` automático y E2E real obligatorio en Develop antes de Paso 3 de Kira. El workflow solo sirve a **PR abierta**, por lo que será necesaria una PR temporal de checkpoint solo documental desde Develop ya migrado, con Preview propio y sin archivos de migraciones. No tocar workflows ni migrar remoto manualmente. Registrado en `docs/tasks/T-340.md` commit `d55e71df`.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
