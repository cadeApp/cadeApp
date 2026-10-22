# PR #223 — T-330 · publish_request conserva distancia NULL

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/223 |
| **Tarea** | T-330 · Issue #220 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-330-publish-null-distance` → `develop` |
| **SHA funcional revisado** | `347b004f03ca9ea107162881bc1773bb976b70b4` |
| **Estado** | Draft · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA funcional | Resultado | Informe |
|---|---|---|---|
| 1 | `347b004f03ca9ea107162881bc1773bb976b70b4` | SIN BLOQUEANTES | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Resumen

- Alcance exacto de T-330: migración append-only, pgTAP y documentación permitida.
- Rama sincronizada con `develop`: 3 commits ahead / 0 behind; mergeable.
- La migración copia exactamente la definición vigente de CC-015 salvo el bloque de `v_distance`.
- Si falta cualquiera de las cuatro coordenadas efectivas, `v_distance` queda NULL antes del Haversine.
- Con coordenadas completas se conserva el cálculo previo, bounds, mínimo, redondeo y todos los guards posteriores.
- El RED previo falla exactamente los casos sin ubicación; GREEN y CI actual pasan 1671 DB tests.
- Vercel Preview READY.
- `e2e-preview` queda intencionalmente bloqueado por existir una migración; no es un fallo de T-330.

## Ajuste documental de la revisión

La descripción original de la tarea suponía que el defecto fabricaba 500 m. La evidencia real mostró **26.019.500 m** por la semántica NULL de `least()`. La revisión corrigió únicamente ese texto y el comentario de cabecera de la migración; no cambió comportamiento.

## Resultado

**SIN BLOQUEANTES.**

No se aprueba ni mergea automáticamente. Lautaro073 puede sacar la PR de Draft y mergearla cuando decida, una vez que los checks del commit documental de revisión vuelvan a quedar verdes.
