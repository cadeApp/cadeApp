# PR #228 — T-327 · El gate confiable corre notifications si el SHA lo trae

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/228 |
| **Tarea** | T-327 (Fase 3) · Issue #205 · habilita T-307 / PR #180 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/e2e-notifications-gate` → `develop` |
| **Base verificada R2** | `develop@abf89d8` · 4 ahead / 0 behind tras merge de sincronización |
| **Implementación funcional** | 3 archivos de infraestructura |
| **Estado** | abierta · **SIN BLOQUEANTES en Ronda 2** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `a3d13d72a440f2523698b83ce93d5330469cc3af` | 3 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c911032b2af21aced5a30121e2100aae834b4eca` | 1 residual de proceso, corregido en la ronda | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | La aserción no exigía que el bloque estuviera antes de la invocación chromium | medio | arreglado-verificado |
| H02 | `e2e-staging.yml` fuera del alcance original de T-327 | medio | aceptado por decisión P1 |
| H03 | Faltaban informe/checks/bitácora de la sesión | medio | arreglado-verificado |
| H04 | El informe usó `##` y `approval-policy` exige `### Informe de revisión de agy` | medio | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Pendiente después del merge

La PR #228 habilita el runner; no puede demostrar su propio efecto runtime porque el workflow privileged siempre sale de la rama por defecto. Después del merge:
1. sincronizar PR #180 con `develop`;
2. generar un nuevo Vercel Preview del SHA exacto;
3. verificar en el log trusted que corran los 3 tests de `notifications.spec.ts`;
4. recién entonces continuar la verificación RED/GREEN final de T-307.

#205 no se cierra con #228: sigue la decisión P1 3-A.
