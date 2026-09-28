# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 (Fase 2 · PWA, notificaciones y accesibilidad) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **Base original del PR** | `15d21e8105ab08e7c05105105a3c0e325e87fd04` |
| **develop al revisar R3** | `57badabc28fd3bd8e913674bd80b30feb8828414` |
| **SHA R3** | `37952386084ea8388b624c71c33ff3378f03414a` |
| **Estado** | bloqueada · R3 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `f661f372e0cc708759caf91816b3483d31883f69` | 4 bloqueantes + 1 mejora + A01 aceptado | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a1c93ae2cd482e497254cc836a21f12cddbbb160` | 5 bloqueantes: H04 + H06–H09 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `37952386084ea8388b624c71c33ff3378f03414a` | 2 bloqueantes: H04 + H10 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Decisiones humanas vigentes

- **D01 / 1-A:** aceptado `src/features/notifications/index.ts`.
- **D02 / 2-A:** autorizados exactamente los cuatro archivos de `offers`.
- **D03 / 3-A:** Cache Storage solo persiste shell/assets públicos same-origin explícitamente permitidos.

R3 no requiere decisiones nuevas.

## Estado por hallazgo

| ID | Estado R3 |
|---|---|
| A01 | aceptado |
| H01–H03 | arreglado-sin-verificar ejecución |
| H04 | **abierto — evidencia visual real pendiente** |
| H05 | arreglado-verificado |
| H06–H07 | arreglado-sin-verificar ejecución |
| H08 | arreglado-verificado |
| H09 | arreglado-verificado por inspección binaria/visual |
| H10 | **abierto — detector Safari acepta cualquier navegador iOS** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir H10 con el prompt acotado de R3.
2. Mantener H04 abierto hasta navegador real + capturas persistentes 390/360; no fabricar evidencia.
3. Volver a pedir R4. Solo con H04/H10 cerrados se revisará CI del SHA candidato.

## Nota de la revisión

H10 ya existía desde la implementación inicial y debió haberse detectado en R1. R3 lo registra explícitamente: el binding T00 dice Safari-only y el predicado actual solo detecta plataforma iOS + no-standalone.
