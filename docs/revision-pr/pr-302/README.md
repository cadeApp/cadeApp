# PR #302 — T-348 · Prerrequisito RLS para onboarding merchant

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/302 |
| **Tarea** | T-348 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-348-merchant-onboarding-rls` → `develop` |
| **Base** | `d3fa4ccfeff13299ed82b6529be20d521bb79f77` |
| **Estado** | abierta · SIN BLOQUEANTES |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ff0e289dacb6a424c4d7da87b1661258224d0cc4` | 2 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `b433ccc957b986abf8400b15c4b7d57f18472173` | 0 nuevos · H01/H02 cerrados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR302-H01 | El test de INSERT no prueba una policy INSERT self | alto | ✅ arreglado-verificado |
| PR302-H02 | El body afirma RED para cada prueba nueva, pero 24b nunca quedó RED | medio | ✅ arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos/evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Completar el informe independiente en el body para que `approval-policy` pueda quedar GREEN.
2. Merge de PR #302 por Lautaro073 cuando decida hacerlo.
3. Después del merge: esperar `migrate-develop` GREEN.
4. Recién entonces retomar T-313 / PR #251 y mergear `origin/develop`.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se agrega una regla global nueva: H01 reutiliza P08 y H02 reutiliza P15.
