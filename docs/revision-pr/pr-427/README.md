# PR #427 — timeout del E2E de staging

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/427 |
| **Tarea declarada** | T-315 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/staging-e2e-timeout-45-20261019` → `develop` |
| **Base funcional** | `59fb3daa82eb1c0394dca9bad143d7fd246ec34b` |
| **HEAD revisado** | `6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46` |
| **Estado** | CON BLOQUEANTES (1) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46` | 1 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

El cambio funcional es exclusivamente `timeout-minutes: 20` → `45`. No cambia cobertura, aserciones, comandos, specs, workers ni triggers. El bloqueo es de alcance: T-315 no autoriza `.github/workflows/e2e-staging.yml`.

[Evidencia](evidencia/comandos.md) · [Hallazgos](hallazgos.jsonl) · [Prompt detallado](prompt-agy-ronda-1.md)
