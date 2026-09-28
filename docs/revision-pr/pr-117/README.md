# PR #117 — T-201 · Manifest, íconos maskable, service worker y onboarding de instalación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/117 |
| **Tarea** | T-201 |
| **Rama** | `feat/T-201-pwa-manifest-sw` → `develop` |
| **SHA R7** | `52b47f80f501a070fc20b8847bd3acc12d12d158` |
| **develop actual** | `c5d2612d211469468ec1ee465939c4b46fa9a6ba` |
| **Estado** | bloqueada · R7 · PR117-R01 |

## Rondas

| Ronda | SHA revisado | Resultado |
|---|---|---|
| 1 | `f661f372...` | 4 bloqueantes + mejora + A01 |
| 2 | `a1c93ae...` | H04 + H06–H09 |
| 3 | `3795238...` | H04 + H10 |
| 4 | `d47c7c1...` | H04 |
| 5 | `aea13769...` | H04 waiver; H11 abierto |
| 6 | `5e48b780...` | H11 cerrado; A02 aceptado; H12 abierto |
| 7 | `52b47f80f501a070fc20b8847bd3acc12d12d158` | H12 cerrado; branch al día; R01 bundle abierto |

## Decisiones humanas vigentes

- **D01:** aceptar `src/features/notifications/index.ts`.
- **D02:** autorizar los cuatro archivos de offers para T03.
- **D03:** Cache Storage solo shell/assets públicos same-origin.
- **D04:** waiver visual H04; aceptado con riesgo, no verificado.
- **D05:** aceptar los cuatro cambios de imports UI hoja de R6.
- **D06:** no autorizar import profundo entre features ni `eslint-disable boundaries/entry-point`.

## Estado

- A01, A02: aceptados.
- H01–H03, H05–H12: cerrados/verificados.
- H04: aceptado por waiver.
- **PR117-R01: abierto.**
- Rama contra develop: **ahead 18 / behind 0**, mergeable.

## Evidencia R7

CI #556 del SHA R7:
- typecheck ✅
- lint ✅
- build ✅
- unit ✅ — 99 archivos / 1312 tests
- db-tests ✅ — 12 archivos / 1601 tests
- audit advisory: 2 vulnerabilidades, preexistente
- bundle-budget advisory: **courier fuera de presupuesto**

```text
develop c5d2612d (CI #553):
  /courier/feed    176 kB  OK
  /courier/offers  176 kB  OK

PR 52b47f80 (CI #556):
  /courier/feed    198 kB  Supera el límite
  /courier/offers  198 kB  Supera el límite
```

H12 queda cerrado: `CourierFeed` usa el entry point canónico y el lint remoto no reporta `boundaries/entry-point`.

El cierre final depende únicamente de resolver R01 sin reintroducir el bypass arquitectónico.
