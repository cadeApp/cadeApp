# PR #237 — T-325 · Unificar carga visual de licencia y seguro con documentos de identidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/237 |
| **Tarea** | T-325 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-325-unified-document-upload` → `develop` |
| **Base revisada** | `e39569b59fa8203df9893dbb824cbc4a317d4181` |
| **SHA funcional final revisado** | `8b8142b35ddef3c87066398a4ad9a5eed125b36e` |
| **Estado** | **SIN BLOQUEANTES — revisión técnica cerrada; no aprobada/mergeada por el revisor** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `7d65e8649302a788a8f9c2cdbf28d72295f6666d` | 3 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `40929053157569b68ec19d06d74e63c168248eb1` | H01/H02 corregidos sin verificar; H03 parcial | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `8b8142b35ddef3c87066398a4ad9a5eed125b36e` | **0 bloqueantes · 3/3 cerrados** | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR237-H01 | Un reemplazo fallido borra la ruta opcional ya cargada | alto | arreglado-verificado |
| PR237-H02 | El control de archivo no muestra foco visible de teclado | medio | arreglado-verificado |
| PR237-H03 | Falta la evidencia visual y de accesibilidad obligatoria | alto | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos/evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Verificación final

- CI #1064 del SHA `8b8142b35ddef3c87066398a4ad9a5eed125b36e`: **success**.
- Unit/coverage: **116 archivos · 1774/1774 tests**.
- DB: **17 archivos · 1807 tests · PASS** (más sonda inicial 1 archivo/10 tests PASS).
- E2E Preview contra `8b8142b35ddef3c87066398a4ad9a5eed125b36e`: **20/20 Chromium + 3/3 global-settings**.
- Vercel: success.
- Evidencia real abierta por el revisor:
  - foco visible a 360 px;
  - éxito real a 360 px con `licencia.png` y `poliza.png`, check y «Cargado».
- Rama al cerrar el SHA funcional: **8 commits adelante / 0 atrás de develop**, mergeable.

## No bloqueantes preexistentes

La captura final hace visibles dos detalles que ya existían en el patrón del paso 2 y no nacen en T-325:

- `text-success` / `bg-success/15` no tienen token `success` definido, por lo que el éxito no toma verde;
- a 360 px el título largo de licencia puede truncarse.

T-325 exigía paridad con el paso 2 y esa paridad se cumple. No se amplía esta ficha para corregirlos.

## Resultado

**La revisión independiente queda cerrada sin bloqueantes.**  
El revisor no ejecutó una aprobación de GitHub ni mergeó la PR, porque Lautaro073 no lo pidió explícitamente.
