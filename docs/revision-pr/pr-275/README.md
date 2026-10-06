# PR #275 — T-343 · Vocabulario canónico del feed

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/275 |
| **Tarea** | T-343 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-343-feed-canonical-vocabulary` → `develop` |
| **Base** | `83aeb34f00d2a4e78332d4da9004e1bdaab6def5` |
| **Tamaño** | 21 archivos, +547 / -70 líneas |
| **Estado** | bloqueada en ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `4d9b4a19917a94b979f67add1a78f159c9b2cf3c` | 3 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR275-H01 | El SSR convierte un enum inválido en “feed vacío” en vez de error | alto | abierto |
| PR275-A01 | `feed-privacy.test.tsx` no está autorizado en la ficha base | decision | decision-pendiente |
| PR275-H03 | El body no cumple el contrato de `approval-policy` | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Hacer que un valor canónico inválido en el SSR produzca un error de lectura real y active el error boundary; no devolver `requests: []`.
2. Lautaro073 debe confirmar directamente si acepta que T-343 amplíe alcance para tocar `src/features/offers/components/feed-privacy.test.tsx` dentro de esta misma PR.
3. Tras los arreglos, volver a correr `revisar-pr` y pegar el informe completo en el body para que `approval-policy` pueda pasar.
4. Pedir ronda 2.

## Para el análisis posterior

La corrección principal del vocabulario canónico está bien orientada. El defecto técnico de ronda 1 está en el tratamiento del caso inválido del camino SSR, no en los valores canónicos ni en las etiquetas.
