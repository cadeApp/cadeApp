# Ronda 2 — PR #588 · T-421 · 2026-11-04

**Informe revisar-pr — revisión independiente (ChatGPT).**

**Resultado: SIN BLOQUEANTES DE CÓDIGO (0).** Los tres hallazgos de ronda 1 quedan cerrados sobre el SHA solicitado `22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc`. La comparación `f3c43113a817523571796849135e9969a0889c7b` → `22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc` solo muestra `docs/tasks/log/T-421.md`, por lo que el código ejecutado en CI es el mismo. **No se aprueba ni mergea** con este informe.

## Cambios y alcance

Comparación con el commit de la revisión anterior `3393d51`: dos commits, seis archivos: `src/app/auth/confirm/route.ts`, `route.test.ts`, `supabase/tests/cc016_request_offer_couriers.sql`, `supabase/tests/cc043_courier_application.sql`, `docs/tasks/T-421.md` y `docs/tasks/log/T-421.md`. Ningún otro archivo, ni la carpeta de revisión, fue modificado por el autor. La ampliación de `cc016` es la **D02=C** autorizada en la ronda 1. GitHub informó `mergeable=true`; **no** se ejecutó `git merge-tree` local.

## Hallazgos de ronda 1

### PR588-H01 — ARREGLADO, verificado por inspección + CI unit (sin RED independiente local)

- `src/app/auth/confirm/route.ts:105-119` captura `courierError` y devuelve `undefined` en fallo de lectura, en lugar de equipararlo a no enviado. Solo `onboardingComplete === false` fuerza `/courier/onboarding/identity`.
- `src/features/auth/guards.ts:54-62`: `parseOnboardingComplete('courier', null)` es `false`; un booleano leído se conserva; dato desconocido es `undefined`. La distinción del guard coincide con la ruta.
- `src/app/auth/confirm/route.test.ts:294-317`: nuevo test de vehículo sin envío, fallo de lectura y ausencia de fila. **El CI unit verificó 30/30 en ese archivo y 3508/3508 en la suite**, en el run [41867741655](https://github.com/cadeApp/cadeApp/actions/runs/41867741655). El autor declaró un RED local 1/30 en `docs/tasks/log/T-421.md`; **esta revisión no reprodujo el RED local en un clon** por falta de un repositorio clonable en el entorno. El cierre se sustenta en la inspección independiente del código y el test ejecutado por CI, no en una falsa reproducción propia.
- No se observa nueva regresión merchant ni cambio de sus rutas en esta comparación.

### PR588-H02 — ARREGLADO, verificado con RED/GREEN de CI

- `supabase/tests/cc043_courier_application.sql:83-94` agrega afirmación estructural que usa `pg_get_functiondef`, exige `from public.couriers ... where profile_id = p_courier_id ... for update;` dentro de la misma sentencia y compara las posiciones de las lecturas de `profiles` y `courier_documents`.
- La migración real conserva el lock en `supabase/migrations/20261104200000_cc043_courier_application.sql:71-76`.
- **GREEN de CI:** archivo `cc043` OK, **85/85** en run [41867741655](https://github.com/cadeApp/cadeApp/actions/runs/41867741655), suite total **42 archivos, 3396 PASS**.
- **RED comprobado:** la PR [#602](https://github.com/cadeApp/cadeApp/pull/602) cambió **solo** la sentencia de la migración para quitar `for update`, commit `444e94c9755b0a43585b165571038c74c98a4792`. El job `db-tests` del [run 41867747186](https://github.com/cadeApp/cadeApp/actions/runs/41867747186) terminó **FAIL**, `cc043: 84/85`, test **5**: «finalize bloquea couriers antes de profiles/documentos». La mutación fue cerrada **sin merge**.
- **Residual aceptado en D01/H02:** esto es un control estructural de lock, **no prueba dos sesiones reales**. La integración de concurrencia real se sigue en [#601](https://github.com/cadeApp/cadeApp/issues/601), fuera del alcance de este PR.

### PR588-H03 — ARREGLADO, verificado con RED/GREEN de CI

- `supabase/tests/cc016_request_offer_couriers.sql:81-101` inserta los cuatro documentos requeridos y ejecuta la RPC real `finalize_courier_application` bajo `service_role` con patente `ABC 123`; después aprueba. Ya **no** usa `set_config('app.courier_application_finalize',...)` como bypass.
- El `plan` pasa de 24 a **25**, conservando las 24 afirmaciones previas y sumando una que comprueba `application_submitted`, `submitted_at`, HMAC, tipo y patente.
- **GREEN:** `cc016` OK **25/25** en run [41867741655](https://github.com/cadeApp/cadeApp/actions/runs/41867741655).
- **RED comprobado:** la PR [#603](https://github.com/cadeApp/cadeApp/pull/603), commit `696bc2ee2062c9247eda8005cd31b8b21f17f3cb`, reemplazó **solo** la invocación real por el bypass de dueño. El [run 41867763829](https://github.com/cadeApp/cadeApp/actions/runs/41867763829) dio **FAIL**, `cc016: 24/25`, test **1**: «fixture: doc2 envió su postulación por finalize_courier_application». La mutación quedó cerrada **sin merge**.

## Checks y restricciones de la verificación

- **En CI del SHA de código `f3c43113`:** `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` y `db-tests`: todos **success**. Logs: `route.test.ts (30 tests)`; `Test Files 191 passed (191)`; `Tests 3508 passed (3508)`; `Files=42, Tests=3396, Result: PASS`; `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts`.
- **Sobre el SHA de bitácora `22d7d9c`:** el nuevo CI [41869418827](https://github.com/cadeApp/cadeApp/actions/runs/41869418827) presentó fallo en `build` con `src/app/layout.tsx`, `next/font` `TypeError: Cannot read properties of null (reading '1')`, dentro del loader de Google Fonts, mientras el build de `f3c43113` ya era verde. **No se atribuye causalidad al cambio solo documental** ni se afirma que esa corrida esté verde. Si GitHub exige checks verdes en el head para mergear, ese estado operativo necesita resolverse según el proceso habitual; no implica modificar H01–H03 sin prueba nueva.
- No hay clon local ni Docker/Supabase local en esta sesión; no se ejecutaron pruebas propias ni mutaciones propias de runtime. **Los RED SQL fueron originados por el autor pero auditados independientemente contra el diff mutado y los logs oficiales.**
- **E2E:** sigue sin prueba ejecutada premerge por **D01=A** (`BLOCKED / REQUIRES DEVELOP MIGRATION`). La aceptación obliga a completar E2E **después del merge y de `migrate-develop`** (CC-023); no etiquetar de verde antes.

## Decisiones y conclusión

- **D01=A**, **D02=C** y tratamiento H02 de ronda 1: sin cambios.
- **Decisiones pendientes de arquitectura o alcance:** ninguna.
- **Nuevo hallazgo bloqueante de código:** ninguno en estos seis archivos.
- **Pendientes operativos:** seguimiento #601 y E2E postmerge; el run de bitácora con falla de `next/font` debe distinguirse del CI verde del código y del requerimiento de checks de branch protection.
- No aprobar ni mergear automáticamente; el owner P1 conserva la decisión y la ejecución operacional.

Ronda 1 se preserva tal como fue registrada. La ronda 2 solo actualiza estados verificados desde evidencia independiente. Ver `evidencia/comandos.md` para referencias exactas.
