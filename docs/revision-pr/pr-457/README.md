# PR #457 — T-386 / CC-035

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/457 |
| Autor | @Lautaro073 |
| Rama | `feat/T-386-cc035-push-subscription` → `develop` |
| Base | `24de5c511b32a1d472d4e022284997cc1648df83` |
| HEAD revisado | `ebffc06f72b1fd7a9cd24a78fd6cfcd3b600535d` |
| Diff | 11 archivos, +1198 líneas; todos permitidos |
| Estado | **CON BLOQUEANTES (2)**, PR draft; sin aprobación ni merge |

## Ronda 1

| SHA | Resultado | Informe |
|---|---|---|
| `ebffc06f72b1fd7a9cd24a78fd6cfcd3b600535d` | 2 bloqueantes, 1 mejora, 0 decisiones | [Ronda 1](revisiones/ronda-1.md) |

| Hallazgo | Estado | Descripción |
|---|---|---|
| PR457-H01 | abierto (alto) | La RPC coacciona JSON no textual a claves push |
| PR457-H02 | abierto (alto) | La carrera verifica el conteo de auditorías, no la historia de dueños |
| PR457-H03 | abierto (bajo) | Docblock CC-016 atribuido al contrato equivocado |

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md)

**Para cerrar:** corregir H01 y H02 con RED→GREEN comprobado contra SQL real, revalidación independiente en nuevo SHA y luego merge. Confirmar `migrate-develop` antes de desbloquear T-383; E2E de ruta corresponde a esa tarea.
