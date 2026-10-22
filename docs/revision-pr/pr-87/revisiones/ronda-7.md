# Ronda 7 — PR #87 (T-118) — revisión post-mejoras

- **SHA revisado:** `25fa07856ac92bfcb8999ce213c71f688290e6c9`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-25
- **Desde R6:** 1 commit de implementación después de `a3a2fe9`; `docs/revision-pr/pr-87/**` intacto.
- **GitHub:** PR mergeable.
- **CI exact-head:** verde en los 7 jobs.
- **Resultado:** **CON BLOQUEANTES (3)**.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-25 — generado por revisión independiente
Resultado: CON BLOQUEANTES (3)
Checks locales: no ejecutables en este runtime · CI exact-head: typecheck ✅ · lint ✅ · test:coverage ✅ (47/47, 497/497) · test:db ✅ · build ✅ · bundle-budget ✅ (rutas merchant/courier <=180 kB) · approval-policy ✅
BLOQUEANTES:
- [vehicle-form.tsx:27-28,80 vs schemas.ts:11-17,60] PR87-R05: la regex local de patente no coincide con el schema fuente de verdad. 'A 123 BCD' es válida en servidor y rechazada por UI; '123 ABC' es aceptada por UI y rechazada por servidor.
- [availability-switch.tsx:28-40; my-offers-list.tsx:44-57; offer-sheet.tsx:84-108] PR87-R06: import('@/ui/notify') participa del mismo flujo awaited de mutaciones; si falla el chunk puede impedir rollback/actualización o convertir un éxito real en un error visible.
- [PR body] PR87-H21: Evidencia de checks/reporte quedó en 43/443/31 páginas, pero el head actual ejecuta 47/497/33 y contiene un commit semántico posterior.
MEJORAS:
- courier-onboarding/index.ts usa dynamic(...,{ssr:false}) para IdentityForm/VehicleForm sin loading propio: agregar Skeleton/fallback o justificar el flash vacío en red lenta.
- upload-manager.ts volvió a declarar COURIER_DOCUMENT_KINDS localmente; hoy coincide con domain y satisface el tipo, pero no garantiza exhaustividad futura. Evitar que derive en otro contrato duplicado.
No revisado / dudas para Lautaro073:
- ninguna decisión pendiente. A03 registra como autorizadas las mejoras post-R6 que vos pediste.
~~~

## Qué sí quedó bien

### Performance

El budget de Regla 25 se cumple para todas las rutas canónicas de comercio/repartidor:

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

`/design-system` queda en 184 kB, pero no es ruta merchant/courier y el presupuesto de Regla 25 está definido para esas familias.

### Formato

Prettier bajó de 89 a 48 warnings globales. Los restantes pertenecen a deuda fuera del commit post-R6; no se abre un blocker de T-118 por ellos.

### Audit

Sigue en 2 vulnerabilidades `moderate`, sin cambio de dependencias. Se mantiene como deuda separada; no se forzó un major de Vitest dentro de T-118.

### CI

CI run `36102363779` en `25fa07856ac92bfcb8999ce213c71f688290e6c9`:
- build ✅ (33/33);
- unit/coverage ✅ (47/47 archivos, 497/497 tests);
- lint ✅;
- typecheck ✅;
- db-tests ✅ (PASS);
- audit ✅ advisory;
- bundle-budget ✅ advisory.

Approval policy run `36102361748`: success. Su verde no cierra H21 porque el script sólo verifica estructura del texto y no trazabilidad del informe al head.

## PR87-R05 — prueba independiente

Regex de `schemas.ts`:

~~~regex
/^(?:[A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]\s?\d{3}\s?[A-Z]{3}|[A-Z]{3}\s?\d{3})$/i
~~~

Regex copiada en `VehicleForm`:

~~~regex
/^(?:[A-Z]{3}\s?\d{3}|[A-Z]{2}\s?\d{3}\s?[A-Z]{2}|\d{3}\s?[A-Z]{3})$/i
~~~

Probe JS:

~~~text
AB 123 CD  schema=true  UI=true
A 123 BCD  schema=true  UI=false
ABC 123    schema=true  UI=true
123 ABC    schema=false UI=true
~~~

No es una diferencia cosmética: el formulario y la Server Action pueden decidir cosas opuestas.

## PR87-R06 — fallo de feedback no puede decidir la mutación

Los tres cambios de performance convierten un módulo accesorio en parte del resultado de negocio:

1. Availability: `Promise.all([setAvailabilityAction(), import(notify)])`.
2. Withdraw: `Promise.all([withdrawOfferAction(), import(notify)])`.
3. Submit offer: la action puede terminar bien y luego `await import(notify)` lanzar al mismo `catch`.

El orden correcto es:
- esperar/procesar ActionResult;
- hacer rollback o actualizar/cerrar UI según ese resultado;
- recién después emitir toast como best-effort; si el módulo de toast falla, no debe cambiar el estado del negocio ni mostrar falso fallo.

## PR87-H21 — evidencia actual

Body todavía dice:

~~~text
Test Files 43 passed
Tests 443 passed
Generating static pages (31/31)
~~~

CI de este head dice:

~~~text
Test Files 47 passed
Tests 497 passed
Generating static pages (33/33)
~~~

Actualizar al final, no ahora a un head que todavía tiene R05/R06.
