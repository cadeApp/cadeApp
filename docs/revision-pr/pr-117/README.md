# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 (Fase 2 · PWA, notificaciones y accesibilidad) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **Base original del PR** | `15d21e8105ab08e7c05105105a3c0e325e87fd04` |
| **develop al revisar** | `57badabc28fd3bd8e913674bd80b30feb8828414` |
| **SHA revisado** | `f661f372e0cc708759caf91816b3483d31883f69` |
| **Tamaño** | 25 archivos, +1141 / -9 |
| **Estado** | bloqueada · R1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---:|---|
| 1 | `f661f372e0cc708759caf91816b3483d31883f69` | 5 abiertos + 1 alcance aceptado | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Decisiones humanas resueltas antes del cierre

Lautaro073 resolvió en esta ronda:

- **D01 = 1-A:** se acepta `src/features/notifications/index.ts` como excepción exacta de alcance por ser el entry point exigido por la arquitectura.
- **D02 = 2-A:** T-201 queda autorizada a tocar, solo para completar T03 real:
  - `src/features/offers/components/courier-feed.tsx`
  - `src/features/offers/components/request-card.tsx`
  - `src/features/offers/components/offer-sheet.tsx`
  - `src/features/offers/courier-panel.test.tsx`
- **D03 = 3-A:** Cache Storage solo puede persistir shell y assets públicos explícitamente permitidos, same-origin. No se persisten `/api/**`, HTML/RSC autenticado ni lecturas de usuario.

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR117-A01 | Entry point de notifications fuera de la ficha original | decisión | aceptado |
| PR117-H01 | T03 se prueba con un botón ficticio y no protege el feed real | alto | abierto |
| PR117-H02 | El SW real persiste GETs arbitrarios y sus tests ejercen otro archivo | alto | abierto |
| PR117-H03 | T01/T03/T04 incumplen piso 14 px y Retry de T03 mide 36 px | alto | abierto |
| PR117-H04 | La “verificación visual” es jsdom y no hay capturas reales enlazadas | medio | abierto |
| PR117-H05 | El rollback del cuerpo de la PR afirma una desregistración automática inexistente | bajo | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Pullear este commit de revisión y mergear `origin/develop` sin rebase.
2. Aplicar H01–H04 y H05 siguiendo el prompt de la R1.
3. Reflejar D02 en la ficha **solo con los cuatro paths aprobados**; no ampliar ningún otro archivo.
4. Dejar evidencia RED/GREEN real. No crear tests ficticios ni adulterar expectativas para obtener verde.
5. Volver a pedir revisión sobre el nuevo SHA.

## Para el análisis posterior

La recurrencia dominante es **P08-control-no-cubre-lo-que-dice**: la suite verde demuestra proxies creados por el propio test, mientras el runtime relevante queda fuera. No se propone una lección AG nueva en esta ronda: el patrón ya está catalogado y fue marcado como reincidente en el protocolo de revisión.
