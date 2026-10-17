# PR #397 — T-369 · Paso DB/RPC de CC-029

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/397 |
| Tarea | T-369 (#356, rollout 3-A paso 1/3) |
| Autor | Lautaro073 |
| Rama | `feat/T-369-db-rpc` → `develop` |
| SHA ronda 1 | `c1264541e03b741e33729d3126c0db33701872a6` |
| SHA ronda 2 | `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3` |
| SHA código ronda 3 | `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe` |
| Estado | **Ronda 3: SIN BLOQUEANTES**. Apta para que Lautaro073 evalúe merge; no se aprobó ni mergeó. |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `c1264541e03b741e33729d3126c0db33701872a6` | 5 bloqueantes + 1 mejora | [ronda 1](revisiones/ronda-1.md) |
| 2 | `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3` | 1 bloqueante nuevo R01 | [ronda 2](revisiones/ronda-2.md) |
| 3 | `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe` | **SIN BLOQUEANTES** | [ronda 3](revisiones/ronda-3.md) |

## Estado estructurado después de ronda 3

- **PR397-H01** — `arreglado-sin-verificar` — Falta carrera real multisesión del libro y reserva.
- **PR397-H02** — `arreglado-sin-verificar` — Idempotencia compara solo parte del payload; ignora la nota.
- **PR397-H03** — `arreglado-sin-verificar` — Cambiar gracia global puede solapar el legacy con un plan ya programado.
- **PR397-H04** — `arreglado-sin-verificar` — El reintegro usa timestamp de inicio de transacción, no instante de liberación.
- **PR397-H05** — `arreglado-sin-verificar` — Primera compra con descuento 0 % no consume el beneficio.
- **PR397-H06** — `arreglado-sin-verificar` — Plan de rollback del cuerpo propone borrado destructivo de tablas.
- **PR397-R01** — `arreglado-verificado` — Los controles RED de H01/H03 desactivan las aserciones originales al ejecutar mutaciones.

**Distinción de verificación:** PR397-R01 se verificó por comprobación independiente automatizada de estructura del test más el log CI auténtico, sin ejecutar DB local. El resto queda `arreglado-sin-verificar`: la corrección se comprobó en código y se cotejó con ejecuciones CI, pero la revisión no repitió sus pruebas en PostgreSQL. No hay `abierto`, `parcial` ni `decision-pendiente` tras esta ronda.

[Hallazgos](hallazgos.jsonl) · [Evidencia ronda 3](evidencia/ronda-3.md) · [Comandos de reproducción](evidencia/comandos.md) · [Lecciones](lecciones.md).

Decisiones **1-A** (concurrencia real en CI) y **2-A** (primera compra al 0 % consume el beneficio) resueltas. No hubo aprobación ni merge. T-369 continúa en fase 1/3 y la issue #356 no se cierra antes de los pasos UI y E2E/staging.