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
| 3 | `4bf9cfacf20aabd9b217eb8681febb0c04e96153` | H04 detectado manualmente y corregido; CI ✅; H03 requiere retest courier | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR240-H01 | La excepción de `/courier/profile` también abre sus descendientes | alto | ✅ cerrado en R2 |
| PR240-H02 | `vehicle_type` se escribe antes de que el onboarding termine | alto | ✅ cerrado en R2 |
| PR240-H03 | Verificación manual del DoD | medio | ⏳ comercio PASS; courier requiere retest |
| PR240-H04 | Courier incompleto puede ver `status` y una falsa “revisión manual” | alto | ✅ corregido en R3; pendiente confirmación manual dentro de H03 |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Decisiones vigentes

- **D01 = 1-A:** `vehicle_type` es el marcador final y se escribe después de consentimientos/documentos.
- **D02 = 2-A:** error/desconocido al leer el marcador mantiene fail-open de navegación (`undefined`).
- **D03 (manual R3):** un courier con `onboardingComplete === false` puede usar `identity` y `vehicle`, pero no `status`. Tanto `/courier/onboarding/status` como `/onboarding/status` deben terminar en `/courier/onboarding/identity`.

## Ronda 3

La prueba manual de Lautaro073 encontró un caso que los tests de R1 trataban incorrectamente como permitido: la pantalla `status` se había incluido en la excepción amplia de “rutas de onboarding”.

El arreglo mínimo quedó en `4bf9cfacf20aabd9b217eb8681febb0c04e96153`:

- no se tocó `StatusView`;
- solo se restringió el guard a las etapas editables `identity` y `vehicle`, más `/courier/profile`;
- se actualizaron los tests para exigir que `status` redirija cuando el courier está incompleto y siga accesible cuando está completo;
- ficha y bitácora reflejan D03.

CI del SHA `4bf9cfacf20aabd9b217eb8681febb0c04e96153`: **run #1075 / 37160178864 SUCCESS** con build, lint, unit/test:coverage, typecheck, db-tests, audit y bundle-budget verdes.

## Qué queda por hacer

1. **Lautaro073:** hacer pull/restart local y repetir solo el flujo courier incompleto.
2. Verificar que abrir feed/ofertas/status termina en `/courier/onboarding/identity`.
3. Verificar que `/courier/profile` exacto sigue accesible y muestra “Completá tu registro”.
4. Verificar que `/courier/profile/notifications` vuelve al onboarding.
5. Registrar PASS/FAIL; si pasa, cerrar H03 y recién ahí decidir merge.

## Seguimiento fuera de alcance

- #243 — aislar las mutaciones de `cc007.test.ts`.
