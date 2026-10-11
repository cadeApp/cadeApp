# PR #317 — T-340 · Paso 1/4 — esquema y puente legacy

**Autor:** @asako669 · **Base:** `develop` · **Estado:** CON BLOQUEANTES, NO MERGEAR.

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cf69ffd6` | 5 bloqueantes | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `5bba8319` | 4 nuevos bloqueantes; H03 parcial | [Ronda 2](revisiones/ronda-2.md) |

## Estado de los hallazgos

| ID | Estado |
|---|---|
| H01 | Arreglado/verificado: migración sin `zones.is_active`. |
| H02 | Arreglado/verificado: sin datos del destinatario ficticios; ver H09. |
| H03 | Parcial: 22 `pass()` retirados; persisten pruebas que no ejercitan backfill (H07). |
| H04 | Arreglado/verificado: fixture corregido y 40 pgTAP en CI. |
| H05 | Arreglado/verificado: `get_trip_details` preservado para paso 2. |
| H06 | **CRÍTICO abierto:** guard declarado `SECURITY DEFINER`. |
| H07 | **ALTO abierto:** backfill no probado contra código productivo. |
| H08 | **ALTO abierto:** no hay prueba concurrente de dos sesiones. |
| H09 | **ALTO abierto:** auditoría no detecta inconsistencias de pago. |

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

**No comenzar paso 2 ni mergear PR #317** hasta completar correcciones, revisión independiente y checkpoint posterior a integración en Develop.
