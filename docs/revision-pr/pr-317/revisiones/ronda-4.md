# Revisión independiente — PR #317 / T-340 — ronda 4

**Fecha:** 2026-10-11. **SHA de código revisado:** `d2b3285ab837c8a18a3ad2171a08a3668aafdc5c`. Base `develop` `7cf1a653`, behind=0. PR de asako669 (P2). **Resultado: CON BLOQUEANTES (2: H08 y H13). NO MERGEAR.**

## Contraste de la ronda 3

| ID | Resultado | Evidencia |
|---|---|---|
| H08 · concurrencia | **ABIERTO** | La bitácora reconoce que no se ensayaron dos sesiones y pide autorizar un harness fuera de alcance. Los tests nuevos siguen siendo de una sola transacción/sesión; el cuerpo de la PR aún marca erróneamente como realizado el DoD concurrente. |
| H10 · normalización | **ARREGLADO-VERIFICADO** | Helper `app_private.t340_backfill_legacy()` materializa históricos `transfer/to_agree+needs_change=true` con `needs_change=false`, y cash+cambio sin monto con `NULL`; test nuevo llama al helper y verifica drops, contactos, legacy e idempotencia. CI pasa. |
| H11 · monto en audit_log | **ARREGLADO-VERIFICADO** | `audit_log.before` ya usa `has_cash_change_amount` booleano, no el valor numérico `cash_change_amount`. Nuevo pgTAP busca la ausencia de la clave y comprueba la bandera. CI pasa. |
| H12 · fecha inventada | **ARREGLADO-VERIFICADO** | Ya no aparece `coalesce(r.delivered_at,r.updated_at,r.created_at)`. Históricos `delivered` sin fecha se preservan y auditan sin drop ficticio; con fecha se copia exactamente. Pruebas reales sobre helper, CI pasa. |

**Control independiente:** inspección de ambas ramas de auditoría y del helper; harness de mutaciones EN MEMORIA elaborado por el revisor, distinto del autor: H10/H11/H12 pasan detector basal y una mutación que reintroduce filtro de pago, monto privado o fecha artificial cambia el detector a rojo. **No** se ejecutaron mutaciones SQL con Postgres real; la verificación se limita a código del SHA y pruebas pgTAP corridas en CI. No afirmar RED→GREEN de base para esta revisión.

## Bloqueantes vigentes

### PR317-H08 — ALTO · Faltan carreras de dos sesiones para el guard

- **Archivo:** `supabase/tests/t340_multi_drop.sql:138–313`; `supabase/migrations/20261009200000_t340_multi_drop.sql:71–132`.
- **Contrato:** CC-022 §2b / pruebas de serialización del paso 1. El trigger `SECURITY INVOKER` contiene el `FOR UPDATE` esperado, pero las pruebas siguen siendo exclusivamente secuenciales dentro de la transacción pgTAP; no demuestran que una escritura de hijo compita con `publish_request` ni que la que llega después se rechace.
- **Evidencia:** búsqueda independiente de `dblink_connect`, `pg_background`, subprocess/psql y barreras en el test: ninguno; la propia bitácora declara explícitamente que H08 está pendiente y solicita ampliar el alcance.
- **Corrección exigida:** una prueba determinista de DOS sesiones/ conexiones, para cada `INSERT`, `UPDATE`, `DELETE` de drops y `UPDATE` de `drop_contacts` contra `publish_request`, con orden de locks comprobado y resultado final; mutación real que quite `FOR UPDATE` o convierta el guard en `SECURITY DEFINER` debe poner la prueba roja. No trasladar sin autorización el requisito al paso 4.
- **Decisión técnica de alcance necesaria:** el test integrado de 2 sesiones requiere añadir un archivo y conectarlo al CI de DB. Recomendación A: runner autónomo Node bajo `supabase/tests/integration/t340_concurrency.mjs` + invocación específica en `.github/workflows/ci.yml`, reutilizando el Postgres efímero de `db-tests` con dos conexiones `psql` externas; controlar contención con barreras/advisory locks/lectura de `pg_stat_activity`, timeout por sesión, y verificar el estado final desde la base. No introducir dependencia npm nueva ni credenciales remotas; reusar `docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres`. La autorización la decide Lautaro073.
  - **Opción B:** instrumentar un único bloque bash/psql inline en `ci.yml`: menos archivos, menor mantenibilidad y mayor riesgo de carrera o flakiness.
  - **Alternativa C:** posponer ensayo al E2E del paso 4: evita cambios de infraestructura, pero incumple el gate de CC-022 y deja una ventana de despliegue sin comprobar. **No recomendada.**
  - Si se autoriza A, agregar los dos archivos a «Archivos permitidos» de T-340 **solo para el paso 1/harness**, sin ampliar implementación de negocio, y documentar controles propios para impedir que el test ignore las carreras.

### PR317-H13 — ALTO · RPC de estados por entrega expuestas sin tests de comportamiento

- **Archivos:** `supabase/migrations/20261009200000_t340_multi_drop.sql:949–1230` (funciones `public.mark_drop_delivered` / `public.mark_drop_failed`); `supabase/tests/t340_multi_drop.sql:620–622`.
- **Hecho comprobado:** la migración concede `EXECUTE` de ambas RPC a `authenticated`, y las funciones implementan autorización del repartidor aceptado, transición `pending→delivered/failed`, razón obligatoria, idempotencia y cierre de solicitud al terminar todos los drops. Sin embargo, **las únicas dos referencias a esas funciones en toda la suite T-340 son `has_function(...)`**; jamás se invocan con estado/actor reales.
- **Consecuencia:** una mutación de código que eluda la validación del actor, marque un drop dos veces, permita `pending→failed` sin motivo, o no cierre la solicitud cuando todos los drops pasan a terminales mantendría verde la suite de 52 aserciones. La definición de funciones no prueba el DoD de estados por entrega de CC-022 §6.
- **Corrección:** completar `supabase/tests/t340_multi_drop.sql` con al menos actor repartidor aceptado vs ajeno/suspendido, `in_transit` vs otros estados, `mark_drop_delivered` y `mark_drop_failed` exitosos, motivo ausente y >500 caracteres, idempotencia de cada RPC, prohibición de reversión de estado, finalización solo cuando no quedan `pending`, todas fallidas ⇒ parent `delivered`, `mark_delivered` legacy denegado con N>1, prueba de no duplicación de cierre. Sembrar merchant/courier/offer aceptada y datos válidos, `SET ROLE authenticated` + JWT de actor, comprobar filas y JSON. Mutaciones RED productivas: anular `v_offer.courier_id is distinct from v_actor_id`, quitar validación de `pending`, y omitir update del estado padre; cada grupo de tests debe fallar ante la mutación concreta. No `has_function` como sustituto, ni `pass()`/`ok(true)` tautológicos.
- **Alcance:** código ya está en esta PR y expuesto a clientes tras su migración; estos tests **son del paso 1**, no pueden diferirse solo porque la UI llega en paso 4.

## CI y ejecución

GitHub Actions en `d2b3285ab837c8a18a3ad2171a08a3668aafdc5c`: run `38149501869`, `db-tests` job `114499806753`. El log interno confirma **migración aplicada** y `t340_multi_drop.sql ... ok`; `Files=1, Tests=10, Result: PASS` en bootstrap, y `Files=21, Tests=1955, Result: PASS` en suite completa (52 asserts nuevas, 0 `pass()`). `pnpm db:types --local` ejecutado sin drift informado. `typecheck/lint/unit/build/audit/bundle-budget` SUCCESS. `approval-policy` FAILURE y Supabase Preview SKIPPED. Hubo warnings de rate limit Docker Hub pero los reintentos finalmente concluyeron el job verde.

**Tests locales propios:** no ejecutados; este revisor dispone de lectura por conector, no de un clon del SHA para ejecutar `pnpm` ni levanta Docker/Supabase local conforme a la prohibición del proyecto. Las mutaciones de H10–H12 son detectores estáticos en memoria; no pruebas concurrentes reales. No se verifica desplegar Develop (no merge). Se ha inspeccionado el diff contra el último commit de revisión; el autor solo cambió migración, test y bitácora.

## Observación no bloqueante / riesgo para la próxima PR

El backfill materializa drops también para borradores legacy completos; si un cliente antiguo modifica luego campos legacy del borrador, `publish_request` ve `v_drops_count>0` y no vuelve a copiar valores. La UI actual crea y publica sin mostrar una edición, así que **no se ha reproducido un flujo actual con pérdida de datos**; añadir test de compatibilidad de borrador legacy preexistente modificado después del backfill si hay escritores antiguos que puedan editarlo. No registrar como bug probado sin demostrar un writer real.

## Próximo paso / decisión

**Se necesitan la decisión de Lautaro073 sobre la ampliación del harness para H08 y la corrección de H13.** No aprobar, no mergear, no arrancar el paso 2. Si se elige A, ajustar la ficha/alcance primero y dar un prompt a agy que habilite exactamente esos dos archivos, sin tocar ninguna lógica de negocio fuera del paso 1. Seguir con ronda 5 al haber nuevo SHA.

### Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente — ronda 4

**Resultado: CON BLOQUEANTES (2).**

Checks locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (db-tests CI ✅).

BLOQUEANTES:
- H08 `supabase/tests/t340_multi_drop.sql:138–313`: sin dos sesiones concurrentes contra `publish_request` → agregar harness independiente a CI previa autorización.
- H13 `supabase/tests/t340_multi_drop.sql:620–622`: RPC `mark_drop_delivered/failed` solo comprobadas por `has_function` → pruebas reales de autorización, transiciones, idempotencia y cierre.

MEJORAS: una hipótesis de borrador legacy modificado post-backfill, a validar con writer real.

No revisado: mutaciones productivas SQL/contención de dos sesiones y checkpoint post-merge. Sin aprobación ni merge.
