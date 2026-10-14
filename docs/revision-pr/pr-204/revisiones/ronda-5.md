# Ronda 5 — PR #204 / T-305

**Fecha:** 2026-10-03  
**SHA revisado:** `39aa7f642a106dfa50c243f88137ffd712847ff0`  
**Resultado:** **CON BLOQUEANTES (1)**

## Lo que ya quedó demostrado

### E2E real de T-305

Run confiable: `37147634593` / job `111274792156`.

El workflow de T-331 ejecutó:

```text
pnpm exec playwright test --project=chromium --workers=1
Running 24 tests using 1 worker
```

y mostró explícitamente:

```text
authorization.spec.ts — pending fuerza submit_offer → PASS
authorization.spec.ts — suspendido retira pending → PASS
authorization.spec.ts — merchant/courier redirigidos → PASS
authorization.spec.ts — sensibilidad de guarda → PASS
```

Los cuatro casos T-305 quedaron GREEN. Con esto:
- H01 queda verificado en runtime;
- H03 queda verificado en runtime;
- H04 queda verificado en runtime;
- H06 queda verificado en runtime;
- el residual histórico de 3-A queda satisfecho pre-merge;
- `Closes #37` es correcto **si la validación sigue verde tras sincronizar la base actual**.

### H05

El body sigue estructuralmente correcto y no se reabre.

## CI del SHA actual

Run `37147513421`:
- typecheck ✅
- lint ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- unit ❌ por un único fallo de `tools/verify-fichas.test.ts`: T-333 desincronizada con el plan
- audit ❌ por el advisory de `braces`.

Ambos rojos son de baseline y no de T-305. Importante: entre los 5 commits nuevos de `develop` están justamente:
- T-333, que corrige la desincronización de ficha/plan;
- T-332, que corrige el tratamiento del advisory de audit.

Por eso el CI actual no debe “arreglarse” desde T-305; se resuelve integrando la base nueva.

## BLOQUEANTE

### PR204-H07 — falta integrar los 5 commits actuales de develop, incluido T-334

**Severidad:** alto · **Categoría:** correctness/integración

Estado observado:

```text
develop = 3e5d5381dbf59717763f1927e1cf080504a9ebf1
head    = 39aa7f642a106dfa50c243f88137ffd712847ff0
ahead   = 24
behind  = 5
mergeable = true
```

Los cinco commits nuevos son:
- T-333: cierre de carreras Realtime / ficha-plan;
- T-332: excepción de audit;
- T-325;
- registro T-334;
- T-334: onboarding incompleto.

T-334 modifica:
- `src/features/auth/guards.ts`;
- `src/features/auth/actions.ts`;
- `src/features/auth/server.ts`;
- login.

Eso intersecta directamente el DoD 3 de T-305.

La inspección del seed reduce el riesgo: los usuarios E2E de T-305 ya nacen con:
- merchant: `business_name` no vacío;
- courier: `vehicle_type: 'moto'`;

por lo que T-334 debería considerarlos onboarding-complete. Además, las sesiones directas del test omiten `onboardingComplete`, que T-334 trata como estado desconocido y no redirige al onboarding.

Aun así, la única evidencia válida final debe ser un run **después** de integrar T-334.

## Qué debe pasar

1. `git fetch origin && git merge --no-edit origin/develop`.
2. Resolver cualquier conflicto sin reintroducir cambios propios en `.github/workflows/e2e-preview.yml`.
3. Mantener `authorization.spec.ts` sin adulterar asserts.
4. Ejecutar/pushear.
5. Confirmar CI exact-head:
   - unit GREEN;
   - audit según política T-332;
   - typecheck/lint/build/db GREEN.
6. Confirmar e2e-preview exact-head con los **4 tests T-305 GREEN**.

Si eso ocurre y no aparece un defecto nuevo, la siguiente ronda puede declarar **SIN BLOQUEANTES**.

## Resultado

**CON BLOQUEANTES (1).** No hay decisiones nuevas. El código de T-305 ya demostró su DoD en remoto; falta únicamente revalidarlo sobre las nuevas guardas T-334 y el baseline actualizado.
