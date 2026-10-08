# PR #305 — T-350 · Ficha de corrección axe AA en viaje

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/305 |
| Issue | #296 |
| Autor | @Lautaro073 |
| Rama | `docs/T-350-ficha` → `develop` |
| HEAD revisado | `fa9a28a6d8e07d1a89bfe1ae754ac22473aafa22` |
| Base observada | `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8` |
| Alcance original | Tres archivos documentales; +133 líneas, -0 |
| Resultado ronda 1 | **CON BLOQUEANTES (3)**; no aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `fa9a28a` | 3 bloqueantes | [ronda-1](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR305-H01 | Auditoría C06 prometida, pero no instrumentada | alto | abierto |
| PR305-H02 | Rama aislada no explicita árbol con dependencia axe | medio | abierto |
| PR305-H03 | GREEN posible sobre fallback, sin mapa interactivo | alto | abierto |

**Decisión Lautaro073 (2026-10-08):** 1-A — auditoría de axe para repartidor y comercio, creando **solo en la PR aislada** un test E2E adicional C06; no modificar el spec original de T-309.

[Datos estructurados](hallazgos.jsonl) · [Evidencia/comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Por hacer

- Actualizar `docs/tasks/T-350.md` con el diseño cerrado en el comentario de la PR, registrar la sesión en su bitácora y pushear.
- Solicitar ronda 2 de revisión independiente sobre el nuevo SHA.
- **No implementar T-350** en esta PR documental. La implementación y el E2E aislado pertenecen a una PR posterior, tras merge de la ficha.
- Al cerrar esta ronda, el commit de la revisión mueve el HEAD; quien corrija debe ejecutar `git pull` sin rebase/force/amend.
