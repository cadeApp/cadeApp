# Revisión independiente — PR #361 / T-364 — Ronda 4

- **Fecha:** 2026-10-15
- **Autor de la PR:** @asako669 (P2)
- **HEAD efectivamente inspeccionado:** `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3`
- **Base:** `develop` @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b`
- **Resultado:** **CON BLOQUEANTES (1 pendiente: PR361-H12, E2E Preview sin resultado real). NO MERGEAR.**
- **🔵 DECISIONES:** ninguna. No hay decisión de producto o de contrato pendiente; el cierre exige ejecución y evidencia, no más código por especulación.

## Cambios contra la ronda 3

El autor añadió dos commits: `71302323eb3cc69cf7879d1a16adc50ad084463f` (código) y `2ce18ac6e98ecbc4ae08b6ccbf43f70127ae75c3` (bitácora). Solo tocó `e2e/specs/request-states.spec.ts`, `src/features/requests/components/merchant-requests-list.test.tsx` y `docs/tasks/log/T-364.md`. **No tocó `docs/revision-pr/**` ni ningún archivo ajeno al alcance.** No hay nuevos desvíos de ficha, CC ni cambios de migraciones/RPC/RLS.

## Revisión de hallazgos

| Hallazgo | Estado de Ronda 4 | Evidencia |
|---|---|---|
| H01/H05 | **Parcial** | La cancelación desde lista, modal de dos pasos, acción, segundo merchant, contadores e historial ya están representados en pruebas y código; falta **ejecutar E2E real** y registrar su resultado |
| H02–H04 | Arreglado sin verificar independientemente | Aislamiento, `code`, expiración vigente/vencida presentes; sin mutaciones propias |
| H06–H10 | Arreglado sin verificar independientemente | Reset, exclusión síncrona, catch, mock de action y 48px conservados; test unitarios CI PASS, mutaciones solo declaradas por autor |
| **H11** | **Arreglado por inspección, sin verificar E2E** | En `e2e/specs/request-states.spec.ts:879–920`, el selector de solicitud contiene `requestId`, se toma `Solicitudes activas` antes/después y se encuentra en historial la misma solicitud por enlace; `toContainText('Cancelada')` ahora está limitado a esa fila. Se eliminó el falso oráculo de tab |
| **H12** | **PARCIAL — ÚNICO BLOQUEANTE VIGENTE** | Se eliminó el `if (...) else { rpc() }`; usuario y página Playwright son obligatorios, y el click se acota por `requestId`. Sin embargo **no hay ejecución GREEN** del flujo en el entorno autorizado. El propio autor reporta fallo local: `[E2E Fail-Closed] Operación prohibida: Proyecto Supabase 'desconocido' ...`. No existen SHA+run+resultado en bitácora, ni contexto `e2e-preview` en commit statuses del HEAD |
| **H13** | **Arreglado por inspección, sin mutación independiente** | En `merchant-requests-list.test.tsx:657–664`, `Promise<Awaited<ReturnType<typeof cancelMerchantRequestAction>>>` reemplaza el `as any`; el autor relata mutación TS2353, no reproducida aquí; CI typecheck PASS |

## Evidencia CI y grado de certeza

- CI de GitHub del SHA revisado: **run [38683222503](https://github.com/cadeApp/cadeApp/actions/runs/38683222503)**. Al consultar, typecheck, lint, build, audit, bundle-budget y unit estaban **success**; db-tests seguía **in_progress**, por lo que no se presume su cierre.
- Log `unit`: **129 archivos / 2180 tests PASS**. Vercel Preview informó `success`, pero Vercel desplegado **no es** un resultado de E2E.
- Revisé `.github/workflows/e2e-preview.yml` en `develop`: el E2E corre solo si entra un evento confiable `repository_dispatch` de Vercel, contra la SHA del Preview, y publica el commit status **`e2e-preview`**. **El status no figura** en `get_commit_combined_status` para este HEAD; solo `Vercel – cadeapp-staging: success`. Los jobs de CI general no ejecutan ese test Browser.
- El autor documentó honestamente el fail-closed local y no simuló credenciales. Eso **es correcto**, pero el DoD exige resultado en Preview/Develop.
- Revisión **estática remota + consulta de CI**, no clon local/Playwright/mutación independiente. `verificado_en_sha` de H01–H13 sigue en `null`. No atribuyo a la revisión ejecución ajena ni invento GREEN.

## Bloqueante único: PR361-H12 — E2E real no demostrado

El defecto de código original H12 está subsanado. **El bloqueo es de evidencia y validación operacional**, no una sospecha de vulnerabilidad.

**Para cerrar:** 
1. Comprobar que el deployment Vercel Preview del SHA exacto publicó un evento `vercel.deployment.ready/success` a `.github/workflows/e2e-preview.yml` y que `e2e-preview` corrió en el Environment `develop` contra Supabase Develop (distinto de staging y producción). No exponer secrets.
2. Obtener `e2e-preview` commit status **success** y URL del workflow con log real, job/run, SHA de la versión probada y test T-364. Verificar en el log que `T-364` fue descubierto y completó el flujo UI sin fallback. Adjuntar oráculos: solicitud vinculada por requestId, contador antes/después, historial en enlace idéntico, `cancelled_at`, motivo, oferta expirada y `UNAUTHORIZED_ACTOR` del segundo merchant.
3. Si no se dispara `e2e-preview`, diagnosticar la integración/evento/Environment sin **desactivar checks ni modificar workflows** desde este PR. Si requiere permisos del propietario, informar **🚨 ACCIÓN MANUAL** concreta para reactivar webhook o ejecutar el gate oficial. El test local con Supabase desconocido debe permanecer fail-closed; **no** introducir secretos ni bypass para hacerlo pasar.
4. Cuando haya resultado real, solicitar revalidación independiente sobre el SHA de ese run; entonces podrá evaluarse merge. Se debe considerar cualquier nuevo commit de documentación que mueva HEAD.

## NO TOCAR
- H11 y H13 no precisan otro refactor de código para los síntomas revisados.
- No sustituir el E2E por un RPC test, no generar logs ficticios, no crear shortcuts en CI, no cambiar `Playwright` timeout o mocks.
- Ninguna modificación de `AGENTS.md`, contratos, migraciones, workflows o secretos es parte de esta revisión.

## Conclusión

**Todavía NO MERGEAR** por H12 exclusivamente. Ya no encontré nuevos bloqueantes de implementación por inspección. **Sin decisiones 🔵.** No aprobé ni mergeé.
