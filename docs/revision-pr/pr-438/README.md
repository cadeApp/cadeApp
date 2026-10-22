# PR #438 — T-377 · Ficha del recorrido por calles

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/438 |
| Issue | https://github.com/cadeApp/cadeApp/issues/437 |
| Autor | @Lautaro073 (ficha para P2) |
| Rama | `docs/T-377-trip-street-route` → `develop` |
| SHA más reciente examinado | `1a24494cdc9c2fac0e85fe550f040849a57b2fa4` |
| Base | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| Alcance | Solo documentación: ficha y fila del plan; resto son los informes de revisión |
| Estado de ronda | **SIN BLOQUEANTES — ronda 2 cerrada** |

## Rondas

| Ronda | SHA de código/ficha revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `e6e6769109dfef5926dea90dc44bd1100c9163ab` | H01, H02 bloqueantes; H03 mejora | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `1a24494cdc9c2fac0e85fe550f040849a57b2fa4` | **Sin bloqueantes: H01–H03 corregidos-verificados** | [ronda-2.md](revisiones/ronda-2.md) |

## Estado

| Hallazgo | Prioridad | Estado |
|---|---|---|
| PR438-H01 — Coordenadas faltantes contradicen T-363 | Bloqueante · alto | **Arreglado-verificado en `1a24494`** |
| PR438-H02 — Contrato de computeRoutes insuficiente | Bloqueante · medio | **Arreglado-verificado en `1a24494`** |
| PR438-H03 — Costo gratuito no sustentado | Mejora · bajo | **Arreglado-verificado en `1a24494`** |

**Decisión de Lautaro073 (2026-10-20), opción A:** conservar T-363. Si falta alguna coordenada, no se dibuja mapa ni recorrido parcial; se conservan las direcciones escritas y los mensajes de ubicación faltante.

Datos: [hallazgos.jsonl](hallazgos.jsonl); evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md); aprendizaje: [lecciones.md](lecciones.md).

## Cierre de ronda 2

**Resultado: SIN BLOQUEANTES**, a nivel de especificación documental. El autor modificó únicamente `docs/tasks/T-377.md` y el cuerpo de la PR, sin tocar los archivos reservados a revisión.

La revisión independiente reprodujo las cinco condiciones del guard en el SHA original y en el corregido (5 FAIL → 5 PASS) y 15 comprobaciones adicionales de semántica (15 PASS). Las suites de aplicación no se ejecutaron ni se exigen en esta PR solo documental; el autor informó `verify-fichas` 7/7 y `git diff --check` limpio. Al comprobarse la rama, GitHub marcó CI en curso, mientras Vercel figuraba exitoso y e2e-preview pendiente; esos checks no se exigen para juzgar el cambio documental.

La PR queda **apta para merge por la revisión independiente**, sin aprobación ni merge automáticos. El paso de habilitar/restringir Routes API en Google Cloud corresponde a Lautaro073 al desplegar la implementación posterior.
