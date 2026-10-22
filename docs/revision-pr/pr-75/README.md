# PR #75 — T-105 · RPC de admin

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/75 |
| **Tarea** | T-105 (Fase 1, núcleo transaccional) · issue #15 |
| **Autor** | @Lautaro073 (agy) |
| **Rama** | `feat/T-105-admin-rpc` → `develop` |
| **Base** | `b6b5f39` |
| **Tamaño** | 4 archivos, +889 líneas |
| **Estado** | **Sin bloqueantes** (ronda 6, `d18c562`); lista para que Lautaro073 pegue el informe y decida el merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `834b915` | 14 + 4 decisiones | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `b257f1b` | 3 nuevos + 1 decisión; 12 cerrados y verificados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `c9585ba` | 1 nuevo; 4 cerrados y verificados | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `904e3df` | 4 nuevos + 1 decisión; 0 cerrados | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `02dca77` (+ `e6f43f7`) | 1 nuevo (de la #79); 6 cerrados y verificados | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |
| 6 | `d18c562` | 1 decisión; 4 cerrados y verificados · **SIN BLOQUEANTES** | [`revisiones/ronda-6.md`](revisiones/ronda-6.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `admin_verify_document` falla siempre (`22P02`, literales de `kind`) | alto | arreglado-verificado (`b257f1b`) |
| H02 | `admin_suspend_courier` falla siempre (`42703`, `offers.withdrawn_at`) | alto | arreglado-verificado (`b257f1b`) |
| H03 | `admin_set_subscription` valida contra un enum inventado | alto | arreglado-verificado (`b257f1b`) |
| H04 | `rpc_admin.sql` corre 0 de 25; `test:db ✅` y TDD declarados sin evidencia | alto | arreglado-verificado (`c9585ba`) |
| H05 | La suite no cubre el DoD (efectos, aal2, estado incorrecto, ofertas pending) | alto | arreglado-verificado (`c9585ba`) |
| H06 | El wrapper codifica dos veces `p_value` | alto | arreglado-verificado (`b257f1b`) |
| H07 | Las funciones son ejecutables por `PUBLIC`/`anon` | medio | arreglado-verificado (`b257f1b`) |
| H08 | Sin test de contrato; fake y RPC divergen | medio | arreglado-verificado (`02dca77` + CC-005, integrado) |
| H09 | `INVALID_SETTING_*` inalcanzables por el wrapper | medio | arreglado-verificado (`b257f1b`) |
| H10 | El motivo se exige y se descarta; no se escribe `audit_log` | alto | arreglado-verificado (`b257f1b`) |
| H11 | `database.types.ts` sin regenerar | medio | arreglado-verificado (`02dca77`) |
| H12 | `paid_until` se borra cuando no viene y `notes` no | bajo | abierto (mejora) |
| H13 | `pilot_terms_version` acepta solo espacios | bajo | arreglado-verificado (`b257f1b`) |
| H14 | Preámbulo de autorización copiado cinco veces | bajo | abierto (mejora) |
| D01 | Ampliar la ficha con los tipos y el test del wrapper | decision | arreglado-verificado (en la rama, no en develop) |
| D02 | Auditoría dentro de cada RPC | decision | arreglado-verificado (`b257f1b`) |
| D03 | `decide` solo desde `pending` | decision | arreglado-verificado (`b257f1b`) |
| D04 | `verify` solo desde `submitted` y sin purgar | decision | arreglado-verificado (`b257f1b`) |
| D05 | CC del fake antes del merge | decision | arreglado-verificado (`d18c562`) |
| H15 | Caso 7 de `admin.test.ts` tautológico | bajo | abierto (mejora) |
| H16 | `VALID_SETTING_KEYS` copia `PLATFORM_SETTING_KEYS` | bajo | arreglado-verificado (`c9585ba`) |
| H17 | `before` del audit de `update_setting` sin lock | bajo | arreglado-verificado (`c9585ba`) |
| H18 | Bitácora sin la sesión; commit y cuerpo declaran H08/H11 resueltos | alto | arreglado-verificado (`d18c562`, contra CI) |
| A01 | Cambio de contrato (fake) dentro de T-105, fuera de alcance y sin CC | alto | arreglado-verificado (`02dca77`) |
| D06 | Llevar el fake a `cc/CC-005` | decision | arreglado-verificado (`d18c562`) |
| H19 | El test de contrato afirma la divergencia (suspender a un suspendido → OK) | alto | arreglado-verificado (`02dca77` + CC-005) |
| H20 | Validaciones inalcanzables en el fake | bajo | arreglado-verificado (inspección) |
| H21 | Cuerpo del PR fuera de la plantilla; `approval-policy` va a fallar | alto | arreglado-verificado (`02dca77`) |
| H22 | `CC-005.md` afirma `purgedAt == null` y el fake no lo tiene | bajo | arreglado-verificado (`53bd0ef`) |
| D07 | La #79 se mergeó sin validación de P2 | decision | aceptado: validación a posteriori de @KiraK72 |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Lautaro073 pega en el cuerpo el informe de la revisión independiente (comentario de cierre de la ronda 6), en lugar del del agy.
2. Mirar el CI del head nuevo (mi commit lo mueve) y decidir el merge.
3. Pedirle a @KiraK72 la validación a posteriori de la #79 (D07).
4. Fuera de esta PR: `audit_log_admin` es `for all` (T-005). Merece su propia tarea.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (`AG-64` a `AG-72`). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd).
