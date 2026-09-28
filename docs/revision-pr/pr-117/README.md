# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **SHA R6** | `5e48b7809c0ceb62743f23162b5061dfabdfad4e` |
| **develop actual** | `c91ec4e304de0d983cd31be3c77acecf374304bf` |
| **Estado** | bloqueada · R6 · H12 + sincronización develop |

## Rondas

| Ronda | SHA revisado | Resultado |
|---|---|---|
| 1 | `f661f372...` | 4 bloqueantes + mejora + A01 |
| 2 | `a1c93ae...` | H04 + H06–H09 |
| 3 | `3795238...` | H04 + H10 |
| 4 | `d47c7c1...` | H04 |
| 5 | `aea13769...` | H04 waiver; H11 abierto |
| 6 | `5e48b7809c0ceb62743f23162b5061dfabdfad4e` | H11 cerrado; A02 aceptado; H12 abierto; branch behind develop 1 |

## Decisiones humanas vigentes

- **D01:** aceptar entry point `notifications/index.ts`.
- **D02:** autorizar los cuatro archivos de offers para T03.
- **D03:** Cache Storage solo shell/assets públicos same-origin.
- **D04:** waiver visual H04; aceptado con riesgo, no verificado.
- **D05 / R6:** aceptar exactamente los cambios de imports UI hoja en:
  - `install/ios-install-guide-sheet.tsx`
  - `offline/offline-banner.tsx`
  - `offline/error-view.tsx`
  - `offline/not-found-view.tsx`
- **D06 / R6:** NO autorizar import profundo entre features ni `eslint-disable boundaries/entry-point`; `CourierFeed` debe volver a `@/features/notifications`.

## Estado

- A01, A02: aceptados.
- H01–H03, H05–H11: cerrados/verificados.
- H04: aceptado por waiver.
- **H12: abierto.**
- La rama está **behind 1** respecto de `develop`; debe mergear `origin/develop` sin rebase y revalidar.

## Evidencia H11

CI R6:
- `/courier/feed = 177 kB` ✅
- `/courier/offers = 177 kB` ✅

develop actual:
- `/courier/feed = 176 kB`
- `/courier/offers = 176 kB`

La regresión original de 244 kB queda resuelta. El cierre final depende de mantener ≤180 después de H12 + merge de develop.
