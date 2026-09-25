# Ronda 8 — PR #87 (T-118) — cierre independiente final

- **SHA de implementación revisado:** `c33d50b230c47d5492b1e33683a60e1a8b1b8084`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-25
- **Desde R7:** 4 commits por encima de `0d5b727`; 8 archivos de implementación/pruebas/bitácora; `docs/revision-pr/pr-87/**` intacto por el agy.
- **PR:** mergeable.
- **Resultado:** **SIN BLOQUEANTES**.
- **Decisiones pendientes:** 0.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-25 — generado por revisión independiente
Resultado: SIN BLOQUEANTES
Checks locales: no ejecutados por este revisor · CI exact-head: typecheck ✅ · lint ✅ · test/coverage ✅ (49/49 archivos, 505/505 tests) · test:db ✅ · build ✅ (33/33) · bundle merchant/courier <=180 kB ✅ · approval-policy ✅
BLOQUEANTES:
- ninguno
MEJORAS:
- Deuda advisory existente: Prettier global aún reporta 48 archivos, pnpm audit 2 vulnerabilidades moderadas y /design-system queda en 184 kB. No pertenecen al cierre funcional de T-118.
No revisado / dudas para Lautaro073:
- ninguna.
~~~

## PR87-R05 — cerrado

`VehicleForm` ya no mantiene una regex propia. Importa:

~~~ts
import { ARGENTINA_PLATE_REGEX } from '../schemas';
~~~

y usa esa misma fuente para `isPlateValid`.

La regresión colocalizada compara el comportamiento visible del formulario con `vehiclePlateSchema.safeParse()`:

~~~text
AB 123 CD -> válido
A 123 BCD -> válido
ABC 123   -> válido
123 ABC   -> inválido
~~~

No queda el defecto de R7 donde cliente y servidor tomaban decisiones opuestas.

CI exact-head:

~~~text
src/features/courier-onboarding/components.test.tsx (15 tests) PASS
~~~

## PR87-R06 — cerrado

Los tres flujos separan resultado funcional de feedback:

### AvailabilitySwitch

~~~text
await setAvailabilityAction(...)
-> si falla: rollback primero
-> si funciona: callback/estado primero
-> notify dinámico después, con .catch(() => {})
~~~

### MyOffersList

~~~text
await withdrawOfferAction(...)
-> si funciona: setOffers(... withdrawn) primero
-> notify best-effort después
-> diálogo se cierra independientemente del toast
~~~

### OfferSheet

~~~text
await submitOfferAction(...)
-> resultado funcional se resuelve dentro del try
-> setIsSubmitting(false) + onClose() primero
-> notify success best-effort después
~~~

Las pruebas mockean `@/ui/notify` para que falle su carga y verifican comportamiento observable:

~~~text
availability-switch.test.tsx 2/2 PASS
notify-resilience.test.tsx    2/2 PASS
~~~

Por tanto un fallo del chunk de notificaciones ya no modifica rollback, estado local ni convierte un éxito en falso error.

## PR87-H21 — cerrado

El body real de PR #87 está actualizado al SHA de implementación `c33d50b230c47d5492b1e33683a60e1a8b1b8084` y contiene la evidencia actual:

~~~text
49/49 archivos
505/505 tests
21/21 workflows
6/6 ADR
33/33 páginas
~~~

También documenta R05/R06 y deja explícita la espera de revalidación independiente.

`approval-policy` exact-head terminó `success` y reportó:

~~~text
Informe de revisar-pr completo y sin bloqueantes.
~~~

El commit de esta R8 sólo modifica `docs/revision-pr/pr-87/**`; no altera la implementación verificada en `c33d50b230c47d5492b1e33683a60e1a8b1b8084`.

## CI exact-head

CI run `36105913564`:

~~~text
typecheck     success
db-tests      success — Result: PASS
lint          success
audit         success — 2 moderate advisory
unit          success — 49/49 archivos, 505/505 tests
build         success — 33/33 páginas
bundle-budget success
~~~

Approval-policy exact-head:
- run `36106219706`: success.

## Bundle final

Todas las rutas de comercio/repartidor cumplen el presupuesto de Regla 25:

~~~text
/courier/feed                 179 kB
/courier/offers               179 kB
/courier/onboarding/identity  168 kB
/courier/onboarding/status    168 kB
/courier/onboarding/vehicle   168 kB
/courier/profile              168 kB
/merchant/dashboard           164 kB
/merchant/history             164 kB
/merchant/onboarding          130 kB
/merchant/plan                156 kB
/merchant/requests/[id]       164 kB
/merchant/requests/new        164 kB
~~~

`/design-system` sigue en 184 kB; no es ruta merchant/courier y permanece como deuda separada.

## Conclusión

R05, R06 y H21 quedan `arreglado-verificado` en `c33d50b230c47d5492b1e33683a60e1a8b1b8084`. No quedan hallazgos bloqueantes abiertos ni decisiones pendientes en PR #87 / T-118.
