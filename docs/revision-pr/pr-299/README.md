# PR #299 — T-339 · Precio de envío opcional y toma directa

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/299 |
| Tarea | T-339 (CC-021), autor @asako669 |
| Rama | `feat/T-339-precio-fijo` → `develop` |
| Código revisado R4 | `e3df20f5640af5d09c2ba3d9892214c87332cf28` |
| Base original de la feature | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| develop actual | `f33d688ff2517ae8e37ed53ba1404a3f4968ec45` (11 commits por delante) |
| Estado | **Código T-339 sin nuevos bloqueantes; integración pendiente, NO MERGEAR** |
| Decisiones | Opción A E2E posmigración vigente; opción A sobre `src/ui/ui-system.test.tsx` vigente |

## Rondas

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `6fbde29f48cc502ff497d18c4488fcd442246bf6` | 9 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5250d51922bf67a2f2555fe824c791ffe94ab1a3` | 5 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `4836122bbbea3266e3832a2f8d670b52b411dc70` | 4 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `e3df20f5640af5d09c2ba3d9892214c87332cf28` | Código corregido y DB PASS; audit rojo por lockfile antiguo, E2E diferido | [ronda-4.md](revisiones/ronda-4.md) |

## Estado de hallazgos a R4

| ID | Severidad | Estado |
|---|---|---|
| H01 | critico | arreglado-verificado |
| H02 | alto | arreglado-sin-verificar |
| H03 | alto | arreglado-verificado |
| H04 | alto | arreglado-verificado |
| H05 | alto | aceptado (diferido bajo decisión A; NO EJECUTADO) |
| H06 | alto | arreglado-verificado |
| H07 | medio | arreglado-verificado |
| H08 | alto | arreglado-sin-verificar |
| H09 | medio | arreglado-verificado |
| H10 | bajo | abierto |
| H11 | alto | arreglado-verificado |
| H12 | alto | arreglado-verificado |
| H13 | alto | arreglado-verificado |
| H14 | alto | arreglado-verificado |
| H15 | alto | arreglado-verificado |
| H16 | alto | arreglado-verificado |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Acción requerida antes de decidir merge

Pedir al agente `git pull origin feat/T-339-precio-fijo` y luego `git fetch origin && git merge --no-ff origin/develop` en la rama T-339; revalidación de CI **nuevo HEAD**. El parche crítico de `handlebars` ya fue mergeado a develop (PR #312); NO desactivar audit ni tocar dependencias T-339 manualmente. Ronda 5 tras push.

El gate E2E permanece bloqueado por migración y su ejecución es **posmigración por decisión A**, sin falsa aprobación de Playwright. No se aprobó ni mergeó la PR.
