# Informe de revisión independiente — PR #358 / T-356 — Ronda 1

**Fecha:** 2026-10-15 (Argentina) · **Revisor:** revisión independiente de código · **PR:** https://github.com/cadeApp/cadeApp/pull/358  
**HEAD revisado:** `d0cf083dbb42beacc1f0bba4e4d5a4b1fce78408` · **Base:** `develop@14c28ed3c41cb2bde92705fc018c7dd0df73245b` · **Issue de contrato:** https://github.com/cadeApp/cadeApp/issues/363.

## Resultado: CON BLOQUEANTES DE ARQUITECTURA (2), NO MERGEABLE AÚN

Esta es una PR **Draft preimplementación**. El diff solo agrega 13 líneas en `docs/tasks/log/T-356.md` y respeta los «Archivos permitidos». El código que se comenta abajo es **preexistente en develop**, NO cambios introducidos por #358. No se atribuye al autor un error de implementación que todavía no escribió. La revisión evalúa la viabilidad/seguridad de la propuesta publicada y las decisiones confirmadas de Lautaro073.

**Decisiones ya resueltas (2026-10-15):** 1C — código de rechazo publicable y auditoría interna separada; 2C — componente reutilizable en perfil/estado; 3B — retener históricas y purgar según política; 4C — RPC transaccional con RLS/grants. No hay que repreguntarlas. En el comentario inicial el agente propuso consulta `createAdminClient()` a `audit_log.after.reason`, y `purge_after=now()`; esas propuestas **no se implementan** tras la decisión.

## Alcance y verificación previa
- PR #358: **1 archivo** (`docs/tasks/log/T-356.md`), +13/-0; rama +2 commits, behind develop = 0; GitHub marcó PR mergeable, pero **eso no acredita el DoD**.
- Ficha leída desde `develop`: `docs/tasks/T-356.md`; exige CC previo para SQL/RPC/domain. La PR no cambia la ficha ni contiene trabajo técnico.
- Consultados: bitácora, comentarios de PR, `.agents/skills/revisar-pr/SKILL.md`, `.agents/skills/contract-change/SKILL.md`, `docs/revision-pr/README.md`, políticas y código vigentes.
- **CI no se usa como prueba de la funcionalidad** mientras existen bloqueantes: `typecheck`, `lint`, `test`, `test:db`, E2E y mutaciones de funcionalidad: **NO EJECUTADOS POR ESTE REVISOR**. La bitácora los consigna pendientes. No se afirmó rojo/verde funcional.

## H01 — BLOQUEANTE (alto): la propuesta de Server Action no puede hacer cumplir «solo rechazados»
**Lugar inspeccionado en develop:** `supabase/migrations/20260922051650_rls_v1.sql:251-258`; `src/features/courier-onboarding/actions.ts`. **Estado: ANÁLISIS estático de propuesta**, no defecto introducido por la rama.

**Diagnóstico:** `courier_documents_insert_self` permite un INSERT a actor dueño con `status = 'submitted'`, `purge_after`/`purged_at` nulos; **no compara** estado anterior y no exige `rejected`. Un usuario autenticado puede llamar Supabase directamente, sin pasar por `replaceCourierDocumentAction`, insertando una nueva versión propia de un `kind` con versión anterior aprobada/submitted. Esto no permite por sí mismo pasar `status=verified`, pero viola la exclusividad pretendida del reemplazo si el nuevo flujo se apoya solo en la action. La RLS original soporta onboarding: **no revocar INSERT sin un rollout compatible**.

**Arreglo exigido (CC #363):** RPC courier autenticada que valida `auth.uid()`, versión vigente rechazada, path Storage propio y existente, locks e idempotencia; barrera SQL efectiva contra bypass de INSERT/UPDATE y continuidad de onboarding. Mantener RLS/grants mínimos, `SECURITY DEFINER` con search_path fijo y audit sin PII.

**Prueba para cerrar (no ejecutada):** pgTAP con petición directa de INSERT `submitted` del mismo kind cuando la vigente está verified: debe fallar tras el CC; probar también nuevo courier sin doc y reemplazo legítimo rejected. Mutar temporalmente el guard rejected y comprobar RED/RESTORE→GREEN de la prueba. CI `db-tests` del SHA final.

## H02 — BLOQUEANTE (alto): versiones históricas sin «vigente» determinista
**Lugares inspeccionados en develop:** `supabase/migrations/20260922031435_schema_v1.sql:70-81`; `src/app/(courier)/courier/profile/page.tsx`; `src/features/admin/queries.ts:214-251`.

**Diagnóstico:** `courier_documents` tiene PK `id`, `storage_path` único y fecha `uploaded_at`, **pero no versión actual ni unicidad activa por (`courier_id`, `kind`)**. El perfil consulta `kind,status` sin orden y luego `docs.find(kind)`; admin devuelve todos en orden ascendente. Al agregar el registro `submitted` nuevo propuesto, una pantalla puede seguir tomando el `rejected` antiguo, o admin intentar decidir uno ya obsoleto. El riesgo es verificable por el patrón de consulta; la aparición real requiere reproducirlo con versiones duplicadas.

**Arreglo exigido (CC #363 + UI T-356):** fuente de verdad para exactamente una versión actual por kind, índice/restricción o relación SQL con migración y backfill determinista; RPC admin solo cambia actual; proyecciones de courier/admin identifican actual de manera explícita, histórico queda auditado y con retención. No confiar en un `.order(uploaded_at)` informal ni en `.find()`.

**Prueba para cerrar (no ejecutada):** dos versiones mismo kind con fechas invertidas/timestamp empatado → una y solo una vigente, UI muestra nueva `submitted` y admin revisa solo nueva; al rechazar DNI frente, DNI dorso verificado permanece intacto. Mutación que omite filtro de vigencia debe producir RED real.

## Otras condiciones obligatorias de diseño (no nuevas decisiones)
- **1C:** `admin_verify_document` hoy guarda texto libre `after.reason` en `audit_log`; el courier no debe leer ese texto. El CC debe separar catálogo público seguro y nota interna; migración/backfill de antiguos sin interpretar arbitrariamente texto libre. Ver `supabase/migrations/20260924013700_rpc_admin_v1.sql:241-250`.
- **2C:** en `src/features/courier-onboarding/components/{courier-profile-view,status-view,document-upload-card}.tsx` reutilizar flujo, dar acción por cada documento rechazado (DNI frente/dorso separado), progresos/reintentos/a11y.
- **3B:** `src/server/cron/sweep.ts` ya purga `courier_documents` por `purge_after`; no usar `now()` como plazo sin política. Recuperar/definir política real de retención en CC, tratamiento de binarios huérfanos y de fallas en Storage.
- **4C:** Storage y DB no son una misma transacción; subida provisional y promoción DB transaccional deben diseñarse con cleanup/idempotencia de red.
- Ficha T-356 **no permite** cambiar SQL/RPC/domain: CC debe realizarse en rama/PR separados, mergearse antes, reconciliar ficha y solo luego retomar #358.

## Evidencia del revisor
Mediante lecturas del código en `develop` y una batería de comprobación estática (7 predicados observados; mutación en memoria detectada por instrumento), descrita íntegra en [evidencia/comandos.md](../evidencia/comandos.md). Esa batería **no reemplaza** pruebas funcionales de DB, UI, mutaciones de código ni E2E. No se ejecutó `git fetch` local/merge-tree ni pnpm: en este entorno Git remoto por clon no resuelve DNS; la comparación GitHub reportó +2/-0 commits y `mergeable=true`.

## NO TOCAR / falsos positivos descartados
- No afirmar «el courier puede autoaprobarse»: la policy restringe a `submitted`; el hallazgo es **inserción no elegible**, no aprobación directa.
- No considerar `audit_log` consultable por courier: RLS actual restringe a admin; cambiar eso o usar un service role sin proyección es inaceptable.
- No pedir tests funcionales verdes de un Draft que solo documenta planificación; esos son gate antes de pasar a Ready/Merge, no evidencia existente.
- No modificar esquema ni autorización desde #358, no inventar días de retención, no alterar CI/thresholds ni ejecutar Docker/Supabase remoto.
- No proponer `purge_after=now()` y no remover el historial antes de que venza su retención.

## Estado y próximos pasos
1. Issue CC #363 creado y etiquetado `contract-change`; issue #343 y PR #358 marcados `bloqueada` sin merge.
2. Agente implementador: seguir [prompt-agy.md](../prompt-agy.md) en **dos fases**: CC independiente y luego T-356. Prompt completo también en **el mismo comentario GitHub** que cierra esta ronda.
3. Revisor independiente: abrir ronda 2 tras nuevos commits funcionales, confirmar fuente desde develop+CC, comprobar pruebas RED→GREEN y E2E con SHA, sin certificar como verificado lo que todavía es análisis.