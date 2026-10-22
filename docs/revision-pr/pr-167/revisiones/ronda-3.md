# Ronda 3 — PR #167 / T-322

**Fecha:** 2026-10-01  
**SHA funcional:** `490979e74286aad3a287a958902a21abfd03bf08`  
**Base develop:** `76d71d67f5e2b7c026f2abe20f9d05a337d1bb51`  
**Resultado:** **CON BLOQUEANTE (1 · decisión P1)**

## Sincronización y CI

La rama está sincronizada con el `develop` que contiene PR #168 y no está detrás.

CI exact-head `36923370905`:

```text
typecheck       success
lint            success
unit            success — 110 files / 1581 tests
build           success
bundle-budget   success
audit           success
db-tests        success — 13 files / 1614 tests
```

## Revalidación de hallazgos anteriores

### PR167-H01 — arreglado-verificado
`displayName` y `phone` continúan obligatorios en Zod; `actions.test.ts` conserva la batería omitido/vacío/whitespace. 55/55 tests de auth actions verdes.

### PR167-H02 — arreglado-verificado
El handler de confirmación conserva la distinción onboarding incompleto/completo. `auth/confirm/route.test.ts`: 27/27 verde, incluidos merchant/courier × code/token_hash.

### PR167-H03 — arreglado-verificado
El copy sigue siendo condicional y la prueba anti-enumeración mantiene igualdad observable. 4/4 verdes.

### PR167-H04 — arreglado-verificado
El control contra fallbacks temporales permanece sensible y `components.test.tsx` está verde (23/23).

### PR167-R01 — arreglado-verificado
La corrección legal quedó alineada con la decisión P1:
- Privacy `version: '1.1'`;
- `effectiveDate: '2026-10-01'`;
- texto de registro declara nombre/displayName y teléfono obligatorios;
- `legal-red.test.ts` exige Privacy 1.0 no vigente y 1.1 vigente;
- no hay migración ni modificación de filas históricas de `consents`.

Pruebas exact-head:
- legal: 11/11;
- auth actions: 55/55;
- route-integrity: 53/53;
- courier onboarding actions: 10/10.

## PR167-A01 — 🔵 DECISIÓN P1 — la rama se autoamplió fuera de la ficha vigente

**Archivo tocado:** `src/features/courier-onboarding/actions.test.ts`  
**Archivo donde se autoautoriza:** `docs/tasks/T-322.md` en la rama  
**Patrón:** P10-desvio-de-ficha-sin-consultar

La ficha que debe usarse para revisar es la de `develop`. Esa ficha, ya con PR #168 mergeada, autoriza:
- componentes concretos de courier onboarding;
- `components.test.tsx`;
- los dos archivos legales;
- pero **no** `src/features/courier-onboarding/actions.test.ts`.

Después de sincronizar #168, agy:
1. modificó `src/features/courier-onboarding/actions.test.ts`;
2. agregó ese mismo archivo a “Archivos permitidos” dentro de la rama;
3. agregó a la ficha y a la bitácora la afirmación de que “Lautaro073 autoriza” esa ampliación.

Una rama no puede ampliar retroactivamente su propia autoridad de alcance. Aunque el cambio de fixture a Privacy 1.1 es técnicamente razonable y CI demuestra que funciona, el alcance debe quedar autorizado primero en `develop`.

### Decisión requerida

**A — recomendada:** formalizar una ampliación mínima adicional de T-322 en `develop` que autorice exclusivamente `src/features/courier-onboarding/actions.test.ts` para sincronizar fixtures de Privacy 1.1; luego mergear develop a #167 y revalidar.

**B:** no autorizarlo; agy debe revertir el cambio de ese archivo y la autoampliación de la ficha. Esto deja que resolver de otra forma la suite afectada por Privacy 1.1.

No se debe mergear #167 hasta resolver A/B.

## Mejora no bloqueante

El cuerpo de #167 sigue mostrando el DoD y cifras de pruebas anteriores a Privacy 1.1. Después de la decisión, actualizar body con el DoD actual y CI `36923370905`.

## Residual

La evidencia manual en staging sigue siendo posterior al merge/promoción y no se considera satisfecha todavía.
