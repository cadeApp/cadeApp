# PR #75 — T-105 · RPC de admin

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/75 |
| **Tarea** | T-105 (Fase 1, núcleo transaccional) · issue #15 |
| **Autor** | @Lautaro073 (agy) |
| **Rama** | `feat/T-105-admin-rpc` → `develop` |
| **Base** | `b6b5f39` |
| **Tamaño** | 4 archivos, +889 líneas |
| **Estado** | Draft · **bloqueada** (ronda 2: 4 bloqueantes; D05 decidido: CC del fake antes del merge) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `834b915` | 14 + 4 decisiones | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `b257f1b` | 3 nuevos + 1 decisión; 12 cerrados y verificados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `admin_verify_document` falla siempre (`22P02`, literales de `kind`) | alto | arreglado-verificado (`b257f1b`) |
| H02 | `admin_suspend_courier` falla siempre (`42703`, `offers.withdrawn_at`) | alto | arreglado-verificado (`b257f1b`) |
| H03 | `admin_set_subscription` valida contra un enum inventado | alto | arreglado-verificado (`b257f1b`) |
| H04 | `rpc_admin.sql` corre 0 de 25; `test:db ✅` y TDD declarados sin evidencia | alto | **abierto**: corre 0 de 36 |
| H05 | La suite no cubre el DoD (efectos, aal2, estado incorrecto, ofertas pending) | alto | **parcial**: 9 mutaciones ciegas |
| H06 | El wrapper codifica dos veces `p_value` | alto | arreglado-verificado (`b257f1b`) |
| H07 | Las funciones son ejecutables por `PUBLIC`/`anon` | medio | arreglado-verificado (`b257f1b`) |
| H08 | Sin test de contrato; fake y RPC divergen | medio | **parcial**: el fake diverge (D05) |
| H09 | `INVALID_SETTING_*` inalcanzables por el wrapper | medio | arreglado-verificado (`b257f1b`) |
| H10 | El motivo se exige y se descarta; no se escribe `audit_log` | alto | arreglado-verificado (`b257f1b`) |
| H11 | `database.types.ts` sin regenerar | medio | **abierto**: escrito a mano |
| H12 | `paid_until` se borra cuando no viene y `notes` no | bajo | abierto (mejora) |
| H13 | `pilot_terms_version` acepta solo espacios | bajo | arreglado-verificado (`b257f1b`) |
| H14 | Preámbulo de autorización copiado cinco veces | bajo | abierto (mejora) |
| D01 | Ampliar la ficha con los tipos y el test del wrapper | decision | arreglado-verificado (en la rama, no en develop) |
| D02 | Auditoría dentro de cada RPC | decision | arreglado-verificado (`b257f1b`) |
| D03 | `decide` solo desde `pending` | decision | arreglado-verificado (`b257f1b`) |
| D04 | `verify` solo desde `submitted` y sin purgar | decision | arreglado-verificado (`b257f1b`) |
| D05 | CC del fake antes del merge | decision | decidido, pendiente |
| H15 | Caso 7 de `admin.test.ts` tautológico | bajo | abierto (mejora) |
| H16 | `VALID_SETTING_KEYS` copia `PLATFORM_SETTING_KEYS` | bajo | abierto (mejora) |
| H17 | `before` del audit de `update_setting` sin lock | bajo | abierto (mejora) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. `H04`: arreglar la semilla (UUID en hex; la `accepted` en otra solicitud), `anon` → `42501`, borrar la 36, ajustar `plan`. Pegar la salida real.
2. `H05`: agregar las nueve pruebas de la tabla de `ronda-2.md` y correr `evidencia/ronda-2/mut.py`: las nueve tienen que dar rojo.
3. `H11`: `pnpm db:types --local` y commitear lo que salga, sin tocarlo.
4. `D05`: contract-change del fake (las cinco divergencias) **antes del merge**.
5. Ronda 3: `evidencia/comandos.md` completo (rondas 1 y 2) y CI, si ya no quedan bloqueantes.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (`AG-64` a `AG-68`). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd).
