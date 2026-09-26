# PR #105 — T-106 · Coordenadas y calculate_route_distance

> ❌ **Ronda 1: CON BLOQUEANTES · 2 bloqueantes**

| | |
|---|---|
| PR | #105 |
| Rama | `feat/T-106-coordenadas-distancia` → `develop` |
| SHA revisado | `c25589c68160dd569ce645026f799312c443228e` |
| Base actual | `develop@6ac32e77f6995bec82a0c2957d6b59739cbe096b` |
| Merge ref actual | `25665537447b0de08fa0c137ea9a1fac5d6fe097` |
| Diff | 7 archivos · +1002 / -5 · 0 fuera de alcance |
| CI | por haber bloqueantes, solo se inspeccionó `db-tests`: 12 archivos / 1526 tests / PASS; tipos sin diff |

La RPC de distancia, el freeze de `created_at` y el aislamiento de coordenadas en `delivery_request_contacts` van en la dirección del DoD. Quedan dos bloqueantes antes de aceptar: el acceso directo de couriers a `public.merchants` sigue abierto, y la fase roja declarada en la bitácora no se reproduce.

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `c25589c68160dd569ce645026f799312c443228e` | 2 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR105-H01 | `merchant_public` no cierra el acceso directo a `merchants` | alto | abierto |
| PR105-H02 | La fase roja declarada abortó antes de ejecutar aserciones | medio | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. Cerrar el bypass directo de `merchants_select_courier` conservando para couriers únicamente la superficie segura de `merchant_public`.
2. Agregar pgTAP que pruebe el acceso **directo** a `public.merchants`, y demostrar que restaurar temporalmente la policy vieja pone el control en rojo.
3. Corregir la evidencia histórica sin reescribirla: agregar una entrada de bitácora que reconozca que el rojo inicial fue inválido por el fixture y actualizar el cuerpo del PR para no afirmar una demostración que no ocurrió.
4. Reejecutar `db-tests` y regeneración de tipos contra el `develop` vigente.

## Para el análisis posterior

No se propone AG nueva. H01 reincide en **P08** y aplica `pr-56/AG-37`: revisar la clase completa de vías de acceso, no solo la vista nueva. H02 reincide en `pr-63/AG-70`: el rojo se registra desde la salida real, no desde lo que se esperaba que fallara.
