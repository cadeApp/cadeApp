# PR #95 — T-310 · Backups, observabilidad y simulacro de restauración

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/95 |
| **Tarea** | T-310 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-310-backups-observabilidad` → `develop` |
| **Base** | `cd0e69dabd31aa6531fa212d47a90c47e86ef155` |
| **Head revisado R4** | `513cad3f4528e5c7befbc0e2d92c31a39bbb7eae` |
| **Tamaño al SHA revisado** | 27 archivos, +2667 / -30 |
| **Estado** | abierta · Draft · **CON BLOQUEANTES (2: 1 técnico + 1 operativo)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `56f9c968` | 11 bloqueantes + 2 decisiones aceptadas | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `369756bd` | 4 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `135f7fe1` | H15 + H04 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `513cad3f` | H15 cerrado; H16 nuevo + H04 operativo | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado actual

- **H15:** arreglado-verificado.
- **H16:** **abierto técnico** — el arreglo de test salta la frontera Zod de env.
- **H04:** **abierto operativo** — simulacro real aún no ejecutado/verificado.
- Todos los demás hallazgos técnicos previos están cerrados o aceptados por decisión.

## Qué queda

1. **Agy:** corregir H16 sin tocar H04.
2. **Lautaro073:** ejecutar H04 en staging y aportar evidencia real.
3. Revisión independiente final sobre el SHA corregido y, si H04 ya fue ejecutado, cierre completo del DoD.

**No quedan decisiones humanas pendientes.**
