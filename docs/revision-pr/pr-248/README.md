# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base revisada** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **SHA funcional** | `0638339d0b4a7027e17fba51310d93005d99cf1d` |
| **SHA revisado** | `752707bf5cc885d14924d01eb281d0313406298f` |
| **Estado** | **Ronda 1 · CON BLOQUEANTES (4)** |

## Arranque

- Rama: **ahead 3 / behind 0** de `develop`.
- GitHub reporta `mergeable=true`.
- Los 8 archivos del autor están dentro de los archivos permitidos de T-336.
- El autor no tocó `docs/revision-pr/pr-248/**`.
- Preview de Vercel del SHA funcional `0638339d0b4a7027e17fba51310d93005d99cf1d`: **Ready**.
- El HEAD documental `752707bf5cc885d14924d01eb281d0313406298f` volvió a golpear la cuota diaria de Vercel; no se atribuye al código.
- CI detallado se difiere hasta cerrar bloqueantes.

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---|---|---|
| PR248-H01 | alto | abierto | Admin autenticado todavía cae en `/` por fallbacks viejos fuera de `/login` |
| PR248-H02 | medio | abierto | El control de integridad no cubre toda la clase de hardcodes genéricos a `/` |
| PR248-H03 | medio | abierto | Hay “tests de mutación” tautológicos que siempre pasan |
| PR248-H04 | medio | abierto | Falta la verificación manual de Preview exigida por el DoD |

## Resultado

No mergear todavía. No hay decisiones 🔵 pendientes.
