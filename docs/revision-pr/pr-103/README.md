# PR #103 — CC-008 · Proyección mínima post-matched

> ❌ **Ronda 1: CON BLOQUEANTES · 3 bloqueantes · 2 decisiones aceptadas**

| | |
|---|---|
| PR | #103 |
| Rama | `cc/CC-008-proyeccion-minima-post-matched` |
| SHA revisado | `4703cc2f71e7609e302c5cc79da563f2d58f0605` |
| Base | `develop@ac4587f3c76f3ce8d63f3abbafff0847b89d9b54` |
| Diff | 1 archivo · solo `docs/contracts/CC-008.md` |
| CI | no consultado por bloqueantes |

## Resultado

El documento identifica correctamente el problema de T-115 y mantiene cerradas las tablas completas, pero el CC todavía es **solo una propuesta**. No puede desbloquear T-115 hasta que el mismo PR traiga la RPC/wrapper, contrato tipado y pruebas.

## Decisiones de Lautaro073

- D01: **1-A** — `get_trip_details(p_request_id)` como RPC `SECURITY DEFINER`.
- D02: **2-A** — `courier-docs` sigue privado; el avatar se entrega por URL firmada temporal generada en servidor.

Ver [ronda-1.md](revisiones/ronda-1.md).
