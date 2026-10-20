# Informe de revisión independiente — PR #454 / T-384 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/454
**HEAD revisado:** `cc87a902e30c5c2f452e80edb34ca78dac396ab3` · **base:** develop @ `03dec5b074e634d6f3895c282e58f7d7e6eb4456`
**Fecha:** 2026-10-20 · **Estado PR:** Draft
**Resultado:** **CON BLOQUEANTES (6)** · **Mejoras:** 0

## Alcance revisado
Ficha T-384 y contrato CC-033 LEÍDOS desde develop. Nueve archivos cambiados están dentro de los permitidos. No hubo cambios de políticas RLS, no se agregó UI, no hay dependencias nuevas. Se leyeron las convenciones de revisión y lecciones AG-32..AG-38, AG-57..AG-60 y referencias de PR anteriores. Sin decisiones de producto abiertas: CC-033 tiene decisiones cerradas.

## Resultado por hallazgo
| ID | Severidad | Archivo | Hallazgo |
|---|---|---|---|
| H01 | alto | `supabase/tests/cc033_add_courier_optional_document.sql` | pgTAP solo comprueba la existencia de la RPC |
| H02 | alto | `supabase/tests/integration/cc033_concurrency.mjs` | Falta la suite de concurrencia y su integración a CI |
| H03 | medio | `supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql` | La validación SQL permite valores no canónicos y no devuelve el error de contrato |
| H04 | alto | `src/domain/cc033-add-courier-optional-document.test.ts` | El fake carece de matriz funcional y unit falla por cobertura |
| H05 | medio | `src/server/rpc/courier.test.ts` | El test del wrapper no verifica qué RPC ni qué payload se envía |
| H06 | alto | `src/types/database.types.ts` | database.types.ts fue editado manualmente y aún no hay prueba de drift |

### H01 — pgTAP solo comprueba la existencia de la RPC

**Severidad:** alto (BLOQUEANTE) · **supabase/tests/cc033_add_courier_optional_document.sql:6** · **Detección:** inspección.

**Diagnóstico:** Se publicó un esqueleto con plan(1) sin los casos obligatorios de CC-033.

**Evidencia:** select plan(1) y una sola has_function; faltan aserciones funcionales, privilegios, privacidad y admin_verify_document.

**Arreglo concreto:** Sustituir plan(1) por pgTAP exhaustivo según CC-033: licencia y seguro, courier approved/pending completos, pending vehicle_type NULL, inválidos kind/path/Storage, documentos vigentes submitted/verified/rejected, idempotencia con/sin clave, rechazo de actores y anon, insert directo 42501, status/doc_level, verificación por admin y auditoría sin PII. Afirmar filas antes/después y estado, no solo lives_ok. Usar throws_ok(sql, 'P0001'::char(5), null::text, descripción) cuando corresponda.

**Razón de no detección:** El SQL actual pasa si el cuerpo de la función acepta estados, roles o documentos incorrectos.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

### H02 — Falta la suite de concurrencia y su integración a CI

**Severidad:** alto (BLOQUEANTE) · **supabase/tests/integration/cc033_concurrency.mjs:1** · **Detección:** inspección.

**Diagnóstico:** Se implementó la función antes de crear la prueba multisesión prometida.

**Evidencia:** No existe cc033_concurrency.mjs entre los 9 archivos cambiados; ci.yml no invoca dicha suite.

**Arreglo concreto:** Crear exactamente supabase/tests/integration/cc033_concurrency.mjs sobre patrón cc025_concurrency.mjs: dos psql sessions independientes y barreras por pg_blocking_pids; cubrir alta/alta distinto path, alta/alta mismo path, suspensión gana y alta gana; contar vigente y audit_log, verificar que no hay 40P01. Agregar dos invocaciones en el bloque db-tests de ci.yml: normal y --mutation-check, con inversión real y efímera del orden de locks y restauración; nunca sleeps ni mocks.

**Razón de no detección:** db-tests puede terminar verde sin probar simultaneidad de dos conexiones ni inversión de locks.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

### H03 — La validación SQL permite valores no canónicos y no devuelve el error de contrato

**Severidad:** medio (BLOQUEANTE) · **supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql:37** · **Detección:** inspección.

**Diagnóstico:** Se copió el patrón del reemplazo sin cubrir NULL de kind ni presencia/formato exacto de idempotencyKey y extensión.

**Evidencia:** v_kind_text NOT IN (...) es NULL cuando falta kind; nullif(trim(...),'') convierte clave enviada vacía en ausente; !~* admite .PNG.

**Arreglo concreto:** Primero rechazar v_kind_text IS NULL antes del NOT IN; además validar kind/path como tipos de JSON cuando se reciben; para idempotencyKey, si la propiedad existe, exigir string UUID no vacío, sin trim silencioso ni null; si no existe, permitir ausencia. Hacer que el regex de extensión coincida con CC-033 (sensible a mayúsculas) y sincronizar el fake. Probar NULL/ausencia, JSON null, '', '   ', extensión .PNG y UUID válido/mal formado directamente por PostgreSQL.

**Razón de no detección:** El pgTAP actual solo hace has_function y el wrapper Zod no protege llamadas directas a la RPC.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

### H04 — El fake carece de matriz funcional y unit falla por cobertura

**Severidad:** alto (BLOQUEANTE) · **src/domain/cc033-add-courier-optional-document.test.ts:27** · **Detección:** CI + inspección.

**Diagnóstico:** La suite prueba un único happy path y deja sin recorrer casi todos los rechazos y reintentos del fake.

**Evidencia:** Solo hay un it funcional para fake; job unit 118499702217: 2904 tests pass, ramas de rpc-fake.ts 89.45% < 90%.

**Arreglo concreto:** Extender cc033-add-courier-optional-document.test.ts con casos fake de roles no autorizados, consentimiento, status rejected/suspended, pending incompleto, kind inválido, path ajeno/.. / extensión, Storage inexistente, vigente submitted/verified/rejected, idempotencia con/sin clave y sin duplicados, ambos kind y ambos status de courier; afirmar courier y documentos realmente mutados. Reejecutar pnpm test:coverage y conservar umbral >=90% (no bajarlo).

**Razón de no detección:** Los 2904 tests pasan, pero no detectan omisiones de ramas nuevas y el gate de cobertura falla.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

### H05 — El test del wrapper no verifica qué RPC ni qué payload se envía

**Severidad:** medio (BLOQUEANTE) · **src/server/rpc/courier.test.ts:167** · **Detección:** inspección.

**Diagnóstico:** Los stubs rpc() de la suite CC-033 no verifican sus argumentos.

**Evidencia:** Las funciones rpc() de los stubs CC-033 devuelven datos ignorando fn y args; una llamada a otro nombre devolvería los mismos resultados.

**Arreglo concreto:** Usar un spy tipado sobre client.rpc que compruebe fn === 'add_courier_optional_document' y p_payload exacto (con y sin UUID), el número de llamadas, y que payload inválido no llame al servidor. Probar respuesta malformada y excepción -> INTERNAL_ERROR. Mutación RED: cambiar temporalmente el nombre RPC invocado y comprobar que falla por nombre, no por TypeError del mock.

**Razón de no detección:** La batería actual seguiría verde si el wrapper llamara a otra RPC pero el stub devolviera el mismo objeto.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

### H06 — database.types.ts fue editado manualmente y aún no hay prueba de drift

**Severidad:** alto (BLOQUEANTE) · **src/types/database.types.ts:1379** · **Detección:** CI + inspección.

**Diagnóstico:** Se insertó una firma a mano sin ejecutar el generador; hay indentación anómala alrededor de funciones contiguas.

**Evidencia:** El CI job db-tests 118499702385 ejecutó y obtuvo PASS en 32 archivos / 2869 pruebas de base, pero falló en git diff --exit-code src/types/database.types.ts. El diff muestra que la firma de add_courier_optional_document fue ubicada después de admin_verify_document en lugar de antes, además de reindentación no generada.

**Arreglo concreto:** Obtener los tipos reales desde el artefacto de db-tests/pnpm db:types --local en el job autorizado, comparar el archivo generado contra el versionado con git diff --exit-code y corregir solo la discrepancia. No modificar tipos como conjetura ni correr Supabase local por fuera de CI.

**Razón de no detección:** typecheck no verifica igualdad textual con tipos generados; solo el drift check de db-tests la confirma.

**Verificación:** consultar [comandos de reproducción](../evidencia/comandos.md); mutaciones runtime todavía no corridas por este revisor.

## NO TOCAR — problemas descartados
- `security definer` y `search_path = public, pg_temp`: constan expresamente en la función y respetan CC-033.
- Lock declarado `couriers → profiles → courier_documents`: el código sigue el orden de CC-033 por inspección; la ausencia de la suite multisesión de CC-033 **no** permite declararlo verificado en runtime.
- `pending` con `vehicle_type` no nulo es intencional según la decisión aprobada del CC. No exigir `approved` para dar de alta.
- `doc_level` es columna generada; pasar status a submitted no lo sube. No exigir cambio directo.
- Mantener sin modificaciones UI, RLS, grants históricos, migraciones anteriores y datos personales en auditoría.

## CI en SHA revisado
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success.
- `unit` (job 118499702217): **failure** pese a `Test Files 149 passed`, `Tests 2904 passed`; causa final: `rpc-fake.ts` branch coverage **89.45%** < **90%**.
- `db-tests`: **failure** (job 118499702385). Los 32 archivos / 2869 tests SQL finalizaron PASS, pero el paso `git diff --exit-code -- src/types/database.types.ts` falló (exit 1) porque el archivo generado difiere del versionado.
- El PR admite test global inconcluso local; CI sí acabó tests y exhibe problema de cobertura.
- No se corrió Supabase/Docker local, por regla T-384. No se ejecutó test E2E porque la tarea carece de UI.
- Este informe es revisión estática + observación CI; no afirma mutaciones RED/GREEN propias ejecutadas.

## Riesgos y por qué CI no valida todavía el contrato
El único pgTAP nuevo comprueba `has_function`. Los tests de fake cubren solo un happy path. El wrapper se prueba contra stubs sin inspeccionar los argumentos. El CI de concurrencia aún no invoca CC-033. Por ello, incluso un futuro db-tests verde del código actual no demostraría CC-033.

## Checklist para ronda 2
- [ ] pgTAP completo y discriminante (mutaciones del revisor)
- [ ] Concurrencia 2 sesiones/4 carreras y --mutation-check real en CI
- [ ] Validación SQL alineada y pruebas NULL, UUID, extensión
- [ ] Fake y wrapper pruebas efectivas con RED real y cobertura >=90%
- [ ] Regeneración exacta de tipos y drift check `db-tests`
- [ ] Revisar logs CI del SHA posterior y bitácora actualizada
- [ ] Comparar HEAD remoto y verificar que no hubo cambios de ficha ni alcance

**Revisión actual:** no mergear. No se aprueba ni se publica una review APPROVE.
