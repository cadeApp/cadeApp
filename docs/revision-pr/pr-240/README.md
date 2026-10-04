# PR #240 — T-334 · Onboarding incompleto de comercio y repartidor

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/240 |
| **Tarea** | T-334 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-334-incomplete-onboarding-redirect` → `develop` |
| **Base** | `b4119ef3e16170decda0a1649fc35db207faa8b0` |
| **Estado** | abierta · draft · BLOQUEADA SOLO POR RETEST MANUAL COURIER |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `5c31ed86db8cacd923367deaa190c5880e0b60e5` | H01/H02/H03 abiertos; D01/D02 decididos | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `94cf3db9635833b3ef1c8723717908c11fac1bff` | H01 ✅ · H02 ✅ · D02 ✅ · H03 pendiente humana | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `4bf9cfacf20aabd9b217eb8681febb0c04e96153` | H04 detectado manualmente y corregido | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `db42f5283a915eeb17fe50ab9fb6aea438b063ab` | H05 corregido; CI #1082 ✅; H03 requiere retest courier | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR240-H01 | La excepción de `/courier/profile` también abre sus descendientes | alto | ✅ cerrado en R2 |
| PR240-H02 | `vehicle_type` se escribe antes de que el onboarding termine | alto | ✅ cerrado en R2 |
| PR240-H03 | Verificación manual del DoD | medio | ⏳ comercio PASS; courier requiere retest |
| PR240-H04 | Courier incompleto puede ver `status` y una falsa “revisión manual” | alto | ✅ cerrado en R3 |
| PR240-H05 | LoginForm pierde `onboardingComplete` y recalcula courier a feed | alto | ✅ cerrado en R4 |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones vigentes

- **D01 = 1-A:** `vehicle_type` es el marcador final y se escribe después de consentimientos/documentos.
- **D02 = 2-A:** error/desconocido al leer el marcador mantiene fail-open de navegación (`undefined`).
- **D03:** un courier incompleto puede usar `identity` y `vehicle`, pero no `status`.
- **D04:** `loginAction` expone `onboardingComplete`; `LoginForm` conserva `resolvePostLoginRedirect` pero debe pasar ese valor como cuarto argumento. Los demás destinos autenticados equivalentes también deben considerar el marcador.

## Ronda 4

El retest manual de Lautaro073 demostró que el courier incompleto seguía cayendo en `/courier/feed`. La causa no estaba ya en el guard: `loginAction` devolvía correctamente `/courier/onboarding/identity`, pero `LoginForm` recalculaba el destino únicamente con rol + consentimiento y perdía el estado de onboarding.

La clase completa se enumeró:
- `auth/confirm/route.ts`: ya chequea onboarding;
- `LoginForm`: era el bug real;
- `ResetPasswordForm`: consume el destino de su action;
- `updatePasswordAction`: también recalculaba sin marcador y se corrigió para evitar el mismo fallo tras recuperación.

Primer intento `3cfe1b0`: usar `result.data.redirectTo` directamente. El control T-118 de integridad de rutas lo rechazó correctamente. No se debilitó ese control.

Fix definitivo `db42f5283a915eeb17fe50ab9fb6aea438b063ab`:
- `loginAction` devuelve `onboardingComplete`;
- `LoginForm` llama `resolvePostLoginRedirect(..., result.data.onboardingComplete)`;
- `updatePasswordAction` lee el marcador y aplica la misma regla;
- D02 fail-open se conserva.

CI del SHA `db42f5283a915eeb17fe50ab9fb6aea438b063ab`: **run #1082 / 37166448240 SUCCESS**:
- unit/test:coverage ✅
- build ✅
- typecheck ✅
- lint ✅
- db-tests ✅
- audit ✅
- bundle-budget ✅
- Vercel ✅

## Qué queda por hacer

**Solo H03 manual courier.** Hacé pull/restart y repetí con una cuenta courier incompleta:
1. login → `/courier/onboarding/identity`;
2. feed/ofertas/status → identity;
3. `/courier/profile` → abre y muestra “Completá tu registro”;
4. `/courier/profile/notifications` → identity.

Si eso da PASS, no quedan hallazgos funcionales abiertos.

## Seguimiento fuera de alcance

- #243 — aislar las mutaciones de `cc007.test.ts`.
