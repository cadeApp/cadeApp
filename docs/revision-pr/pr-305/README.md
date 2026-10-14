# PR #305 — T-350 · Ficha de corrección axe AA en viaje

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/305 |
| Issue | #296 |
| Autor | @Lautaro073 |
| Rama | `docs/T-350-ficha` → `develop` |
| Base contrastada | `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8` |
| SHA corregido revisado | `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc` |
| Alcance | Solo documentación de T-350, su bitácora, plan y revisiones |
| Estado final de la revisión | **SIN BLOQUEANTES** (ronda 2, pendiente de decisión humana de merge) |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `fa9a28a6d8e07d1a89bfe1ae754ac22473aafa22` | CON BLOQUEANTES (3) | [ronda-1](revisiones/ronda-1.md) |
| 2 | `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc` | **SIN BLOQUEANTES** | [ronda-2](revisiones/ronda-2.md) |

## Estado de hallazgos

| ID | Severidad | Resultado en ronda 2 |
|---|---|---|
| PR305-H01 · Falta auditoría de C06 | alto | arreglado-verificado en ficha |
| PR305-H02 · Composición incompleta de dependencias | medio | arreglado-verificado en ficha |
| PR305-H03 · Falso GREEN con fallback | alto | arreglado-verificado en ficha |

**Decisión ya tomada:** Lautaro073 eligió **1-A**: axe en R07 y C06 con pruebas temporales aisladas; el spec de T-309 permanece intacto. No quedan decisiones pendientes de T-350 en esta PR.

[Datos estructurados](hallazgos.jsonl) · [Comandos/evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué falta

- Esta PR es **solo ficha**: no implementa los cambios accesibles del producto, no genera GREEN de axe de las vistas.
- El merge de PR #305 queda exclusivamente a cargo de Lautaro073; la revisión no aprueba ni mergea.
- Luego del merge, ejecutar `tomar-tarea` T-350 y en la PR posterior demostrar tests RED/GREEN en la rama aislada que combina T-309, C06 y R07.
