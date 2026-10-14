# Informe de revisión — PR #240 / T-334 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/240  
**SHA revisado:** `94cf3db9635833b3ef1c8723717908c11fac1bff`  
**Base:** `develop` @ `b4119ef3e16170decda0a1649fc35db207faa8b0`  
**Fecha:** 2026-10-03  
**Resultado:** **H01 y H02 CERRADOS. H03 sigue abierta por verificación manual.**

## Alcance de la ronda

Se revisó exclusivamente el commit posterior a Ronda 1:

```
dee1f2b20d6cf823c608c6b30399fbc5efbb96cf
  ↓
94cf3db9635833b3ef1c8723717908c11fac1bff
```

El commit modifica 7 archivos, todos autorizados por la ficha ampliada:

- `docs/tasks/log/T-334.md`
- `src/features/auth/actions.test.ts`
- `src/features/auth/guards.test.ts`
- `src/features/auth/guards.ts`
- `src/features/auth/server.test.ts`
- `src/features/courier-onboarding/actions.test.ts`
- `src/features/courier-onboarding/actions.ts`

No tocó la carpeta de revisión.

## H01 — CERRADO ✅

**Problema anterior:** `matchesSegment('/courier/profile')` exceptuaba también `/courier/profile/notifications`.

**Corrección verificada:**

```ts
return (
  matchesSegment(pathname, '/courier/onboarding') ||
  pathname === '/courier/profile'
);
```

El test nuevo conserva `/courier/profile` exacto y exige que `/courier/profile/notifications` termine en `/courier/onboarding/identity`.

### Evidencia

- Diff exacto: matcher por prefijo → igualdad exacta.
- Unit CI del SHA: GREEN.
- Bitácora registra RED en el código anterior y RED por mutación igualdad→prefijo.
- Harness independiente de revisión confirmó:
  - igualdad exacta: profile ✅, notifications bloqueada ✅;
  - mutación a matcher por prefijo: notifications queda indebidamente exenta.

**Estado:** cerrado en Ronda 2.

## H02 — CERRADO ✅

**Problema anterior:** `dni_hmac`/`vehicle_type`/`vehicle_plate` se escribían antes de consentimientos y documentos.

**Corrección verificada:** la secuencia actual es:

1. validar / autenticar / comprobar DNI;
2. upsert de `consents`;
3. upsert de `courier_documents`;
4. update final de `couriers` con `dni_hmac`, `vehicle_type`, `vehicle_plate`;
5. `return ok`.

Los dos fallos posteriores que antes podían dejar un falso “completo” ahora ocurren **antes** del marcador.

### Tests

Se agregaron controles distintos y no tautológicos:

- error en `consents` → `INTERNAL_ERROR` + `mockAdminUpdate` 0 llamadas;
- error en `courier_documents` → `INTERNAL_ERROR` + `mockAdminUpdate` 0 llamadas;
- el happy path histórico sigue verificando el payload exacto del update.

La política RLS `courier_documents_insert_self` no depende de `vehicle_type`; exige `courier_id = auth.uid()`, `status='submitted'`, `purge_after is null` y `purged_at is null`. Por lo tanto mover el update de courier al final no rompe la escritura de documentos con el cliente del usuario.

### Evidencia

- Diff muestra el bloque completo de update movido de antes de consentimientos a después de documentos.
- Unit CI del SHA: GREEN.
- Bitácora registra RED contra el orden anterior y RED por mutación que adelanta de nuevo el update.
- Harness independiente verificó el invariante de orden y que la mutación “marcador primero” lo viola.

**Estado:** cerrado en Ronda 2.

## D02 — contrato fijado ✅

Los tests nuevos cubren ambos roles:

- `updateSession`: error leyendo el marcador → HTTP 200, sin Location a onboarding;
- `loginAction`: error leyendo el marcador → destino normal del rol.

La implementación no se debilitó; solo se fijó el comportamiento elegido por Lautaro073. La mutación `error => onboardingComplete = false` pone esos controles en rojo según la evidencia de la bitácora.

## H03 — ABIERTO ⏳

La ficha sigue exigiendo verificación manual en Develop/Preview con cuentas nuevas:

### Comercio

1. registrar comercio nuevo;
2. no completar onboarding;
3. iniciar sesión / intentar ruta operativa;
4. debe terminar en `/merchant/onboarding`;
5. no debe quedar acceso útil al dashboard antes de completar.

### Repartidor

1. registrar repartidor nuevo;
2. no completar el envío del onboarding;
3. iniciar sesión / intentar feed u ofertas;
4. debe terminar en `/courier/onboarding/identity`;
5. `/courier/profile` exacto debe seguir accesible y mostrar “Completá tu registro”;
6. `/courier/profile/notifications` debe redirigir al onboarding.

No hay evidencia manual todavía y agy correctamente no la inventó.

Además, el deployment Vercel del SHA revisado falló por límite de cuenta (`api-deployments-free-per-day`), no por build. Por eso el Preview anterior **no sirve para certificar las correcciones de Ronda 2**.

## CI del SHA revisado

GitHub Actions run **#1073 / 37159108997**: **SUCCESS**.

| Job | Estado |
|---|---|
| build | ✅ |
| lint | ✅ |
| unit / `pnpm test:coverage` | ✅ |
| typecheck | ✅ |
| db-tests | ✅ |
| audit | ✅ |
| bundle-budget | ✅ |

Vercel: ❌ deployment rechazado por límite diario, no por error de código/build.

## Falla local de `pnpm test` — no bloquea T-334

Se verificó la causa indicada por agy: `src/server/rpc/cc007.test.ts` escribe versiones mutadas de `guards.ts` y `queries.ts` al filesystem compartido y lanza Vitest anidado. En una suite paralela, otro worker puede importar esos archivos durante la ventana mutada.

Es un problema real de infraestructura preexistente. Se abrió **#243**. No se modifica dentro de T-334.

## Decisión de Ronda 2

No hay nuevos hallazgos de código en T-334.

**Estado de la PR: BLOQUEADA SOLO POR H03 MANUAL.**

No aprobar ni mergear hasta registrar esa evidencia y hacer la ronda final.
