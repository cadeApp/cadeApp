# Informe de revisión — PR #240 / T-334

**PR:** https://github.com/cadeApp/cadeApp/pull/240  
**Head SHA revisado:** `5c31ed86db8cacd923367deaa190c5880e0b60e5`  
**Base:** `develop` @ `b4119ef3e16170decda0a1649fc35db207faa8b0`  
**Fecha:** 2026-10-03  
**Revisión:** independiente, posterior a la implementación de agy

## Resultado

**CON BLOQUEANTES (3).** Dos son técnicos y uno es la verificación manual exigida por el DoD.

Las decisiones detectadas durante la ronda quedaron resueltas por Lautaro073:

- **D01 = 1-A:** hacer que `vehicle_type` sea un marcador confiable moviendo su escritura al final de `courierOnboardingAction`.
- **D02 = 2-A:** mantener fail-open de navegación si la lectura del marcador falla/desconoce el estado.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | 🔴 alto | `src/features/auth/guards.ts:92` | La excepción de perfil usa coincidencia por prefijo y deja entrar a `/courier/profile/notifications` | correctness |
| H02 | 🔴 alto | `src/features/courier-onboarding/actions.ts:105-201` | `vehicle_type` se persiste antes de consentimientos/documentos; una falla posterior deja un falso “completo” | correctness |
| H03 | 🟠 medio | `docs/tasks/log/T-334.md` | El DoD exige prueba manual con dos cuentas nuevas y la bitácora la declara pendiente | evidence |

## 1. 🔴 H01 — La excepción de `/courier/profile` abre más rutas que la autorizada

**Archivo:** `src/features/auth/guards.ts:85-95`  
**Estado:** [ANÁLISIS VERIFICADO CONTRA ÁRBOL]

### Diagnóstico

La ficha y la decisión de implementación exceptúan **solo** `/courier/profile` para que un repartidor incompleto pueda ver “Completá tu registro” y cerrar sesión.

El helper actual hace:

```ts
matchesSegment(pathname, '/courier/profile')
```

`matchesSegment` también acepta descendientes. En el árbol real existe:

```
src/app/(courier)/courier/profile/notifications/page.tsx
```

Por lo tanto un repartidor con `onboardingComplete === false` puede abrir `/courier/profile/notifications` sin ser enviado a `/courier/onboarding/identity`.

### Arreglo exacto

En `isAllowedWhileOnboardingIncomplete`, conservar la excepción por prefijo para `/courier/onboarding/*`, pero hacer **exacta** la del perfil:

```ts
matchesSegment(pathname, '/courier/onboarding') || pathname === '/courier/profile'
```

No agregar `/courier/profile/notifications` a las excepciones.

### Test y mutación

Agregar en `guards.test.ts`:

```ts
expect(followGuard('/courier/profile/notifications', baseSession('courier', false)))
  .toBe('/courier/onboarding/identity');
```

RED de mutación obligatorio: volver temporalmente a `matchesSegment(pathname, '/courier/profile')`; este test tiene que fallar.

## 2. 🔴 H02 — El marcador se escribe antes de que el onboarding termine

**Archivo:** `src/features/courier-onboarding/actions.ts:105-201`  
**Estado:** [ANÁLISIS VERIFICADO CONTRA ÁRBOL]

### Diagnóstico

T-334 considera completo al repartidor cuando `couriers.vehicle_type is not null`. Sin embargo, la action actual:

1. actualiza `dni_hmac`, `vehicle_type` y patente;
2. después persiste consentimientos;
3. después persiste `courier_documents`;
4. cualquiera de los pasos 2/3 puede devolver `INTERNAL_ERROR`.

No hay una transacción que revierta el update del paso 1. Si falla consentimientos o documentos, la acción responde error pero `vehicle_type` ya quedó no nulo; el próximo request pasa el guard como onboarding completo.

Esto contradice el significado que T-334 asigna a la columna. La ficha original decía explícitamente que la definición debía confirmarse contra las actions y, si no alcanzaba, frenar y consultar.

### Decisión aplicada

Lautaro073 eligió **1-A**. La ficha queda ampliada para permitir:

- `src/features/courier-onboarding/actions.ts`
- `src/features/courier-onboarding/actions.test.ts`

### Arreglo exacto

Mover el update de `couriers` que escribe `dni_hmac`, `vehicle_type` y `vehicle_plate` **después** de que:

- el upsert de consentimientos terminó sin error;
- el upsert de documentos terminó sin error.

Debe quedar inmediatamente antes del `return ok(...)`.

No cambiar payload, HMAC, políticas, schemas, migraciones ni contratos.

### Tests exactos

Agregar dos casos a `src/features/courier-onboarding/actions.test.ts`:

1. **falla consentimientos:** mockear el upsert de `consents` con error; esperar `INTERNAL_ERROR` y `mockAdminUpdate.not.toHaveBeenCalled()`.
2. **falla documentos:** consentimientos OK, `courier_documents.upsert` devuelve error; esperar `INTERNAL_ERROR` y `mockAdminUpdate.not.toHaveBeenCalled()`.

El caso feliz existente debe seguir afirmando que el update final escribe exactamente `dni_hmac`, `vehicle_type` y `vehicle_plate`.

RED de mutación obligatorio: mover temporalmente el update de courier otra vez antes de consentimientos; al menos los nuevos casos deben ponerse rojos.

## 3. 🟠 H03 — Falta la verificación manual exigida por la ficha

**Archivo:** `docs/tasks/log/T-334.md`  
**Estado:** [VERIFICADO POR EVIDENCIA DEL PR]

La bitácora y el cuerpo del PR dicen que falta verificar en Develop/Preview con:

- un comercio recién registrado que no completó onboarding;
- un repartidor recién registrado que no completó onboarding.

No debe inventarse ni simularse esa evidencia. La hace Lautaro073 con credenciales ingresadas manualmente, después de que H01/H02 estén corregidos.

## D02 — Fail-open de navegación cuando el marcador no puede leerse

Lautaro073 eligió **2-A**. El comportamiento actual de `server.ts` es correcto para esa decisión: con error de lectura deja `onboardingComplete` sin definir.

Falta fijarlo con tests para que no cambie accidentalmente:

- `server.test.ts`: lectura de `merchants`/ `couriers` devuelve error → no redirigir a onboarding por ese motivo.
- `actions.test.ts`: la lectura de onboarding devuelve error → `loginAction` conserva el destino normal del rol.

Mutación: tratar el error como `onboardingComplete = false`; ambos controles deben ponerse rojos.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `login-form.tsx` no recibe `onboardingComplete` | Recalcula un destino sin el dato, pero el siguiente request pasa por middleware y se corrige. Es un hop extra, no un bypass persistente. |
| `auth/confirm/route.ts` usa criterios históricos distintos | Comercio escribe `business_name` y `default_pickup_address` en el mismo upsert; courier escribe `dni_hmac` y `vehicle_type` en el mismo update. Tras H02, la señal de courier queda al final. No hace falta ampliar esta PR a ese archivo. |
| Service role en el guard | `updateSession` y `loginAction` leen el marcador con cliente del usuario; la RLS vigente tiene `merchants_select_self` / `couriers_select_self`. |
| CC-007 perdió precedencia | El gate de `consent_status` sigue antes del onboarding y el servidor solo consulta el marcador con consentimiento activo. |

## Checks observados en el SHA revisado

No se ejecutó un checkout local desde esta sesión de revisión. Se verificó ejecución independiente en GitHub Actions sobre el SHA exacto `5c31ed86db8cacd923367deaa190c5880e0b60e5`:

- workflow CI run **#1069 / 37157587796**: SUCCESS;
- `typecheck` ✅;
- `lint` ✅;
- `unit / pnpm test:coverage` ✅;
- `db-tests` ✅;
- `build` ✅;
- `bundle-budget` ✅;
- status `e2e-preview` ✅;
- Vercel Preview ✅.

Estos verdes no cubren H01/H02 porque no existe el caso de `/courier/profile/notifications` ni una prueba que falle después de haber escrito prematuramente `vehicle_type`.

## Checklist para Ronda 2

- [ ] H01: perfil exacto, descendiente notifications redirige.
- [ ] H01: mutación de igualdad → prefijo produce RED.
- [ ] H02: update marcador después de consentimientos y documentos.
- [ ] H02: fallos de consentimientos/documentos no llaman al update del courier.
- [ ] H02: mutación que adelanta el update produce RED.
- [ ] D02: tests explícitos de fail-open + mutación RED.
- [ ] Focales verdes.
- [ ] typecheck/lint/test verdes o diagnóstico reproducible.
- [ ] bitácora actualizada sin afirmar evidencia manual inexistente.
- [ ] Lautaro073 completa la verificación manual.
