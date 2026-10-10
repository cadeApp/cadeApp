# PR #317 — T-340 · Etapa 1: esquema, puente y backfill

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/317 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-340-varias-entregas` → `develop` |
| Revisión | `cf69ffd6a99d65418894c57868db86d8e28822fe` |
| Base al revisar | `7cf1a653dfa193f254d41611b47ae65930435b84` |
| Tamaño | 6 archivos, +2235/-9 reportados en PR |
| Estado | **CON BLOQUEANTES (5) — no mergear** |

## Rondas

| Ronda | SHA revisado | Bloqueantes | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Motivo | Severidad | Estado |
|---|---|---|---|
| PR317-H01 | Migración falla por columna inexistente | alto | abierto |
| PR317-H02 | Backfill inventa información y consentimiento | alto | abierto |
| PR317-H03 | 22 tests `pass()` falsos | alto | abierto |
| PR317-H04 | Fixture/plan pgTAP incompatibles | alto | abierto |
| PR317-H05 | `get_trip_details` adelantado al paso 1 | medio | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Próximo paso

Agy corrige únicamente H01–H05 sin tocar `docs/revision-pr/**`, aporta CI DB y pruebas RED→GREEN verdaderas; nueva ronda independiente sobre nuevo HEAD. No mergear ni comenzar T-340 paso 2 hasta el gate de Develop.
