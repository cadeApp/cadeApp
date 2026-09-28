# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 (Fase 2 · PWA, notificaciones y accesibilidad) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **Base original del PR** | `15d21e8105ab08e7c05105105a3c0e325e87fd04` |
| **develop al revisar R2** | `57badabc28fd3bd8e913674bd80b30feb8828414` |
| **SHA R2** | `a1c93ae2cd482e497254cc836a21f12cddbbb160` |
| **Tamaño R2** | 33 archivos, +1947 / -16 |
| **Estado** | bloqueada · R2 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `f661f372e0cc708759caf91816b3483d31883f69` | 4 bloqueantes + 1 mejora + A01 aceptado | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a1c93ae2cd482e497254cc836a21f12cddbbb160` | 5 bloqueantes: H04 + H06–H09 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Decisiones humanas vigentes

- **D01 / 1-A:** aceptado `src/features/notifications/index.ts`.
- **D02 / 2-A:** autorizados exactamente los cuatro archivos de `offers` ya incorporados a la ficha.
- **D03 / 3-A:** Cache Storage solo persiste shell/assets públicos same-origin explícitamente permitidos.

R2 no encontró ninguna decisión humana nueva.

## Estado por hallazgo

| ID | Título | Sev. | Estado R2 |
|---|---|---|---|
| PR117-A01 | Entry point de notifications fuera de la ficha original | decisión | aceptado |
| PR117-H01 | T03 no protegía el feed/ofertas reales | alto | arreglado sin verificación de ejecución |
| PR117-H02 | SW real persistía GETs arbitrarios y se probaba otro archivo | alto | arreglado sin verificación de ejecución |
| PR117-H03 | Piso 14 px / Retry 48 px | alto | arreglado sin verificación de ejecución |
| PR117-H04 | Falta navegador real/capturas 390/360 | medio | abierto |
| PR117-H05 | Rollback falso sobre unregister | bajo | arreglado verificado por inspección |
| PR117-H06 | Reintentar solo actualiza una instancia de `useOfflineStatus` | alto | abierto |
| PR117-H07 | El test del guard de submit offline no puede detectar que se borre el guard | medio | abierto |
| PR117-H08 | El harness del SW introduce 8 `any` explícitos | medio | abierto |
| PR117-H09 | Maskable = copia del icono normal; falta set PWA/Safari exigido por S00 | alto | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir H06–H09 con el prompt de R2.
2. Mantener H04 abierto y desmarcar en la ficha la verificación visual hasta tener evidencia real; no fabricar capturas.
3. Dejar RED/GREEN reproducible de H06–H09.
4. Volver a pedir R3. Recién cuando no queden bloqueantes se inspeccionará CI del SHA candidato.

## Para el análisis posterior

R2 refuerza **P08-control-no-cubre-lo-que-dice** en tres lugares nuevos: Retry sin postcondición compartida, submit offline cuyo test solo hace click en un botón disabled, y validación de iconos que comprueba existencia/tamaño de archivo pero no dimensiones ni que el maskable sea realmente distinto/seguro.
