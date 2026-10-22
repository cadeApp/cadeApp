# Informe de revisión — PR #240 / T-334 — Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/240  
**Hallazgo manual:** captura y prueba aportadas por Lautaro073  
**SHA corregido:** `4bf9cfacf20aabd9b217eb8681febb0c04e96153`  
**Fecha:** 2026-10-03  
**Resultado:** **H04 corregido y CI verde. H03 sigue abierta hasta retest manual courier.**

## H04 — Courier incompleto alcanza una pantalla que presupone onboarding enviado

### Evidencia manual

Lautaro073 probó un repartidor incompleto en localhost y observó:

- pantalla “En revisión manual / Estamos revisando tus datos”;
- DNI frente/dorso, selfie y avatar figuraban “Pendiente”;
- “Vehículo y consentimientos” figuraba “Listo”;
- botón “Ir al panel de repartidor” no producía un avance útil.

La pantalla observada corresponde a `StatusView`. Su botón siempre intenta:

```ts
router.push('/courier/feed');
```

y su copy presupone que el registro ya fue enviado.

### Causa raíz

El guard de T-334 tenía esta excepción:

```ts
matchesSegment(pathname, '/courier/onboarding')
```

Eso dejaba abiertas **identity, vehicle y status** para un courier con `onboardingComplete === false`.

La propia suite de R1 había codificado esa suposición y esperaba que `/courier/onboarding/status` quedara accesible. La prueba manual demostró que ese contrato era incorrecto.

### Decisión de producto D03

Definida por Lautaro073 durante la prueba manual:

- `identity` y `vehicle` son etapas de edición/completado y siguen accesibles;
- `status` significa “registro enviado / en revisión” y solo tiene sentido después de que `vehicle_type` marque onboarding completo;
- un courier incompleto que intente `status` debe volver a `/courier/onboarding/identity`.

## Arreglo mínimo aplicado por revisión

No se modificó la pantalla de estado. Se restringió la excepción del guard:

```ts
pathname === '/courier/onboarding/identity' ||
pathname === '/courier/onboarding/vehicle' ||
pathname === '/courier/profile'
```

Así, con `onboardingComplete === false`:

- `/courier/onboarding/identity` → allow;
- `/courier/onboarding/vehicle` → allow;
- `/courier/onboarding/status` → `/courier/onboarding/identity`;
- alias `/onboarding/status` → status → identity;
- `/courier/profile` → allow;
- rutas operativas → identity.

Con onboarding completo, `/courier/onboarding/status` sigue accesible.

## RED y control

El RED real de esta ronda es la prueba manual: el usuario incompleto alcanzó la pantalla “En revisión manual”.

El test automatizado quedó ajustado para ejercer exactamente esa propiedad. El código previo con la excepción por prefijo no satisface:

```ts
expect(followGuard('/courier/onboarding/status', incompleteCourier))
  .toBe('/courier/onboarding/identity');
```

La regresión equivalente (volver a `matchesSegment('/courier/onboarding')`) deja status permitido y rompe el control.

## CI del SHA corregido

GitHub Actions **#1075 / 37160178864 — SUCCESS**:

| Job | Estado |
|---|---|
| unit / test:coverage | ✅ |
| build | ✅ |
| typecheck | ✅ |
| lint | ✅ |
| db-tests | ✅ |
| audit | ✅ |
| bundle-budget | ✅ |

Vercel sigue limitado por cuota diaria; no se usa como evidencia de esta ronda.

## H03 — estado manual

- Comercio incompleto: **PASS informado por Lautaro073**.
- Courier incompleto: la ejecución anterior dio **FAIL y originó H04**.
- Falta repetir courier sobre `4bf9cfacf20aabd9b217eb8681febb0c04e96153` o posterior.

No aprobar ni mergear hasta ese retest.
