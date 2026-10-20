# PR #407 / T-371 — revisión independiente, ronda 2 (2026-10-17)

**SHA funcional y test revisado:** `672425967bebfc18e5bb80e32139be35bd0a3e7b`.
**Resultado de implementación:** **SIN BLOQUEANTES de código**. H01 y A01 verificados con CI real y mutación RED aislada. **Resultado para merge:** **pendiente** de E2E gate final del SHA y estado de PR; no se aprobó ni mergeó.

## Cambios inspeccionados

1. `src/features/requests/actions.test.ts:390-431`: el test de `PUBLICATION_CREDITS_EXHAUSTED` ahora exige una invocación única de `create_and_publish_multi_drop`, con `p_payload.requestId` correcto y `drops` que contiene la dirección prevista. Mantiene `ActionResult` esperado.
2. `src/features/requests/components/create-request-form.test.tsx:352-403`: tras un submit válido exige vía `waitFor` una única llamada a `createDeliveryRequestAction` con `requestId` y drop de destinatario consentido. Conserva la alerta accesible y ausencia de notificación de éxito.
3. `develop` se incorporó mediante commit de merge de dos padres (`b89f4e8` + `d885b24`) en el SHA 672425967bebfc18e5bb80e32139be35bd0a3e7b. El árbol heredó exactamente `docs/implementation-plan.md` de develop; `docs/tasks/T-371.md` sólo se diferencia de develop en casillas DoD documentadas. La ficha autoriza `docs/implementation-plan.md`. No hay ajustes de contratos, RPC, RLS, dependencias o UI productiva en el commit correctivo.

## Verificación GREEN independiente

CI `39075002912` sobre SHA `672425967bebfc18e5bb80e32139be35bd0a3e7b` finalizó SUCCESS:
- `unit`: **141 Test Files PASS / 2670 Tests PASS**, más 79 controles de workflows y 6 de ADR.
- `typecheck`, `lint`, `audit`, `build`, `bundle-budget`: **SUCCESS**.
- `db-tests`: **SUCCESS** (pgTAP con ensayos de mutación propios del pipeline incluidos).
El revisor verificó jobs y logs de GitHub, **no ejecutó tests locales** por falta de clon accesible.

La implementación T-371 original sobre `b2dbfc2` ya tenía E2E trusted PASS, run `39069904081`: **86 Chromium PASS y 3 global-settings PASS**. No cambió el código productivo ni el spec E2E desde ese SHA, sólo se añadieron aserciones unitarias y se mergeó documentación/revisión.

El nuevo SHA `672425967bebfc18e5bb80e32139be35bd0a3e7b` recibió estatus `e2e-preview=error` debido a **CANCELLED** del run `39075070502` primer intento, sin aserción fallida. Se solicitó rerun de jobs fallidos del workflow confiable, mismo run `39075070502` intento 2, cuyo resultado estaba **pendiente** al redactar este informe. No atribuir el cancelado a defecto funcional ni certificar el intento 2 sin leer su resultado.

## Prueba de mutación real y aislada

- PR de mutación exclusivamente `review/T-371-wiring-red`, [#409](https://github.com/cadeApp/cadeApp/pull/409), **CERRADA SIN MERGE**.
- Primer intento `3d53a36` hizo TypeScript RED incidental, **descartado como prueba válida**.
- Segundo mutante tipado `dab6c3903b3e47b5771f5a1127a78fe8cdea2253`, run `39075230095`, job `117521016731`, pasó **typecheck y build**; Vitest unit terminó **2 files failed / 17 tests failed / 2653 passed**.
- Los DOS tests T-371 nuevos fallaron por `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times`. El mutante de Actions evita la RPC; el de CreateRequestForm evita la Server Action pero muestra el mismo texto. Los 17 fallos abarcan casos preexistentes también afectados, NO se dice que sean 17 hallazgos T-371.
- Contra el código limpio `672425967bebfc18e5bb80e32139be35bd0a3e7b`, ambos tests pasan junto a la suite completa. Evidencia de GREEN → RED semántico → GREEN en el **código de ramas aisladas**, sin mutantes en PR #407.

## Resultado por hallazgo

| ID | Estado | Comprobación |
|---|---|---|
| PR407-H01 | **arreglado-verificado** | CI green SHA `672425967bebfc18e5bb80e32139be35bd0a3e7b`, mutación aislada RED SHA `dab6c39` en ambos asserts de invocación. |
| PR407-A01 | **arreglado-verificado** | Merge de develop, ficha/plan sincronizados, verificación CI de ficha. |

## Pendientes operativos (NO defectos de implementación)

- Leer resultado real del E2E Preview rerun `39075070502` attempt 2; no merge si el status actual continúa CANCELLED/pending/error. No iniciar E2E falso ni alterar checks.
- El cuerpo de PR #407 originalmente era sólo `Closes #405` y `approval-policy` fallaba por falta del informe de revisión. Hay que agregar un informe completo sin bloqueantes con los campos exigidos por `.github/workflows/approval-policy.mjs` para desbloquearlo, una vez emitido este dictamen.
- La PR sigue Draft hasta activar Ready for review.
- Sólo se cerrará #405 mediante el merge de #407 cuando los gates estén conformes. No modificar PR #389 ni fusionar el código de T-362 aquí.

**Regla 10:** NO exigir un CI GREEN nuevo sólo porque se actualizó la bitácora o esta carpeta de revisión. El SHA funcional probado es `672425967bebfc18e5bb80e32139be35bd0a3e7b`; conservar su trazabilidad.