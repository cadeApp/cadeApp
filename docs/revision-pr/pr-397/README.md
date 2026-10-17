# PR #397 — T-369 · Paso DB/RPC de CC-029

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/397 |
| Tarea | T-369 (#356, rollout 3-A paso 1/3) |
| Autor | Lautaro073 |
| Rama | `feat/T-369-db-rpc` → `develop` |
| SHA código ronda 1 | `c1264541e03b741e33729d3126c0db33701872a6` |
| SHA código ronda 2 | `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3` |
| Estado | **Ronda 2: CON BLOQUEANTES (1)** — PR397-R01; no mergear |

## Rondas

| Ronda | SHA revisado | Informe |
|---|---|---|
| 1 | `c1264541e03b741e33729d3126c0db33701872a6` | [ronda 1](revisiones/ronda-1.md) |
| 2 | `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3` | [ronda 2](revisiones/ronda-2.md) |

## Estado actualizado de los hallazgos

- **PR397-H01:** `parcial`.
- **PR397-H02:** `arreglado-sin-verificar`.
- **PR397-H03:** `parcial`.
- **PR397-H04:** `arreglado-sin-verificar`.
- **PR397-H05:** `arreglado-sin-verificar`.
- **PR397-H06:** `arreglado-sin-verificar`.
- **PR397-R01 (nuevo, alto):** `abierto` — pruebas de mutación H01/H03 evitan las aserciones originales.

**Interpretación:** H01/H03 muestran código funcional y tests verdes, pero la validación negativa de la carrera fue implementada con otro oráculo: se mantienen `parcial`. H02/H04/H05/H06 fueron modificados y respaldados por logs CI/inspección; figuran `arreglado-sin-verificar` porque la revisión no ejecutó esas pruebas independientemente. **Ninguno se certifica como `arreglado-verificado` por obra del agy.**

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia ronda 2](evidencia/ronda-2.md) · [Lecciones](lecciones.md).

Decisiones 1-A (concurrencia real en CI) y 2-A (primera compra consume beneficio incluso a 0%) siguen cerradas. No hay decisiones humanas nuevas. No aprobar ni mergear hasta R01 corregido y validado.