# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 (Fase 2 · PWA, notificaciones y accesibilidad) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **develop al revisar R5** | `57badabc28fd3bd8e913674bd80b30feb8828414` |
| **SHA R5** | `aea137697424c0da86d256c0675b0ca6a7267eda` |
| **Estado** | bloqueada · R5 · H11 |

## Rondas

| Ronda | SHA revisado | Resultado |
|---|---|---|
| 1 | `f661f372...` | 4 bloqueantes + mejora + A01 |
| 2 | `a1c93ae...` | H04 + H06–H09 |
| 3 | `3795238...` | H04 + H10 |
| 4 | `d47c7c1...` | H04 |
| 5 | `aea137697424c0da86d256c0675b0ca6a7267eda` | H04 aceptado por waiver; H11 bundle regression abierto |

## Decisiones humanas

- **D01 / 1-A:** aceptar `src/features/notifications/index.ts`.
- **D02 / 2-A:** autorizar los cuatro archivos de offers.
- **D03 / 3-A:** Cache Storage solo shell/assets públicos same-origin.
- **D04 / waiver R5:** Lautaro073 acepta continuar sin Safari ni capturas reales. H04 queda **aceptado con riesgo**, no “verificado”.

## Estado

- A01: aceptado.
- H01–H03 y H05–H10: cerrados/verificados.
- H04: aceptado por waiver humano.
- **H11: abierto — /courier/feed y /courier/offers suben de 176 kB a 244 kB.**

## Próximo paso

Corregir H11 con el menor cambio posible en la API pública de `notifications`, medir el build real y volver a pedir revisión. No hay que volver a trabajar H04.
