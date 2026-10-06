# PR #282 — CC-023 · Cerrar por API la lectura de indicaciones y monto exacto de cambio

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/282 |
| **Contrato** | CC-023 |
| **Tarea bloqueada** | T-345 (#281) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-023-courier-private-fields` → `develop` |
| **Base** | `80f0b56a9ff94d3c4e10fb215c63faccd9097365` |
| **Estado** | **CON BLOQUEANTES — ronda 1** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `ced0add71da9daf7d56a8c951bb9253cd9a20537` | **2 bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR282-H01 | El revoke propuesto rompe lectores authenticated del comercio | alto | **abierto** — resolución 1-A autorizada por Lautaro073 |
| PR282-H02 | El fallback Realtime con SET TABLE expulsaría otras tablas de la publicación | alto | **abierto** |

## Decisión humana

Lautaro073 eligió **1-A** el 2026-10-06: mantener la barrera fuerte para todo `authenticated` y preservar el comportamiento actual del comercio mediante una frontera server/RPC segura para los campos privados que realmente necesite, eliminando lecturas directas innecesarias.

No se mergea CC-023 hasta que ambos hallazgos estén corregidos y revalidados.
