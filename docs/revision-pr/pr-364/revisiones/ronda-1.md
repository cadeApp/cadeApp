# Informe de revisión independiente — PR #364 / CC-025 — ronda 1

**Fecha:** 2026-10-15 · **PR:** https://github.com/cadeApp/cadeApp/pull/364 · **autor:** Lautaro073 · **código auditado:** `9be93c5bbd7450059e8104c47f87d7ea077f2785` · **merge-base:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b` · **develop actual al consultar:** `b5b9bf036c4c863c334948065a8780f76a88f758`.
**Dictamen:** **CON BLOQUEANTES (7). NO MERGEAR**. El objetivo 1C/2C/3B/4C está correctamente traducido a contratos, pero la implementación aún no garantiza los invariantes comprometidos.

## Decisiones
- Lautaro073 confirmó previamente **1C** (códigos públicos seguros + auditoría privada), **2C** (componente reutilizable perfil/estado), **3B** (retención temporal), **4C** (RPC transaccional + RLS).
- **Nueva decisión del 2026-10-15:** **B** = purgar la versión reemplazada **30 días después del reemplazo**; no implica purgar un archivo a los 30 días de su subida original si todavía era vigente. Alinear D8/documentación con esta regla explícita.
- **No queda ninguna decisión de producto pendiente de esta ronda.** Correcciones técnicas quedan en manos del implementador dentro del CC autorizado.

## Alcance y evidencia verificada
- Diff original: 12 archivos, +1723/-4; cambios en `docs/contracts/CC-025.md`, SQL nueva, pgTAP, dominio, fake, tipos y wrappers. No se agregan paquetes ni cambios de CI. La ficha T-356 desde develop todavía NO contempla CC-025; conciliación obligatoria antes del merge.
- [CI real de HEAD original, run 38684238884](https://github.com/cadeApp/cadeApp/actions/runs/38684238884): jobs `unit`, `typecheck`, `lint`, `build`, `audit`, `db-tests`, `bundle-budget` SUCCESS; log db-tests `cc025...sql .. ok`, **Files=23, Tests=2231, Result=PASS** y generación de tipos. Unit job muestra **131 archivos, 2179 tests passed**; el body de PR dice 2181, diferencia a corregir con el run final.
- No se ejecutaron SQL, Docker, Supabase local, Vercel E2E ni pruebas dual-conexión por este revisor. `git ls-remote` no funcionó desde el contenedor (DNS); lectura vía conector GitHub. Inspección + prueba de sensibilidad sintáctica en memoria (GREEN detector / RED mutación) **NO equivalen** a RED funcional ni a verificación de corregido.
- **Desfase de rama:** GitHub compare reporta `ahead=4, behind=12, status=diverged`; `mergeable=false`. No atribuir una causa única a `mergeable=false` sin merge-tree real. Antes de un merge, integrar `origin/develop` mediante merge (no rebase), resolver si hay conflictos y repetir verificaciones.
- **No hay carpeta de revisión preexistente** `docs/revision-pr/pr-364/` en el HEAD de autor. No se borró autorrevisión.

## H01 (alto) — El archivo no existe y aun así se podría registrar
**Ubicación:** `supabase/migrations/20261015020000_cc025_courier_document_replacement.sql:118-132`. **Tipo:** inspección estática de condición SQL; sin ejecutar un bucket vacío.
**Diagnóstico:** La existencia exacta de `storage.objects` sólo se comprueba **si alguna fila** existe para el bucket `courier-docs`. Si el bucket está vacío, no se verifica que `v_storage_path` exista y la RPC puede promover una referencia a un objeto inexistente, si el anterior está `rejected`. Un path bajo carpeta propia no prueba que el binario esté almacenado.
**Fix:** eliminar guard de bucket no vacío, comprobar siempre `exists(bucket_id='courier-docs',name=v_storage_path)`, rollback antes de modificar estado, sin debilitar autorizaciones.
**Prueba RED→GREEN exigida:** preparar courier rejected y bucket vacío; la RPC DEBE retornar `NOT_FOUND` y mantener filas+auditoría; seed de objeto real debe permitir promoción. Mutar a la condición actual y comprobar ROJO. Ninguno de los 26 pgTAP actuales cubre bucket vacío con documento rejected.

## H02 (alto) — Orden de locks contradictorio: posibilidad de deadlock
**Ubicación:** misma migración, `replace_courier_document` en líneas 133–146 y `admin_verify_document` en líneas 278–329. **Tipo:** análisis de interleaving; sin ejecución simultánea.
**Diagnóstico:** Courier bloquea `couriers` primero y luego `courier_documents`; admin bloquea `courier_documents` primero y luego actualiza `couriers`. Si admin está rechazando un `submitted` y courier intenta reemplazar, una sesión puede bloquear el documento y otra la fila courier: espera circular. Un índice único no evita deadlock.
**Fix:** lock global consistente: courier row → document row para ambas RPC, revalidar documentos luego de bloquearlos. Comprobar interacciones con otras RPC admin. 
**Prueba:** dos conexiones concurrentes reales, admin rechazando y courier reemplazando, sin `40P01`, un solo current, audit y estados coherentes. La suite de una sola conexión **no cubre carrera**; mutar orden y reproducir rojo (no con sleeps arbitrarios).

## H03 (alto) — Barrera DB insuficiente sobre campos nuevos
**Ubicación:** RLS heredada `supabase/migrations/20260922051650_rls_v1.sql:260-263`; migración nueva sólo sustituye `courier_documents_insert_self` pero **no** `courier_documents_write_admin`. **Tipo:** inspección de grants/policy; falta comprobar bypass en DB.
**Diagnóstico:** La policy FOR ALL para admin exige `app_private.is_admin()` pero **no AAL2** y no compara OLD/NEW. El CC incorpora `is_current` y `rejection_code` y afirma que sólo RPC los modifica. Bajo grants UPDATE directos, admin AAL1 puede saltar la RPC/auditoría al alterar vigencia o decisiones. Distinto del courier, que sí está acotado por insert/ausencia update.
**Fix:** registrar matriz real de grants + RLS y bloquear de forma efectiva cambios directos de `status/is_current/rejection_code/purge_after`; rutas autorizadas RPC y cron siguen operativas.
**Prueba:** autenticados admin AAL1/AAL2/courier, direct UPDATE e INSERT con estado pre/post; las mutaciones que vuelvan a habilitar update deben disparar RED. Si GRANT real ya prohíbe UPDATE, documentar resultado y ajustar alcance del fix sin afirmar exploit.

## H04 (medio) — Contrato de privacidad contradice SELECT actual
**Ubicación:** `docs/contracts/CC-025.md`, matriz "Documento histórico: No (reemplazado)" para courier; policy heredada `courier_documents_select_self` líneas 243–245.
**Diagnóstico:** la policy sigue siendo `courier_id=auth.uid()`, sin `is_current`; el dueño aún puede consultar metadata y `storage_path` de cualquier versión histórica, aunque binarios Storage sigan privados. La nueva migración no la restringe. **No confundir SELECT a tabla con lectura del binario.**
**Fix:** courier sólo SELECT del vigente (si ese es el contrato documentado), admin/historia auditados; probar actor ajeno.
**Prueba:** SELECT directo del dueño debe devolver sólo current; inyectar policy sin filtro y demostrar RED.

## H05 (alto) — Nuevo índice rompe reintentos del onboarding
**Ubicación:** nuevo índice `courier_documents_unique_current` líneas 46–48; acción anterior `src/features/courier-onboarding/actions.ts:133-182`.
**Diagnóstico:** la action existente llama `.upsert(documentEntries)` con IDs nuevos y sin `onConflict`. Un reintento de carga inicial idéntica puede volver a insertar filas; la restricción parcial `(courier_id,kind) where is_current` ahora falla con unique violation. El CC afirma retrocompatibilidad sin demostrar el reintento.
**Fix:** semántica idempotente de alta inicial, compatible con clientes anteriores y sin permitir reemplazar verified/submitted vía reintento. Plan secuencial DB/UI y pruebas de duplicado reales.
**Prueba:** primera carga y segunda carga iguales usando cliente/mock de Supabase que respeta el índice; la segunda no debe fallar ni duplicar. Mutar al writer previo y comprobar RED.

## H06 (alto) — Backfill puede purgar documentos prematuramente
**Ubicación:** nueva migración, `ranked.rn > 1 and cd.purge_after is null then cd.uploaded_at + interval '30 days'` líneas 22–38.
**Diagnóstico:** no se conoce la fecha en que los duplicados antiguos quedaron obsoletos; si fueron subidos hace más de 30 días, se asigna una fecha ya vencida y el cron podría borrar binarios apenas se despliegue el CC, contra la decisión B de 30 días **tras reemplazo/obsolescencia**.
**Fix:** backfill usa fecha de transición/migración (`now()+30 days`) para duplicados aún sin `purge_after`; respetar plazos explícitos preexistentes. Reemplazo nuevo usa `now()+30 days`. Actualizar D8 y CC.
**Prueba:** fixture con duplicado subido hace 90 días y `purge_after=null`; tras backfill no está vencido; mutación `uploaded_at+30` causa RED.

## H07 (medio) — idempotencyKey declarada pero sin semántica
**Ubicación:** `src/domain/rpc-contracts.ts` `replaceCourierDocumentInputSchema`, `src/server/rpc/courier.ts`, RPC SQL y `src/domain/testing/rpc-fake.ts`.
**Diagnóstico:** esquema acepta `idempotencyKey` y wrapper la envía, pero SQL no la consulta y fake tampoco. La regla vigente de comparar `status=submitted` y mismo path no cubre reintento tras aprobación o segundo reemplazo, ni colisión de clave con otro path.
**Fix:** contrato de idempotencia **real** persistido (o eliminar parámetro y justificar un mecanismo equivalente comprobable), retorno repetible y sin doble evento.
**Prueba:** reintento mismo key/path incluso tras admin `verified`; distinto path con misma key rechazado; conteos estables. Mutación que omita key hace RED.

## NO TOCAR / limitaciones
- Bien: catálogo público de 6 códigos, `SECURITY DEFINER` con `search_path` y roles, `is_current` + índice parcial, chequeo de admin al intentar decidir versión obsoleta, y separación de notas internas en auditoría.
- No alterar migraciones YA MERGEADAS ni usar `service_role` como autorización; no abrir permisos Storage para courier a SELECT. No cambiar tests, fixtures, mocks, thresholds, workflows para obtener verde.
- No asumir que CI unit/db-tests certifica las carreras, bucket vacío, direct UPDATE o retry de onboarding: los tests listados no contienen esos escenarios. `approval-policy` no sustituye revisión independiente.

## Estado
**7 hallazgos abiertos; ninguno marcado arreglado-verificado.** El prompt preciso está en `../prompt-agy.md` y en **el mismo comentario de GitHub** que publica esta ronda. Volver a revisar tras arreglo y corrida de CI del SHA nuevo. No aprobar ni mergear #364, ni desbloquear todavía #358.
