# PR #91 — T-203 · Emisor base de push

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/91 |
| **Tarea / issue** | `T-203` · #30 |
| **Autor** | @Lautaro073 · P1 |
| **Rama** | `feat/T-203-emisor-push` → `develop` |
| **develop ronda 3** | `42fb54a4df7e6529d1ccee3f96bcfbb0aced6f17` |
| **SHA producto ronda 3** | `926ca2eeda69dbde24db2494264c64bc524ba9a5` |
| **Estado** | ❌ bloqueada · 2 bloqueantes nuevos |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `038faab` | 8 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `6f867f1` | mismos 8; rama detenida por ficha | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `926ca2e` | 8 anteriores cerrados/aceptados; 2 bloqueantes nuevos | [ronda-3.md](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---:|---|
| A01 | alcance package/lock/web-push | alto | aceptado por PR #93 |
| H01 | alcance del fallo + platform/status | alto | arreglado-verificado |
| H02 | test best-effort/no-op | alto | arreglado-verificado |
| H03 | frontera WebPushTransport 404/410 | alto | arreglado-verificado |
| H04 | privacidad 5/5 variantes | alto | arreglado-verificado |
| H05 | matriz HTTP | medio | arreglado-verificado |
| H06 | test:db | medio | arreglado-verificado en CI |
| H07 | mutaciones semánticas documentadas | medio | arreglado-verificado |
| H08 | VAPID puede omitirse silenciosamente y ningún test observa `setVapidDetails` | alto | **abierto** |
| H09 | timeout Vitest global relajado a 15 s, incluido CI | alto | **abierto** |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md)

## Resultado ronda 3

La corrección de alcance de la opción A funcionó: T-203 ya no tiene que cablear las transiciones reales y T-206 (#92) las representa explícitamente. Los siete hallazgos técnicos anteriores y A01 ya no bloquean.

El barrido final detectó dos problemas distintos a los de las rondas previas: la configuración VAPID no está obligada/observada y `package.json` relajó el timeout global de pruebas/CI. Hasta corregir H08/H09, la PR no queda lista para merge.

No se aprueba ni se mergea esta PR.
