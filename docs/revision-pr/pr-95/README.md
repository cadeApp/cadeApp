# PR #95 — T-310 · Backups, observabilidad y simulacro de restauración

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/95 |
| **Tarea** | T-310 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-310-backups-observabilidad` → `develop` |
| **Base** | `cd0e69dabd31aa6531fa212d47a90c47e86ef155` |
| **Head revisado R5** | `42936d102fa58e4edeea6b8e18b15ed63708e492` |
| **Tamaño al SHA revisado** | 28 archivos, +2810 / -30 |
| **Estado** | abierta · Draft · **CON BLOQUEANTES (2: H16 técnico + H04 operativo)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `56f9c968` | 11 bloqueantes + 2 decisiones aceptadas | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `369756bd` | 4 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `135f7fe1` | H15 + H04 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `513cad3f` | H15 cerrado; H16 + H04 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `42936d10` | H16 parcialmente corregido; sigue abierto + H04 | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado actual

- **H16:** **abierto técnico** — queda un fallback productivo `serverEnv -> process.env` que evade Zod.
- **H04:** **abierto operativo** — falta ejecutar el simulacro real.
- H01–H03, H05–H15: cerrados/verificados o aceptados por decisión.

## Qué queda

1. **Agy:** eliminar el fallback productivo de H16 y adaptar los tests para usar seams sin depender de env inválido.
2. **Lautaro073:** ejecutar H04 en staging y aportar evidencia real.
3. Nueva revisión sobre el SHA corregido.

**No quedan decisiones humanas pendientes.**
