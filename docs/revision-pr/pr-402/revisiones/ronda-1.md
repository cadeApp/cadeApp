# Revisión independiente PR #402 — T-369 UI / CC-029, ronda 1

**Fecha:** 2026-10-17. **HEAD de código auditado:** `81f277970928dc50ddb1fcea709bf0319f9e6f64`. Rama `feat/T-369-ui` → `develop`. **Resultado:** CON BLOQUEANTES (4) y decisión D01-B cerrada.

## Decisión humana previa a cerrar la ronda

**D01-B, aprobada expresamente por Lautaro073:** reemplazar la lectura con service role de `publication_plans` por una RPC dedicada `admin_list_publication_plans` que verifique rol admin y MFA AAL2 en PostgreSQL. Autoriza **ampliación técnica acotada** del paso UI para nueva migración forward-only, addendum del contrato CC-029, tipos/Zod/fake/wrapper y pruebas asociadas. No autoriza dar SELECT directo en tabla, quitar RLS, tocar la migración mergeada o cambiar el piloto. La nota de la rama que atribuía al usuario la preferencia de service role queda **superada** por D01-B. No hace falta otra pregunta.

## Hallazgos

### PR402-H01 — ALTO — La clave de idempotencia de acreditación/plan se pierde al remontar el diálogo o recargar la página

- **Referencia:** `src/features/admin/components/publication-credits-dialogs.tsx:39`.
- **Causa / riesgo:** useOperationKey almacena operationKey y fingerprint únicamente en useRef y descarta la referencia al desmontar GrantCreditsForm/RegisterPeriodForm; la semántica exactly-once solo cubre reintentos dentro del mismo montaje.
- **Evidencia por inspección (no runtime):** src/features/admin/components/publication-credits-dialogs.tsx:39-51 crea ref local; :83-92 y :247-255 desmontan el formulario al cerrar; :125 y :290 usan la key generada. Los tests existentes repiten envío con el diálogo montado; no cubren desmontaje/recarga tras confirmación con respuesta perdida.
- **Corrección exigida:** Conservar operationKey estable hasta obtener resultado definitivo, incluso si se reabre o recarga durante el mismo proceso. Vincular merchant, tipo de operación y payload canonizado mediante fingerprint no sensible; no guardar nota libre ni secretos en storage. Tras éxito confirmado, limpiar pendiente para permitir una nueva compra idéntica con una clave nueva; ante estado incierto, ofrecer reintentar explícitamente con la misma clave. Probar pérdidas de respuesta, desmontaje/remontaje, recarga y operaciones distintas.
- **Estado:** abierto. No se fabricó un RED local; agy debe producir la prueba en rojo sobre comportamiento defectuoso y verde posterior, con las mismas aserciones.

### PR402-H02 — MEDIO — Un error al reportar no-show desde el diálogo solo se comunica con un toast genérico

- **Referencia:** `src/features/trips/components/trip-merchant-container.tsx:50`.
- **Causa / riesgo:** handleReportNoShow usa notify.error genérico y no actualiza replaceError; el diálogo se mantiene abierto pero no ofrece mensaje persistente del error RPC.
- **Evidencia por inspección (no runtime):** src/features/trips/components/trip-merchant-container.tsx:39-54 rama de error solo notify.error('No se pudo reportar...'), mientras el diálogo renderiza errorMessage en :114-121 si replaceError fue actualizado; eso solo ocurre en handleConfirmReplace.
- **Corrección exigida:** En la rama de rechazo de merchantReportNoShowAction setReplaceError(getDomainErrorMessage(res.code)) cuando replaceOpen sea verdadero (y estado de créditos según código), mantener diálogo abierto y role=alert; limpiar al reintentar o cerrar. Añadir prueba con rechazo específico, sin ejecutar republish_request por error.
- **Estado:** abierto. No se fabricó un RED local; agy debe producir la prueba en rojo sobre comportamiento defectuoso y verde posterior, con las mismas aserciones.

### PR402-H03 — MEDIO — El catálogo está limitado a 100 planes sin paginación ni recuperación de registros restantes

- **Referencia:** `src/features/admin/queries.ts:676`.
- **Causa / riesgo:** getPublicationPlans() termina en .limit(100) sin cursor, nextCursor ni listado buscable; PublicationPlansManager y RegisterPeriodDialog dependen del conjunto truncado.
- **Evidencia por inspección (no runtime):** src/features/admin/queries.ts:671-676 usa limit(100); src/features/admin/components/publication-plans-manager.tsx:60-105 itera todas las filas recibidas sin load more; src/features/admin/components/publication-credits-dialogs.tsx:262 consume planes activos recibidos sin paginación.
- **Corrección exigida:** Usar consulta paginada con orden estable sort,id y nextCursor; en catálogo botón o enlaces para seguir páginas. En diálogo de registro permitir buscar/cargar más planes activos, no solo los 50 iniciales. Test con 101/151 planes, sort duplicado, plan activo página 3 y sin pérdida/duplicación.
- **Estado:** abierto. No se fabricó un RED local; agy debe producir la prueba en rojo sobre comportamiento defectuoso y verde posterior, con las mismas aserciones.

### PR402-H04 — ALTO — La lectura con service role no satisface la arquitectura D01-B aprobada; falta RPC de listado con permisos DB

- **Referencia:** `src/features/admin/queries.ts:667`.
- **Causa / riesgo:** El agente agregó en docs/tasks/T-369.md una decisión de usar createAdminClient para leer publication_plans, inexistente en CC-029, y consulta con privilegios que omiten RLS. Lautaro073 resolvió D01-B: reemplazarlo por RPC SECURITY DEFINER que valide admin AAL2.
- **Evidencia por inspección (no runtime):** src/features/admin/queries.ts:633-675 hace auth en Next y llama createAdminClient() desde lectura; docs/tasks/T-369.md de PR en el apartado 'Decisión del paso 2' lo presenta como decisión del usuario; docs/contracts/CC-029.md:182-190 enumera RPC sin admin_list_publication_plans. No se demostró bypass actual: la comprobación admin+AAL2 previa sí existe.
- **Corrección exigida:** Crear nueva migración forward-only *_t369_admin_list_publication_plans.sql que agregue RPC con app_private.assert_admin_aal2(), SET search_path seguro, grants EXECUTE solo authenticated y revokes de lectura tabla; consulta paginada (sort,id) y activeOnly. Actualizar CC-029 con addendum explícito D01-B, ficha T-369, domain Zod/RPC_CONTRACTS, fake, wrapper en src/server/rpc/admin.ts, query server con cliente de sesión, tests pgTAP y TS, db:types; eliminar getPublicationPlans con service role; jamás tocar migración mergeada.
- **Estado:** abierto. No se fabricó un RED local; agy debe producir la prueba en rojo sobre comportamiento defectuoso y verde posterior, con las mismas aserciones.

## CI y límites

- **Checks reales previos al commit de revisión:** sobre `81f27797`, `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` y `db-tests` PASS. Job unit [117482862760](https://github.com/cadeApp/cadeApp/actions/runs/39062365789/job/117482862760): 145 archivos, 2718 tests PASS. DB job [117482862558](https://github.com/cadeApp/cadeApp/actions/runs/39062365789/job/117482862558): 29 archivos, 2735 pgTAP PASS; runner multisesión T-369 8/8 PASS. `approval-policy` FAIL por falta de informe de revisor en el body, no por aprobación denegada de un par.
- **No** se ejecutaron pnpm, Supabase local, Docker ni tests de UI desde esta sesión. Los hallazgos son por inspección de código real y ausencia de cobertura específica. Los GREEN existentes no reemplazan los RED faltantes.
- `origin/develop` observado en `fec1e7e` y branch HEAD divergió: 4 commits por delante / 13 detrás. Es necesario merge de `origin/develop` (sin rebase, force ni amend), resolver conflicto si lo hubiere y validar los cambios que resulten.
- `e2e-preview` estaba pending; no se lo declara verde. Paso 3/3 conserva pruebas E2E completas y staging.
- No se encontró carpeta `docs/revision-pr/pr-402/` escrita por agy. No se hicieron cambios al código ni a la política.

## Seguridad de D01-B y contrato exacto para agy

1. Migración nueva `supabase/migrations/<timestamp>_t369_admin_list_publication_plans.sql` (timestamp no colisiona con develop; no editar migraciones existentes). Declarar `public.admin_list_publication_plans(p_limit integer default 50, p_after_sort integer default null, p_after_id uuid default null, p_active_only boolean default false) returns jsonb` con `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `app_private.assert_admin_aal2()` **antes** de leer el catálogo; validar `1≤limit≤50` y cursor completo/nulo en pares, `VALIDATION_ERROR` si no, usar orden `(sort ASC, id ASC)` y filtro de cursor lexicográfico estable; devolver `{items, nextCursor}` validable por Zod. Nunca construir SQL con string del cliente.
2. Otorgar `EXECUTE` únicamente a `authenticated` (revocar `PUBLIC`, `anon`); no añadir `SELECT` directo de `publication_plans` a roles de usuario, mantener RLS y deny-all. No exponer funciones de helpers, claves ni usar `createAdminClient()` en la consulta de planes.
3. Actualizar `docs/contracts/CC-029.md` con **addendum D01-B** (sin reescribir decisiones históricas) y `docs/tasks/T-369.md` para autorizar las rutas técnicas estrictas. Actualizar `src/domain/rpc-contracts.ts`, fake y pruebas de dominio, `src/server/rpc/admin.ts` y tests, `src/features/admin/queries.ts` + tests, UI de catálogo/registro y pruebas. `pnpm db:types` solo para la nueva migración y comparar diff legítimo.
4. pgTAP con clientes `anon`, comercio AAL1/AAL2, admin AAL1/admin AAL2; denegar todos salvo admin AAL2 y siempre denegar SELECT directo. 151 filas con sort repetido y activos/inactivos, 4 páginas de 50, sin filas omitidas/duplicadas, filtro activeOnly; probar que mutar guard AAL2 devuelve RED **sin tocar la expectativa**. Datos efímeros.

## Dictamen

**CON BLOQUEANTES (4)**. D01-B humana cerrada. No aprobar, no mergear, no activar pagos/piloto ni cerrar #356. Prompt de corrección y evidencia van en el mismo comentario de GitHub. Nueva ronda independiente sobre nuevo SHA luego de arreglos.