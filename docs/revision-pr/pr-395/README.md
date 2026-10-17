# PR #395 — CC-029 / T-369

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/395 |
| CC | CC-029 · issue #394 |
| Tarea afectada | T-369 · issue #356 (bloqueada hasta merge del CC) |
| Autor | @Lautaro073 |
| Rama | `cc/CC-029-publication-credits` → `develop` |
| HEAD original revisado | `ed96bbae40cc02992fc21962bf4c2b43ef3ecfdd` |
| Base original | `293c3a2756509a5fb6e82ee6bc841197c143f9c9` |
| Estado | Ronda 1: **sin bloqueantes documentales pendientes**, verificación runtime de T-369 diferida |

## Rondas

| Ronda | SHA original | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ed96bbae40cc02992fc21962bf4c2b43ef3ecfdd` | 9 corregidos documentalmente (sin autoverificación) | [ronda-1.md](revisiones/ronda-1.md) |

## Estado de hallazgos

- PR395-H01: `arreglado-sin-verificar` — Lote futuro creado pero gastable antes de comenzar período.
- PR395-H02: `arreglado-sin-verificar` — Índice único impedía D-C2a al conservar consumo histórico.
- PR395-H03: `arreglado-sin-verificar` — Gracia sobre ilimitado y renovación retroactiva contradicen 1-A.
- PR395-H04: `arreglado-sin-verificar` — Arrastre diferido sin corte contable inmutable.
- PR395-H05: `arreglado-sin-verificar` — Nuevo plan podía solaparse con legacy_paid vigente.
- PR395-H06: `arreglado-sin-verificar` — Riesgo de deadlock por reconciliación dentro del lock de comercio.
- PR395-H07: `arreglado-sin-verificar` — Rollback proponía revertir migraciones cuando podían existir créditos.
- PR395-H08: `arreglado-sin-verificar` — Rollout multi-PR aún sin autorización/marcador operativo.
- PR395-H09: `arreglado-sin-verificar` — Conversión a lote suelto podía duplicar devoluciones.

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia reproducible](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Por hacer

- El comentario de la PR incluye el informe y prompt para agy. `approval-policy` se evalúa sobre el cuerpo del PR.
- Esta PR documental no requiere `db-tests` ni E2E según instrucción de Lautaro073; no se han ejecutado ni se atribuye éxito.
- **No** tomar T-369 hasta mergear CC-029. La implementación se hará en tres PR secuenciales (3-A), sin cerrar el piloto.
- No se aprobó ni mergeó la PR.
