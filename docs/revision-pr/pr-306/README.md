# PR #306 — T-351 · Ficha de contraste del onboarding del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/306 |
| Issue | #297 |
| Autor | @Lautaro073 |
| Rama | `docs/T-351-ficha` → `develop` |
| Base al hacer ronda 1 | `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8` |
| Base al hacer ronda 2 | `fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f` |
| HEAD corregido revisado | `742bcf1936228432038b436876e53825926323b8` |
| Estado de revisión | **CON BLOQUEANTES (1 nuevo de integración)** |

## Rondas

| Ronda | SHA revisado | Informe |
|---|---|---|
| 1 | `ef906b2ce719934f8b4082877c2355bef498d902` | [CON BLOQUEANTES (3)](revisiones/ronda-1.md) |
| 2 | `742bcf1936228432038b436876e53825926323b8` | [CON BLOQUEANTES (1 nuevo, 4 anteriores corregidos)](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Severidad | Estado |
|---|---|---|
| PR306-H01 · todos los estados | alto | arreglado-verificado **en ficha** |
| PR306-H02 · precondición semántica | medio | arreglado-verificado **en ficha** |
| PR306-H03 · RED sin adulterar expectativa | medio | arreglado-verificado **en ficha** |
| PR306-H04 · copy «Cargado» | bajo | arreglado-verificado **en ficha** |
| PR306-H05 · conflicto con T-350 | alto | **abierto** |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Próximo paso

La PR sigue siendo solo documental. Integrar `origin/develop` mediante merge normal (no rebase ni force-push), preservar las filas T-350 y T-351 en `docs/implementation-plan.md`, resolver los conflictos y verificar que GitHub cambie de `mergeable_state: dirty` a mergeable. Pegar salidas reales de validación, solicitar **ronda 3** sobre el nuevo HEAD. No implementar la accesibilidad ni mergear automáticamente.
