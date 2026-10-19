# PR #425 — T-373 · Historial seguro de cancelaciones del repartidor tras reasignación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/425 |
| **Tarea** | T-373 (Fase 3 — calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-373-historial-cancelaciones` → `develop` |
| **Base** | `9f1d1a6f335915b723d6fe98763990d3097706f4` |
| **Implementación revisada** | `8e9ada09b10cbd38ab684909b62fab2c337c167d` |
| **Head documental al iniciar** | `8f2c51fcd3a4df1f1305141a5b5ab21c15453924` |
| **Tamaño** | 23 archivos, +813/-9 líneas contra `origin/develop` |
| **Estado** | abierta, Draft, bloqueada por 2 hallazgos |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `8e9ada09b10cbd38ab684909b62fab2c337c167d` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR425-A01 | Dos tests están fuera del alcance autorizado en `origin/develop` | alto | abierto |
| PR425-H01 | Falta el caso obligatorio de dos cancelaciones y ningún oráculo protege el orden visible | alto | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Resolver PR425-A01 con autorización efectiva en `develop` o retirar los cambios fuera de alcance.
2. Extender la prueba para dos cancelaciones, rematch, aislamiento por actor y orden visible; demostrar RED/GREEN.
3. Pedir ronda 2 sobre un nuevo SHA y reejecutar CI/E2E.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una regla nueva: ambos hallazgos ya están cubiertos por reglas vigentes de alcance y sensibilidad de pruebas.
