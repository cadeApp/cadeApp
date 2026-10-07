# PR #298 — T-314 · E2E de mapas, geolocalización y privacidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/298 |
| **Tarea** | T-314 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-314-map-privacy` → `develop` |
| **Base revisada** | `develop@a773c05` |
| **SHA revisado** | `d60a0473b027db3e93145b27cb4b83bd59caf60a` |
| **Estado** | **BLOQUEADA · 5 bloqueantes** |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d60a047` | 5 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Hallazgos

| ID | Sev. | Estado | Título |
|---|---|---|---|
| H01 | alto | abierto | D3/D15 no se verifica en red/RSC |
| H02 | alto | abierto | pin fuera de Aguilares puede quedar sin probar |
| H03 | alto | abierto | wrapper post-match no demuestra mapa real |
| H04 | alto | abierto | control “0 llamadas a Google” tautológico |
| H05 | medio | abierto | RED/bitácora no corresponden al HEAD |

## Decisión P1

**PR298-D01 — ACEPTADA:** Lautaro073 eligió **A**. T-314 debe probar privacidad D3/D15 en **DOM + red/RSC**. La corrección sigue limitada al E2E y no autoriza cambios productivos persistentes.

## Siguiente ronda

Corregir H01–H05, aportar RED reales por mutación, actualizar bitácora y volver a revisión independiente.

Datos: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
