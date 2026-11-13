# PR #736 — T-435 / CC-051 / SEC-12

- **PR:** https://github.com/cadeApp/cadeApp/pull/736
- **Autor:** Lautaro073 · **Rama:** `feat/T-435-sec12-realtime-capture` → `develop`
- **Base revisada:** `632a04f585d4f3ed511a04c45b9407cfe95ec00a`
- **Implementación revisada:** `43726568b8c9bd3bb989f3777a5c2ad5804f489b`
- **Head de lectura (bitácora):** `bf9bf78f05bc7f6cb894921355c052fa26a45cfe`
- **Ronda más reciente:** 3 · 2026-11-12 · **SIN BLOQUEANTES DE CÓDIGO** (H01–H05 verificados sobre ecb04e80, CC-051 PASS real). **Gate global de e2e-preview después del merge de #737 pendiente**, no declarar PR lista para merge mientras esté pendiente.
- **Archivos modificados por la PR:** `e2e/specs/courier-private-columns.spec.ts` y `docs/tasks/log/T-435.md` (ambos permitidos).
- **Captura real:** `e2e-preview` run [43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862) sobre `43726568`: CC-051 pasó (17,7 s), igual que T-345, pero el run completo falló por pruebas de onboarding (seguimiento #737), mapa y una flaky T-376. La captura demuestra el comportamiento observado, no la sensibilidad de todas las aserciones.
- **Control independiente local:** simulador en `evidencia/comandos.md`; control intacto GREEN, control S sin notes RED, **6/6 contraejemplos a los que el oráculo actual da GREEN**, corregido RED. No es Playwright ni una mutación de la base.
- **Limitación:** sin clon local disponible (resolución de GitHub bloqueada); comparación por conector GitHub, `mergeable=true`. No se ejecutó `git merge-tree`, `pnpm` ni `node docs/revision-pr/analizar.mjs verificacion` en el repo. Se validó la estructura JSONL en memoria.
- **Sin aprobación ni merge.** No exigir CI adicional únicamente por este commit documental de revisión.

## Rondas
| Ronda | SHA revisado | Estado | Informe |
|---|---|---|---|
| 1 | `43726568` (+ `bf9bf78f` de log) | 4 bloqueantes, 1 mejora | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `6fa6dd5bbc525ce75884f61940af2a5d26c2e2c2` | **1 bloqueante residual (H04); 4 corregidos por inspección/harness, sin verificación E2E nueva** | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `ecb04e80` (head `bcf71318`, merge `ab32909f`) | **0 bloqueantes de código; 5/5 verificados; gate E2E post-merge pendiente** | [ronda-3.md](revisiones/ronda-3.md) |

[Hallazgos estructurados](hallazgos.jsonl) · [Lecciones](lecciones.md) · [Evidencia y script completo](evidencia/comandos.md).

**Siguiente paso R3:** sin cambio de código solicitado. Mirar el `e2e-preview` automático del head con merge de #737 (`bcf71318`) y su resultado completo sobre ese SHA. Captura CC-051 PASS en [43322939621](https://github.com/cadeApp/cadeApp/actions/runs/43322939621) sobre `ecb04e80`, pero ese run global fue RED por tres casos de onboarding anteriores a #737. No exigir CI GREEN adicional solo por el commit documental del revisor. `git pull` antes de continuar; sin rebase, force-push ni amend.
