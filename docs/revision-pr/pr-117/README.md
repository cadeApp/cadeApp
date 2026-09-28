# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 (Fase 2 · PWA, notificaciones y accesibilidad) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **Base original del PR** | `15d21e8105ab08e7c05105105a3c0e325e87fd04` |
| **develop al revisar R4** | `57badabc28fd3bd8e913674bd80b30feb8828414` |
| **SHA R4** | `d47c7c1b62b8288a2b273843c1e0118133fc927b` |
| **Estado** | bloqueada · R4 · solo H04 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `f661f372e0cc708759caf91816b3483d31883f69` | 4 bloqueantes + 1 mejora + A01 aceptado | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a1c93ae2cd482e497254cc836a21f12cddbbb160` | 5 bloqueantes: H04 + H06–H09 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `37952386084ea8388b624c71c33ff3378f03414a` | 2 bloqueantes: H04 + H10 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `d47c7c1b62b8288a2b273843c1e0118133fc927b` | 1 bloqueante: H04 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Decisiones humanas vigentes

- **D01 / 1-A:** aceptado `src/features/notifications/index.ts`.
- **D02 / 2-A:** autorizados exactamente los cuatro archivos de `offers`.
- **D03 / 3-A:** Cache Storage solo persiste shell/assets públicos same-origin explícitamente permitidos.

R4 no requiere decisiones nuevas.

## Estado por hallazgo

| ID | Estado R4 |
|---|---|
| A01 | aceptado |
| H01–H03 | arreglado-sin-verificar ejecución independiente |
| H04 | **ABIERTO — único bloqueante** |
| H05 | arreglado-verificado |
| H06–H07 | arreglado-sin-verificar ejecución independiente |
| H08–H10 | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

No hay más correcciones de código pedidas a agy.

Para cerrar H04 hace falta evidencia de navegador real:
- 390×844 y 360×800;
- T01 Sheet en Safari iOS;
- T03 CourierFeed offline;
- T04 error y 404;
- foco visible, safe-area y reduced-motion;
- capturas persistentes enlazadas en PR + bitácora.

Con H04 cerrado, la siguiente ronda pasa a CI/logs del SHA exacto y cierre final.
