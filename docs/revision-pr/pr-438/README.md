# PR #438 — T-377 · Ficha del recorrido por calles

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/438 |
| Issue | https://github.com/cadeApp/cadeApp/issues/437 |
| Autor | @Lautaro073 (ficha para P2) |
| Rama | `docs/T-377-trip-street-route` → `develop` |
| SHA examinado | `e6e6769109dfef5926dea90dc44bd1100c9163ab` |
| Base | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| Alcance | Solo documentación: 2 archivos, +93 líneas |
| Estado de ronda | **CON BLOQUEANTES (2)**; H03 es mejora |

## Rondas

| Ronda | SHA de código/ficha revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `e6e6769109dfef5926dea90dc44bd1100c9163ab` | H01, H02 bloqueantes; H03 mejora | [ronda-1.md](revisiones/ronda-1.md) |

## Estado

| Hallazgo | Prioridad | Estado |
|---|---|---|
| PR438-H01 — Coordenadas faltantes contradicen T-363 | Bloqueante · alto | Abierto; decisión A ya tomada |
| PR438-H02 — Contrato de computeRoutes insuficiente | Bloqueante · medio | Abierto |
| PR438-H03 — Costo gratuito no sustentado | Mejora · bajo | Abierto |

**Decisión de Lautaro073 (2026-10-20), opción A:** conservar T-363. Si falta alguna coordenada, no se dibuja mapa ni recorrido parcial; se conservan las direcciones escritas y los mensajes de ubicación faltante.

Datos: [hallazgos.jsonl](hallazgos.jsonl); evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md); aprendizaje: [lecciones.md](lecciones.md).

## Para la siguiente ronda

Corregir únicamente los documentos autorizados siguiendo el prompt publicado en el comentario de cierre de esta PR. La tarea **no implementa código**, no requiere ejecutar E2E ni db-tests en esta etapa. Verificar que el cuerpo de la PR también refleje el fallback diferenciado y el alcance económico.

El comentario de revisión no es una aprobación ni un merge. El SHA de esta revisión es anterior al commit documental de revisión; ningún hallazgo se declara verificado en un SHA posterior.

