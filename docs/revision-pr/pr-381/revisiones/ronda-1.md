# Informe de revisión independiente — PR #381 / Subetapa B0 / CC-025 — Ronda 1

**Fecha:** 2026-10-16 · **HEAD funcional auditado:** `82f1cb179a4a5135a8a6c837faa647baefaa74be` · **PR:** https://github.com/cadeApp/cadeApp/pull/381 · **Dictamen: CON BLOQUEANTES (4). NO APROBAR / NO MERGEAR.**

## Qué sí se implementó y comprobó
La PR aporta migración nueva con `public.submit_courier_onboarding_documents(jsonb)` SECURITY DEFINER, `auth.uid()`, guard de rol y consentimiento, lock `couriers FOR UPDATE`, validación de 4 kinds obligatorios + dos opcionales, rutas canónicas, consulta de documentos vigentes e INSERT transaccional. REVOKE EXECUTE a PUBLIC/anon y GRANT a authenticated. Incluye 28 aserciones pgTAP, runner de dos sesiones, tipos y CI aditivo. La PR B (#376) aún no invoca la RPC; solo documenta esta dependencia y está 2 commits por detrás de develop. La #364 sigue bloqueada.

[CI run 38852141921](https://github.com/cadeApp/cadeApp/actions/runs/38852141921) completado SUCCESS en SHA `82f1cb179a4a5135a8a6c837faa647baefaa74be`: 133 suites / **2366 unit** PASS, **25 archivos / 2311 pgTAP** PASS, typecheck, lint, build, audit y bundle-budget exitosos. `approval-policy` reportado SUCCESS por autor. En db-tests se ejecutó el runner multi-sesión CC-025 B0 de verdad y controles de otras tareas; **eso NO convierte cualquier resultado de su arnés en prueba correcta**.

**Corrección a sospecha preliminar del revisor:** la falta de flags `v_has_license`/`v_has_insurance` no permite por sí sola guardar dos versiones: en el bucle transaccional la segunda entrada ve la primera ya insertada; con otra ruta aborta toda la transacción. No se registra como hallazgo de duplicidad.

## Bloqueantes

### PR381-H01 — ALTO — La vía REST/legacy con otra ruta evita RPC/lock
**Origen:** `supabase/tests/integration/cc025_b0_concurrency.mjs:testCoexistenceDirectInsert()` y `supabase/migrations/20260922051650_rls_v1.sql:courier_documents_insert_self`.
El test de convivencia actual inserta después de la RPC el **mismo** `storage_path`, recibe 23505 por la restricción `UNIQUE(storage_path)` y declara la coexistencia verificada. Pero la policy de INSERT autenticado anterior a C solo exige `courier_id=auth.uid()`, `status='submitted'` y nulidad de purga; el CHECK A no limita kinds. Un `storage_path` **distinto** para el mismo `courier_id,kind` no choca con UNIQUE(storage_path), ni adquiere el lock de la RPC. Esto contradice la afirmación de que B0 elimina globalmente la carrera para todos los escritores.

**Prueba que falta:** crear 4 docs por RPC, en conexión JWT courier authenticated ejecutar INSERT directo de `dni_front` con nueva ruta `dni_front_other.jpg` (y luego durante una RPC que retiene lock), comprobar cardinalidad y permisos. La expectativa de que esa ruta se rechace **no** está cubierta por la actual migración; documentar el resultado auténtico como RED o riesgo vivo. Para cierre de H01 global, control operativo de writers activos más barrera DB que cubra direct REST si se requiere garantía global; **no cambiar RLS ni adelantar índice de C sin evaluar compatibilidad del writer antiguo y el gate de rollout**. Presentar solución y su coste si amplía alcance de A autorizada.

### PR381-H02 — ALTO — Oráculo de mutación da falso positivo por cualquier error
**Origen:** `supabase/tests/integration/cc025_b0_concurrency.mjs:runMutationCheck()`.
El script quita realmente `FOR UPDATE` en una RPC temporal, pero `catch(err) { mutationCaught=true }` convierte **cualquier excepción** en una supuesta detección del defecto. El propio log CI muestra:
`RED confirmado por error de carrera: [MUT_S1] proceso psql terminó con código 3 mientras esperaba COMMIT`.
No consta que `count(*)>4` ni otra violación de invariant ocurriera; un `VALIDATION_ERROR` por llegada tardía puede ser **el comportamiento correcto**. `pg_sleep(0.1)` tampoco es barrera reproducible. Por tanto el RED que publicitó el autor **NO comprueba la sensibilidad** de la prueba a una pérdida real de serialización.

**Arreglo:** usar barreras/locks comprobables desde `pg_stat_activity` y un oráculo estricto sobre resultados y filas de los dos actores. Si mutar `FOR UPDATE` da sólo error seguro y no duplica docs, NO marcar H02 como RED: diseñar un interleaving que sí distinga sin lock o dejar mutación pendiente. Conservar tests y fixtures al mutar solo SQL de producción y restaurar. Prohibido capturar errores arbitrarios para fabricar PASS.

### PR381-H03 — ALTO — Courier rejected/suspended puede invocar RPC directa
**Origen:** SQL B0 líneas 48–55, 119–157. La función valida `profiles.role='courier'` y consentimiento, pero al bloquear `couriers` selecciona `profile_id,vehicle_type` y **no lee ni restringe `couriers.status`**. Cualquier sesión authenticated de un courier rechazado/suspendido que tenga consentimiento activo puede llamar la RPC SECURITY DEFINER y crear nuevas filas con status submitted. La acción de onboarding previa sí filtra estado rejected/suspended (por DNI y usuario), pero un caller REST puede saltarse esa acción. Esto prolonga un bypass preexistente, aunque no demuestre escalada de privilegio nueva.

**Arreglo:** bajo `FOR UPDATE` leer `status` y rechazar explícitamente `rejected/suspended`, conservando los estados permitidos según contrato (pending y, para reintentos compatibles, approved si aplica). Añadir pgTAP negativos para ambos con actor auténtico, mismo payload completo, cero inserts y sin actualización de terceros. RED al quitar guard; GREEN restaurado.

### PR381-H04 — MEDIO — Consentimiento/rol pueden cambiar mientras se espera lock
**Origen:** SQL B0 líneas 35–51. La función lee el perfil y valida consentimiento **antes** de esperar `couriers FOR UPDATE`, pero no vuelve a revisar perfil. Si en otra sesión se revoca el consentimiento mientras la RPC espera, podrá insertar tras obtener lock con autorización desactualizada. Este es un **interleaving técnicamente posible por el orden de SQL, no una carrera reproducida en DB en esta revisión**.

**Arreglo:** revisar `profiles.role` y `consent_status` bajo un lock de lectura adecuado **después** de tomar `couriers FOR UPDATE`, o adoptar un orden de locks común para evitar 40P01. Probar revocación concurrente mientras la llamada espera, éxito vs denegación, y que no se insertan filas cuando la revocación ya ha commiteado. Mutación quitar segunda validación => RED auténtico. Revisar orden de locks frente a acciones admin existentes; no crear nueva inversión `profiles→couriers`.

## Alcance, CI, evidencia y condiciones

- Diff contra develop: 7 archivos autorizables por B0 en `supabase/migrations/**`, `supabase/tests/**`, `src/types/database.types.ts`, `.github/workflows/ci.yml`, contrato y bitácora; **sin código UI ni writer B**. El CC aprobado cubre una subetapa aditiva; reconciliar ficha T-356 antes de promocionar al entorno.
- La rama B0 está **2 commits por detrás** de develop (GitHub compare ahead 6, behind 2), aunque REST reporta mergeable=true/unstable. Integrar develop mediante merge, NO rebase ni force, y revalidar SHA nuevo antes del cierre. No afirmar conflictos donde no se verificaron.
- Ninguna mutación PostgreSQL del revisor se ejecutó, según la restricción del usuario de no arrancar Docker/Supabase local. La evidencia H01/H03/H04 es **estática por lectura de source real**; la evidencia de H02 es lectura del arnés y log del job real. No se confunde el RED del autor con verificación independiente.
- No se alteraron permisos/RLS, migraciones ya mergeadas, secretos, tests o código por este revisor. No aprobación/merge de #381/#376/#364/#358 ni cierre de #363.
- **Decisiones humanas previas:** rollout A y B0 RPC aditiva ya están autorizados; **no hace falta volver a elegir A/B/C**. Cualquier restricción temporal adicional a INSERT directo que afecte writer legacy requiere explicación de compatibilidad antes de implementarla, no una autorización inventada.

**Entregables:** `README.md`, `hallazgos.jsonl`, `evidencia/comandos.md`, `lecciones.md`, `prompt-agy.md` en `docs/revision-pr/pr-381/`.