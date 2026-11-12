# PR #736 — T-435 / CC-051 / SEC-12

- **PR:** https://github.com/cadeApp/cadeApp/pull/736
- **Autor:** Lautaro073 · **Rama:** `feat/T-435-sec12-realtime-capture` → `develop`
- **Base revisada:** `632a04f585d4f3ed511a04c45b9407cfe95ec00a`
- **Implementación revisada:** `43726568b8c9bd3bb989f3777a5c2ad5804f489b`
- **Head de lectura (bitácora):** `bf9bf78f05bc7f6cb894921355c052fa26a45cfe`
- **Ronda:** 1 · 2026-11-12 · **CON BLOQUEANTES (4), 1 mejora; sin decisiones nuevas**.
- **Archivos modificados por la PR:** `e2e/specs/courier-private-columns.spec.ts` y `docs/tasks/log/T-435.md` (ambos permitidos).
- **Captura real:** `e2e-preview` run [43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862) sobre `43726568`: CC-051 pasó (17,7 s), igual que T-345, pero el run completo falló por pruebas de onboarding (seguimiento #737), mapa y una flaky T-376. La captura demuestra el comportamiento observado, no la sensibilidad de todas las aserciones.
- **Control independiente local:** simulador en `evidencia/comandos.md`; control intacto GREEN, control S sin notes RED, **6/6 contraejemplos a los que el oráculo actual da GREEN**, corregido RED. No es Playwright ni una mutación de la base.
- **Limitación:** sin clon local disponible (resolución de GitHub bloqueada); comparación por conector GitHub, `mergeable=true`. No se ejecutó `git merge-tree`, `pnpm` ni `node docs/revision-pr/analizar.mjs verificacion` en el repo. Se validó la estructura JSONL en memoria.
- **Sin aprobación ni merge.** No exigir CI adicional únicamente por este commit documental de revisión.

## Rondas
| Ronda | SHA revisado | Estado | Informe |
|---|---|---|---|
| 1 | `43726568` (+ `bf9bf78f` de log) | 4 bloqueantes, 1 mejora | [ronda-1.md](revisiones/ronda-1.md) |

[Hallazgos estructurados](hallazgos.jsonl) · [Lecciones](lecciones.md) · [Evidencia y script completo](evidencia/comandos.md).

**Siguiente paso:** la implementación corrige H01–H04 solo en el spec, registra la bitácora y aporta una nueva captura E2E automática para la revisión de ronda 2. `git pull` antes de trabajar; sin rebase, force-push ni amend. La ejecución E2E global verde sigue pendiente del arreglo externo #737 y posibles fallos preexistentes; no se atribuyen esos fallos a T-435.
