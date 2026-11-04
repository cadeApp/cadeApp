# Ronda 1 — PR #588 · T-421 · 2026-11-04

**Informe revisar-pr — revisión independiente (ChatGPT).**

**Resultado:** **CON BLOQUEANTES (3)**. Inspección sobre `3abbc5c459f6692483c08494789f1771dabfd050`, comparada con la ficha T-421 leída desde `develop` y los contratos CC-043/CC-044 ya mergeados por #587.

**Checks:** no se ejecutaron localmente `pnpm typecheck`, `pnpm lint`, `pnpm test` ni una base local, conforme a la restricción operativa de no levantar Docker/Supabase. Se verificaron los **logs oficiales del CI sobre `d9012249`**: `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` y `db-tests` concluyeron `success`; `db-tests` terminó `Files=42, Tests=3394, Result: PASS`, incluidos `cc016`, `cc043` y `cc044`. El commit inspeccionado `3abbc5c` solo agregó evidencia a la bitácora, no código. `e2e-preview` quedó **BLOCKED / REQUIRES DEVELOP MIGRATION**, sin ejecutar los E2E. **No se afirma E2E GREEN ni RED de mutación ejecutado por esta revisión.**

## BLOQUEANTES

### PR588-H01 · Error en lectura se toma por onboarding incompleto

- **Ubicación:** `src/app/auth/confirm/route.ts:105-116` y `src/app/auth/confirm/route.test.ts`.
- **Problema:** la consulta destructurada ignora `error`. Ante `{ data: null, error: ... }`, `courier?.application_submitted === true` da `false`, y la ruta envía a `/courier/onboarding/identity`. El DoD CC-043 exige que una lectura fallida se trate como estado **desconocido (`undefined`)**, no como `false`, evitando redirecciones incorrectas.
- **Arreglo:** separar error de consulta, ausencia de fila y booleano explícito. Reutilizar `parseOnboardingComplete('courier', ...)` cuando corresponda y `resolvePostLoginRedirect` con `undefined` al fallar la lectura; una fila explícitamente no enviada sigue enviando a onboarding. No alterar los flujos merchant.
- **Prueba:** agregar test de `couriers.maybeSingle()` con `error` no nulo, con el destino no determinado por el valor `false` ni redirección a identidad; comparar con `application_submitted: false`, `true` e histórico `true`/`submitted_at: null`. Mutación RED: volver a la expresión `courier?.application_submitted === true` sin atender `error`.
- **Detección:** inspección; la prueba de error no está hoy. No se ejecutó esta mutación.

### PR588-H02 · Falta comprobar que el lock serializador no puede eliminarse

- **Ubicación:** `supabase/migrations/20261104200000_cc043_courier_application.sql:71-76`; `supabase/tests/cc043_courier_application.sql`.
- **Problema:** la implementación sí toma `couriers ... FOR UPDATE` antes de `profiles` y documentos, pero la suite solo observa reintentos secuenciales. Eliminar ese lock conserva plausiblemente las afirmaciones secuenciales verdes. El DoD permite una simulación serializada con el lock en lugar de una ejecución de dos sesiones.
- **Arreglo aceptado:** en `cc043_courier_application.sql` agregar una **aserción estructural por función** usando `pg_get_functiondef('public.finalize_courier_application(uuid,text,public.vehicle_type,text)'::regprocedure)`; exigir que la sentencia que lee `public.couriers` para `p_courier_id` termine con `FOR UPDATE` **en esa sentencia**, y que anteceda a lecturas de `profiles` y `courier_documents`. Mantener el test de un primer envío y reintento idéntico con fecha única. No modificar la migración si su definición ya cumple.
- **Prueba:** control original GREEN en `db-tests`; PR `REVIEW ONLY / NEVER MERGE` con mutación que quite exclusivamente el `FOR UPDATE` de esa sentencia, mismo test RED por la aserción del lock, y GREEN al volver al SHA correcto. Reproducir el comando y pegar el run y SHA mutado. **Una prueba de concurrencia real sin ejecutar/cablear no sustituye esta evidencia.**
- **Seguimiento fuera del alcance de #588:** [#601](https://github.com/cadeApp/cadeApp/issues/601), integración de dos sesiones en CI.

### PR588-H03 · Fixture cc016 elude la finalización y usa patente inválida para la RPC

- **Ubicación:** `supabase/tests/cc016_request_offer_couriers.sql:81-92` y `docs/tasks/T-421.md`.
- **Problema:** el fixture activa `app.courier_application_finalize` como dueño y escribe `dni_hmac` + vehículo sin `application_submitted` ni `submitted_at`. El resultado está verde, pero no representa el envío exigido por CC-043. Además, `'PLACA16'` no cumple el regex de patente de `finalize_courier_application`; al quitar el bypass fallaría.
- **Decisión D02=C:** autorizada la ampliación **solo para arreglar el fixture por la RPC real**. Preparar los cuatro documentos obligatorios vigentes del `courier_doc2`, utilizar una patente válida, invocar `finalize_courier_application` bajo `service_role` y conservar el estado `approved` y las expectativas del contrato `get_request_offer_couriers`. Quitar los `set_config` del fixture.
- **Prueba:** agregar aserción pgTAP de `application_submitted=true` y `submitted_at IS NOT NULL` para `courier_doc2` (ajustar plan solo por el test realmente agregado). Mutación RED: restaurar el bypass sin llamada a la RPC (la nueva afirmación debe fallar); GREEN: fixture corregido en `db-tests`. Preservar las 24 aserciones existentes.
- **Origen:** ampliación añadida durante la implementación; la decisión del usuario aprueba la corrección, no el bypass anterior.

## MEJORAS

Ninguna adicional exigida en esta ronda.

## DECISIONES CERRADAS

- **D01=A:** `e2e-preview` queda `BLOCKED` hasta el merge de las migraciones a `develop` y el job `migrate-develop`; el E2E del onboarding es obligatorio después, con el procedimiento existente de CC-023 y `REVIEW ONLY` si corresponde. **No es E2E verde**.
- **D02=C:** se admite modificar el fixture `cc016` por RPC y actualizar su ampliación en la ficha; no se admiten cambios nuevos a `.github/**`.
- **H02:** alcanza el control estructural bajo mutación RED CI para esta PR, distinguiéndolo de la prueba real de concurrencia diferida a #601.

## Para continuar

El autor corrige H01-H03, conserva los tests, demuestra RED/GREEN real con las mutaciones indicadas y anota evidencia en la bitácora; no toca esta carpeta. La revisión independiente inspecciona el siguiente SHA y registra **ronda 2**. No aprobar ni mergear desde esta revisión. Ver los pasos reproducibles en `evidencia/comandos.md`.
