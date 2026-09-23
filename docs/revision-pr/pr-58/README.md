# PR #58 — T-006 · Contratos de dominio v1

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/58 |
| **Tarea** | T-006 · Contratos de dominio v1 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-006-contracts-v1` → `develop` |
| **Estado** | 🔴 **Con bloqueantes** · ronda 1 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `afe3631f46d450cdfdd128f73b46ccee56b02b76` | **14 hallazgos bloqueantes** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Decisiones humanas cerradas antes de entregar la ronda

1. Se amplía «Archivos permitidos» de T-006 para incluir `vitest.config.ts` y configurar ahí el umbral real de cobertura de ramas ≥ 90 %.
2. Se amplía el alcance a `package.json` y `pnpm-lock.yaml` para remediar las vulnerabilidades que ahora hacen fallar el job `audit`.
3. Si existen las cuatro coordenadas, la distancia se calcula con Haversine. Si falta el pin/coordenadas, no se inventa distancia con centroides: el producto mostrará «De barrio X a barrio Y» sin distancia. Una caída de Google Maps no cambia una distancia ya calculada porque Haversine corre en servidor y no depende de esa API.

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
