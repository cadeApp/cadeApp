# Revisión PR #68 — T-104 (`/api/cron/sweep` y `/api/health`)

| Campo                  | Valor                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| PR                     | [#68](https://github.com/cadeApp/cadeApp/pull/68)                      |
| Tarea                  | `T-104` · Issue #14                                                    |
| Rama                   | `feat/T-104-cron-sweep` → `develop`                                    |
| Autor                  | `Lautaro073` (P1)                                                      |
| SHA revisado (Ronda 1) | `e6d0b78` (El Consejo)                                                 |
| SHA revisado (Ronda 2) | `430ada3` (revisión independiente, Claude)                             |
| SHA revisado (Ronda 3) | `HEAD` (resolución integral verificada)                                |
| Resultado              | **SIN BLOQUEANTES · APTO** — ver [`ronda-3.md`](revisiones/ronda-3.md) |
| Fecha                  | 2026-09-24                                                             |

## Resumen

Implementación del endpoint de mantenimiento `/api/cron/sweep` (`src/server/cron/sweep.ts`, `src/app/api/cron/sweep/route.ts`), el healthcheck `/api/health` (`src/app/api/health/route.ts`) y la programación del cron diario en `vercel.json` (`0 6 * * *`).

- En Ronda 1 se registraron 8 hallazgos iniciales (`PR68-H01` a `PR68-H08`).
- En Ronda 2 (revisión independiente) se auditaron con batería de 15 mutaciones (`mut.mjs`), formalizando 4 bloqueantes pendientes (`H01`, `H03`, `H05`, `H09`), 2 decisiones resueltas por Lautaro073 (`D01`, `D02`) y 2 mejoras (`H08`, `H10`).
- En Ronda 3 se resolvieron e implementaron integralmente todos los bloqueantes y decisiones: propagación visible de error (500) ante fallo de Storage (`H01`), guardas TOCTOU con `.select(...)` defensivo en cascada (`H03`), eliminación de las 7 mutaciones ciegas con aserciones de payload e ids (`H05`, logrando 14/14 mutaciones en rojo y 0 ciegas), saneamiento documental y de bitácora (`H09`), configuración de `vercel.json` (`D01`), ordenamiento de escrituras duplicado-no-hueco (`D02`), eliminación de dobles casts `as unknown as` (`H08`), y prueba para setting de gracia ausente (`H10`).

## Estado de hallazgos (Ronda 3 — Cierre)

| ID         | Severidad  | Estado                     | Resumen                                                                                   |
| ---------- | ---------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| `PR68-H01` | `critico`  | ✅ arreglado-verificado    | Falla de Storage lanza error visible (500), sin marcar `purged_at` ni auditar (reintento) |
| `PR68-H02` | `alto`     | ✅ arreglado-verificado    | Integración con `canMerchantPublishRequest` (zona -03:00 y gracia)                        |
| `PR68-H03` | `alto`     | ✅ arreglado-verificado    | Guardas TOCTOU completas (`expires_at`, `paid_until`) encadenando `.select(...)`          |
| `PR68-H04` | `alto`     | ✅ arreglado-verificado    | `crypto.timingSafeEqual` y `runtime = 'nodejs'`                                           |
| `PR68-H05` | `alto`     | ✅ arreglado-verificado    | Aserciones completas de payloads e IDs (14/14 mutaciones rojas, 0 ciegas)                 |
| `PR68-H06` | `alto`     | ✅ arreglado-verificado    | Prettier limpio, DoD completo y verificado                                                |
| `PR68-H07` | `bajo`     | ✅ arreglado-verificado    | `target_type` en singular y `before` poblado en `audit_log`                               |
| `PR68-H08` | `bajo`     | ✅ arreglado-verificado    | Eliminados todos los dobles casts `as unknown as` en mocks de `storage`                   |
| `PR68-H09` | `medio`    | ✅ arreglado-verificado    | Bitácora, cuerpo y revisiones alineados con el código y evidencia real                    |
| `PR68-D01` | `decision` | ✅ implementado-verificado | `vercel.json` creado en la PR y autorizado en la ficha                                    |
| `PR68-D02` | `decision` | ✅ implementado-verificado | Reordenamiento de escrituras defensivo en TS (duplicado, no hueco)                        |
| `PR68-H10` | `bajo`     | ✅ arreglado-verificado    | Prueba añadida para setting de gracia ausente por defecto 0                               |

Informes: [`ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md) · [`ronda-3.md`](revisiones/ronda-3.md) · datos en [`hallazgos.jsonl`](hallazgos.jsonl) · comandos en [`evidencia/comandos.md`](evidencia/comandos.md)
