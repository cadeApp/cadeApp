# PR #188 — T-324 · Estado real de documentos del courier en pantalla de verificación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/188 |
| **Tarea** | T-324 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-324-courier-documents-status` → `develop` |
| **SHA funcional revisado** | `86328317dd3d31f17a58e1d8a528bcc04ef810ee` |
| **Base actual de develop al revisar** | `640bc4cd6f86a85f8a7fb235f123a182ac6c2163` |
| **Tamaño funcional** | 3 archivos, +227 / -0 |
| **Estado** | Draft · RED inicial · CON BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `86328317dd3d31f17a58e1d8a528bcc04ef810ee` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR188-H01 | Falta controlar el cableado página → query → StatusView y el redirect sin sesión | alto | abierto |
| PR188-H02 | El enum `rejected` no está cubierto por los RED | medio | abierto |
| PR188-H03 | No se define ni prueba cuál fila manda cuando un `kind` tiene historial | alto | abierto |
| PR188-H04 | Los RED no enumeran todos los documentos obligatorios | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Pullear este commit de revisión y mergear `origin/develop` en la rama (sin rebase).
2. Completar los RED indicados por H01–H04.
3. Implementar query, página y StatusView contra esos controles.
4. Demostrar mutaciones RED propias y luego correr checks completos.
5. Pedir Ronda 2. **No mergear todavía.**

## Decisiones P1 incorporadas

- `rejected` → **Observado**, no `Listo`.
- Para filas repetidas del mismo `kind`, manda la más reciente por `uploaded_at`.
- `uploaded_at` puede usarse solo en servidor para resolver vigencia; al Client Component llegan únicamente `kind` y `status`.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone regla AG nueva en esta ronda: los huecos caen en patrones ya catalogados P06/P08.
