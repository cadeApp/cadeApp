# PR #75 — T-105 · RPC de admin

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/75 |
| **Tarea** | T-105 (Fase 1, núcleo transaccional) · issue #15 |
| **Autor** | @Lautaro073 (agy) |
| **Rama** | `feat/T-105-admin-rpc` → `develop` |
| **Base** | `b6b5f39` |
| **Tamaño** | 4 archivos, +889 líneas |
| **Estado** | Draft · **bloqueada** (11 bloqueantes, 4 decisiones ya tomadas) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `834b915` | 14 + 4 decisiones | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `admin_verify_document` falla siempre (`22P02`, literales de `kind`) | alto | abierto |
| H02 | `admin_suspend_courier` falla siempre (`42703`, `offers.withdrawn_at`) | alto | abierto |
| H03 | `admin_set_subscription` valida contra un enum inventado | alto | abierto |
| H04 | `rpc_admin.sql` corre 0 de 25; `test:db ✅` y TDD declarados sin evidencia | alto | abierto |
| H05 | La suite no cubre el DoD (efectos, aal2, estado incorrecto, ofertas pending) | alto | abierto |
| H06 | El wrapper codifica dos veces `p_value` | alto | abierto |
| H07 | Las funciones son ejecutables por `PUBLIC`/`anon` | medio | abierto |
| H08 | Sin test de contrato; fake y RPC divergen | medio | abierto |
| H09 | `INVALID_SETTING_*` inalcanzables por el wrapper | medio | abierto |
| H10 | El motivo se exige y se descarta; no se escribe `audit_log` | alto | abierto |
| H11 | `database.types.ts` sin regenerar | medio | abierto |
| H12 | `paid_until` se borra cuando no viene y `notes` no | bajo | abierto |
| H13 | `pilot_terms_version` acepta solo espacios | bajo | abierto |
| H14 | Preámbulo de autorización copiado cinco veces | bajo | abierto |
| D01 | Ampliar la ficha con los tipos y el test del wrapper | decision | decidido, pendiente (Lautaro073, en develop) |
| D02 | Auditoría dentro de cada RPC | decision | decidido, pendiente |
| D03 | `decide` solo desde `pending` | decision | decidido, pendiente |
| D04 | `verify` solo desde `submitted` y sin purgar | decision | decidido, pendiente |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Lautaro073 amplía la ficha en develop (`D01`). Sin eso, `H08` y `H11` no se pueden cerrar dentro de alcance.
2. El agy arregla `H01` a `H11` e implementa `D02` a `D04` en la RPC **y en el fake** (el fake está en `src/domain/testing/`, que es contrato: si hay que tocarlo, pasa por `contract-change`).
3. Reescribir `rpc_admin.sql` sobre el patrón de `rpc_accept.sql` y pegar `Files=… Tests=… Result: PASS` de una corrida real.
4. Ronda 2: volver a correr `evidencia/comandos.md` completo, más la mutación de `H05`.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (`AG-64` a `AG-66`). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd).
