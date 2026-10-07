# PR #298 — T-314 · E2E de mapas, geolocalización y privacidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/298 |
| **Tarea** | T-314 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-314-map-privacy` → `develop` |
| **Base revisada** | `develop@a773c05` |
| **SHA revisado** | `e72a45795b1fa165586a58d709b9faeb3a5bba99` |
| **Estado** | **BLOQUEADA · 3 bloqueantes** |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d60a047` | 5 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `e72a457` | 3 bloqueantes; H03/H04 cerrados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Sev. | Estado | Título |
|---|---|---|---|
| H01 | alto | abierto | D3/D15 en red puede pasar sin observar el fetch vivo |
| H02 | alto | abierto | locator GPS ambiguo en solicitud |
| H03 | alto | cerrado R2 | el caso feliz ya distingue mapa real de fallback |
| H04 | alto | cerrado R2 | el mock ya exige tráfico interceptado y cero unexpected |
| H05 | medio | abierto | evidencia RED/GREEN y body siguen internamente inconsistentes |

Decisión: **PR298-D01=A**, privacidad pre-match = DOM + red/RSC.

Datos: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. H01: exigir que la prueba observe explícitamente `/api/live/available-requests` antes de declarar red limpia.
2. H02: acotar el botón GPS al bloque de entrega; hoy hay dos botones con el mismo nombre accesible.
3. H05: registrar evidencia reproducible y corregir el body de `pnpm test`.
4. Reejecutar E2E Preview y volver a revisión independiente.
