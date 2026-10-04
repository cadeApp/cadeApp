# PR #240 — T-334 · Onboarding incompleto de comercio y repartidor

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/240 |
| **Tarea** | T-334 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-334-incomplete-onboarding-redirect` → `develop` |
| **Base** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **Estado** | ✅ REVISIÓN CERRADA · AUTORIZADA PARA MERGE |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `5c31ed86db8cacd923367deaa190c5880e0b60e5` | H01/H02/H03 abiertos; D01/D02 decididos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `94cf3db9635833b3ef1c8723717908c11fac1bff` | H01 ✅ · H02 ✅ · D02 ✅ · H03 pendiente humana | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `4bf9cfacf20aabd9b217eb8681febb0c04e96153` | H04 detectado manualmente y corregido | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `db42f5283a915eeb17fe50ab9fb6aea438b063ab` | H05 corregido; CI #1082 ✅ | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `5a42461aca653740cb5583b79f8f67997429c6aa` | H03 ✅ manual; 0 hallazgos abiertos; merge autorizado | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado final por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR240-H01 | La excepción de `/courier/profile` también abre sus descendientes | alto | ✅ cerrado R2 |
| PR240-H02 | `vehicle_type` se escribe antes de que el onboarding termine | alto | ✅ cerrado R2 |
| PR240-H03 | Verificación manual del DoD | medio | ✅ cerrado R5 |
| PR240-H04 | Courier incompleto puede ver `status` y falsa “revisión manual” | alto | ✅ cerrado R3 |
| PR240-H05 | LoginForm pierde `onboardingComplete` y recalcula courier a feed | alto | ✅ cerrado R4 |

## Decisiones finales

- **D01 = 1-A:** `vehicle_type` es el marcador final y se escribe después de consentimientos/documentos.
- **D02 = 2-A:** error/desconocido al leer el marcador mantiene fail-open de navegación (`undefined`).
- **D03:** courier incompleto puede usar `identity` y `vehicle`, pero no `status`.
- **D04:** `loginAction` transporta `onboardingComplete`; `LoginForm` lo pasa a `resolvePostLoginRedirect`.

## Evidencia de cierre

- SHA funcional definitivo: `db42f5283a915eeb17fe50ab9fb6aea438b063ab`.
- GitHub Actions **#1082 / 37166448240: SUCCESS**.
- Vercel del SHA funcional: SUCCESS.
- Comercio incompleto: PASS manual informado.
- Courier incompleto: PASS manual final confirmado por Lautaro073 (“ahora sí”).
- Lautaro073 pidió explícitamente mergear la PR.

No quedan bloqueantes de T-334.

## Seguimiento fuera de alcance

- #243 — aislar mutaciones de `cc007.test.ts`.
