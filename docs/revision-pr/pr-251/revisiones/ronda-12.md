# Revisión independiente — PR #251 / T-313 — Ronda 12

**Fecha:** 2026-10-07  
**SHA funcional revisado:** `39ceff9890da8906d5d19457587ec33718d73814`  
**Base:** `develop` @ `cd023e3453ead76983d54982df1548cb97aa57eb`  
**Resultado:** CON BLOQUEANTES (2), **0 nuevos**, H04 + H10. P3 pendiente.

## Cambios desde ronda 11

La rama mergeó `develop` tras T-348 (D04-A), incorporó `waitForFormHydration` antes del submit y agregó `revalidatePath('/merchant/dashboard')` y `revalidatePath('/merchant/onboarding')` después del UPDATE de merchant. Los unit tests verifican esas llamadas; no se debilitó ninguna aserción E2E. No hubo cambios propios en `supabase/migrations/**` ni `supabase/tests/**`.

D04-A completada:
- T-348 / PR #302 mergeada a `develop`, SHA `cd023e3453ead76983d54982df1548cb97aa57eb`;
- `migrate-develop` `37693700041`: GREEN; aplicó `20261007081131_t313_merchant_onboarding_update_policy.sql`;
- CI de develop `37693699897`: GREEN;
- rama: 46 ahead, **0 behind**.

## Comprobación en CI

CI `37703591192` contra `39ceff9`:
- audit, build, lint, db-tests, unit, typecheck, bundle-budget: **GREEN**.
- Vercel: GREEN.
- approval-policy `37703586790`: GREEN. El check valida política de aprobación/formato; **no sustituye evidencia E2E ni visto bueno P3**.

## H04 — abierto: alta completa sigue fallando

Trusted `e2e-preview` run `37703693643`, job `113072983040`: hizo checkout explícito de `39ceff9890da8906d5d19457587ec33718d73814` y corrió Playwright.

Resultado:
```text
45 passed
1 failed
```

Los tres DoD de T-313:
- `DoD: Un courier no entra a (merchant)`: PASS;
- `DoD: Sin consentimiento guardado el comercio no llega al panel`: PASS;
- `DoD: Alta completa y panel visible con la versión de consentimiento registrada`: FAIL (+ 2 retries).

La aserción fallida es `expect(page).toHaveURL(/\/merchant\/dashboard/)` en `e2e/specs/merchant-registration.spec.ts:285`; la página queda en `/merchant/onboarding`.

```text
[T-313 Onboarding Diagnostic]
setting=v1
pilotConsent=1.0
profileUpdated=true
merchantUpdated=true

Expected: /merchant/dashboard
Received: /merchant/onboarding
```

Esto **descarta la persistencia de merchant como fallo actual**. El `revalidatePath` agregado en `39ceff9` no produjo GREEN en Preview.

**Importante: causa raíz todavía no probada.** El log de tarea afirma que el HTTP 307 procede de caché RSC/cliente, pero esa causalidad no se demostró comparando la guarda de middleware con el redirect de la página y el estado del router.

### Siguiente evidencia necesaria

Sin modificar aserciones ni permisos:
1. Instrumentar de forma local/temporal el mismo E2E para registrar **solo** status y ruta de `Location` (sin query personal, tokens ni cookies) en respuestas de `/merchant/dashboard` y `/merchant/onboarding`, clasificando navegación documento vs fetch/RSC;
2. Verificar con **el mismo contexto autenticado del navegador** una solicitud GET a `/merchant/dashboard` **sin seguir redirects** después del UPDATE y comparar con lo que hizo `router.push`;
3. Distinguir por evidencia si el 307 lo produce `updateSession/evaluateRouteGuard`, `MerchantDashboardPage` o una navegación cliente `router.push` seguida de `router.refresh`. No asumir que `revalidatePath` corrige las tres variantes;
4. Si una navegación de documento llega al panel pero el soft navigation no, analizar la secuencia `router.push`/`router.refresh`; si ambas redirigen, inspeccionar la lectura de `business_name` por cliente autenticado en middleware/dashboard. Todo sin exponer datos personales;
5. Con causa aislada, corregir lo mínimo dentro de archivos permitidos; si requiere `onboarding-form.tsx`, `guards.ts`, `server.ts` u otro archivo no permitido, **frenar y solicitar ampliación de alcance a Lautaro073**.

Un `page.goto` artificial en el spec **no** reemplaza la prueba del flujo real desde el botón. No `skip`, retries adicionales, cambios de expected URL ni bypass de Auth/RLS.

No iniciar RED de H04 hasta tener baseline completo GREEN. La vieja mutación D02-A mediante push/Preview queda desplazada por la regla de T-347; `e2e-mutation` admite únicamente código **mergeado** de `develop`, sin target PR ni patch ad hoc.

## H10 — abierto: body de PR con información obsoleta

El body sigue:
- presentando la migration y el pgTAP como cambios propios de esta PR, aunque ahora pertenecen a T-348;
- citando el CI `37667679330` y E2E histórico `37575010421` en vez del HEAD real;
- afirmando que el único problema del E2E era la incompatibilidad RLS/UPSERT ya resuelta, sin reconocer que la navegación continúa roja;
- diciendo que la migration se aplicará solo al merge de #251, cuando **ya** fue aplicada al merge de #302.

Además la bitácora diagnostica categóricamente caché como causa del 307 sin una prueba que distinga origen del redirect.

Corregir el body y calificar esa hipótesis; el cierre definitivo del DoD y del checklist RED deberá esperar la evidencia real.

## H11 — continúa cerrado

La action usa UPDATE autenticado sobre `profile_id = user.id`, selecciona una fila y falla cerrado si error/cero filas; no muta `subscription_status` ni `paid_until`. La migration que libera `notes` y pgTAP de INSERT self ya están en develop mediante T-348. Unit + db-tests están GREEN. La navegación pendiente es H04, no un nuevo fallo de persistencia H11.

## P3

La solicitud antigua `5999858656` es solo solicitud; las reviews vigentes registran `coderabbitai` COMMENTED y `Lautaro073` APPROVED, **sin visto bueno explícito de P3** sobre la versión final del spec.

## Fuera de alcance o falsos positivos

- Los runs `.github/workflows/e2e-mutation.yml` que aparecen como `failure` en push no prueban una mutación de T-313; T-347 solo admite `repository_dispatch` con `target=develop`.
- La migración RLS no está pendiente en #251: el merge de #302 y `migrate-develop` ya la aplicaron.
- Otros `e2e-preview` de otras PR no sustituyen el run que hizo checkout de `39ceff9`.

## Veredicto

**CON BLOQUEANTES (2): H04 y H10; P3 pendiente.** No apruebo ni mergeo. No se registran hallazgos nuevos ni se modifica código de producto.
