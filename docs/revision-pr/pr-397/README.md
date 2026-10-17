# PR #397 — T-369 · Paso DB/RPC de CC-029

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/397 |
| Tarea | T-369 (#356, 3-A paso 1/3) |
| Autor | Lautaro073 |
| Rama | `feat/T-369-db-rpc` → `develop` |
| SHA inspeccionado (antes de commit de la revisión) | `c1264541e03b741e33729d3126c0db33701872a6` |
| Estado | Ronda 1: CON BLOQUEANTES (5), 1 mejora; no mergear |

## Rondas

| 1 | `c1264541e03b741e33729d3126c0db33701872a6` | PR397-H01..H06 | [Informe](revisiones/ronda-1.md) |

## Registro

- **PR397-H01** (alto): **Falta carrera real multisesión del libro y reserva** — `abierto`.
- **PR397-H02** (alto): **Idempotencia compara solo parte del payload; ignora la nota** — `abierto`.
- **PR397-H03** (alto): **Cambiar gracia global puede solapar el legacy con un plan ya programado** — `abierto`.
- **PR397-H04** (alto): **El reintegro usa timestamp de inicio de transacción, no instante de liberación** — `abierto`.
- **PR397-H05** (alto): **Primera compra con descuento 0 % no consume el beneficio** — `abierto`.
- **PR397-H06** (medio): **Plan de rollback del cuerpo propone borrado destructivo de tablas** — `abierto (mejora)`.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)

**Decisiones cerradas por Lautaro073:** 1-A pruebas multisesión en CI; 2-A primer pago consume descuento incluso a 0%. El agy debe actualizar el alcance de la ficha para las dos rutas CI/test y los tests; esta carpeta la gestiona exclusivamente la revisión.

**No** hay aprobación, merge, pruebas locales ni cierre de tarea. La segunda ronda será independiente del arreglo hecho por el agy.