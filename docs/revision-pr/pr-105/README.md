# PR #105 — T-106 · Coordenadas y `calculate_route_distance`

> ✅ **Ronda 2: SIN BLOQUEANTES · H01/H02 cerrados**

| | |
|---|---|
| PR | #105 |
| Rama | `feat/T-106-coordenadas-distancia` → `develop` |
| SHA revisado en R2 | `e275613eb0b022932ab17c4333ddc1cf8625b105` |
| Base actual | `develop@6ac32e77f6995bec82a0c2957d6b59739cbe096b` |
| Merge ref verificado | `058a373f1c93736e8832251fef1d4bc08ba09d19` |
| Diff funcional | T-106 + correcciones R1; `rls_matrix.sql` autorizado explícitamente por Lautaro073 |
| CI R2 | código 7/7 verde + `approval-policy` verde |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `c25589c68160dd569ce645026f799312c443228e` | 2 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `e275613eb0b022932ab17c4333ddc1cf8625b105` | 0 nuevos · H01/H02 cerrados | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR105-H01 | `merchant_public` no cerraba el acceso directo a `merchants` | alto | arreglado-verificado |
| PR105-H02 | La fase roja declarada abortó antes de ejecutar aserciones | medio | arreglado-verificado |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md)

## Estado de cierre

- `merchants_select_courier` queda eliminado.
- Courier aprobado relacionado: no obtiene la fila por `public.merchants` y sí la superficie segura por `merchant_public`.
- Comercio dueño y admin conservan acceso directo.
- `rls_matrix.sql` consulta la nueva superficie, según autorización explícita de Lautaro073.
- La evidencia histórica queda corregida sin reescribir la sesión original.
- `db-tests`: 12 archivos, 1529 tests, PASS; tipos sin diff.
- Unit: 55 archivos, 601 tests, PASS.
- `approval-policy`: run 36219348596, PASS tras publicar el informe R2 sin bloqueantes.

## Para el análisis posterior

No se agrega AG nueva: H01 queda cubierto por `pr-56/AG-37` y H02 por `pr-63/AG-70`.
