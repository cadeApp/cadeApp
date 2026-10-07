# PR #302 — T-348 · Prerrequisito RLS para onboarding merchant

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/302 |
| **Tarea** | T-348 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-348-merchant-onboarding-rls` → `develop` |
| **Base** | `d3fa4ccfeff13299ed82b6529be20d521bb79f77` |
| **Tamaño** | 4 archivos, +61 / -4 |
| **Estado** | abierta · CON BLOQUEANTES (2) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ff0e289dacb6a424c4d7da87b1661258224d0cc4` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR302-H01 | El test de INSERT no prueba una policy INSERT self | alto | abierto |
| PR302-H02 | El body afirma RED para cada prueba nueva, pero 24b nunca quedó RED | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos/evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Hacer que el caso 24b intente un **INSERT propio** con un merchant activo que no tenga fila `merchants`.
2. Demostrar que ese caso queda RED si aparece temporalmente una policy `INSERT self` y GREEN con el schema correcto.
3. Corregir el checkbox/evidencia del body.
4. Revisión independiente ronda 2.
5. Recién sin bloqueantes: merge; después `migrate-develop` GREEN antes de retomar T-313/#251.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una regla global nueva: H01 reutiliza P08 y H02 reutiliza P15.
