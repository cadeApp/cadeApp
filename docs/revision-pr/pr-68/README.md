# Revisión PR #68 — T-104 (`/api/cron/sweep` y `/api/health`)

| Campo                  | Valor                                                  |
| ---------------------- | ------------------------------------------------------ |
| PR                     | [#68](https://github.com/cadeApp/cadeApp/pull/68)      |
| Tarea                  | `T-104` · Issue #14                                    |
| Rama                   | `feat/T-104-cron-sweep` → `develop`                    |
| Autor                  | `Lautaro073` (P1)                                      |
| SHA revisado (Ronda 1) | `e6d0b78` (El Consejo)                                 |
| SHA revisado (Ronda 2) | `430ada3` (revisión independiente, Claude)             |
| Resultado              | **CON BLOQUEANTES (4) + 2 decisiones resueltas** — ver [`ronda-2.md`](revisiones/ronda-2.md) |
| Fecha                  | 2026-09-24                                             |

> ⚠️ **Corrección de la ronda 2:** esta tabla decía «APTO (8/8 hallazgos verificados)» con `verificado_en_sha: 4b76cb0`.
> **Ese commit no existe** en el repositorio, y lo marcó la misma cuenta que arregló (`AG-36`). La ronda 2 re-verificó
> los ocho: 4 cerrados, 4 parciales.

## Resumen

Implementación del endpoint de mantenimiento `/api/cron/sweep` (`src/server/cron/sweep.ts`, `src/app/api/cron/sweep/route.ts`) y el healthcheck `/api/health` (`src/app/api/health/route.ts`).

En el commit `8872b89`, el agy que realizó la tarea escribió prematuramente esta carpeta (`docs/revision-pr/pr-68/`) declarando `SIN BLOQUEANTES` con `hallazgos.jsonl` vacío (0 registros), y en `e6d0b78` aplicó un ajuste sobre `audit_log.target_type`. Siguiendo `docs/revision-pr/COMO-ENTREGAR.md` (precedente de `pr-56/autorrevision-agy.md`), se conserva esa autorrevisión en [`autorrevision-agy.md`](autorrevision-agy.md) para contraste, y se registra en [`revisiones/ronda-1.md`](revisiones/ronda-1.md) la revisión independiente de **El Consejo** sobre `e6d0b78`. La carpeta marcaba después «8/8 verificados» sobre `4b76cb0`, un commit inexistente; la [ronda 2](revisiones/ronda-2.md) (revisión independiente sobre `430ada3`) re-verificó: 4 cerrados, 4 parciales, 1 hallazgo nuevo y 2 decisiones.

## Estado de hallazgos (después de la ronda 2)

| ID | Severidad | Estado |
| --- | --- | --- |
| `PR68-H01` | `critico` | ⚠️ parcial: reintenta, pero la falla de Storage responde 200 |
| `PR68-H02` | `alto` | ✅ verificado en `430ada3` |
| `PR68-H03` | `alto` | ⚠️ parcial: las guardas no cubren republicar ni renovar; auditoría sale del `select` |
| `PR68-H04` | `alto` | ✅ verificado en `430ada3` |
| `PR68-H05` | `alto` | ⚠️ parcial: 7 de 12 mutaciones ciegas |
| `PR68-H06` | `alto` | ✅ verificado en `430ada3` |
| `PR68-H07` | `bajo` | ✅ verificado en `430ada3` |
| `PR68-H08` | `bajo` | ⚠️ parcial: quedan 7 dobles casts en los mocks de `storage` |
| `PR68-H09` | `medio` | abierto: verificación sobre un SHA inexistente; bitácora y cuerpo contra el código |
| `PR68-D01` | `decision` | decidido: `vercel.json` entra en T-104 |
| `PR68-D02` | `decision` | decidido: reordenar las escrituras para que un fallo deje duplicado, no hueco |
| `PR68-H10` | `bajo` | abierto (mejora): setting de gracia ausente |

Informes: [`ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md) · datos en [`hallazgos.jsonl`](hallazgos.jsonl) · comandos en [`evidencia/comandos.md`](evidencia/comandos.md)
