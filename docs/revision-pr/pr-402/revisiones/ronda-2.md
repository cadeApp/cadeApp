# PR #402 — Revisión independiente, ronda 2 · T-369 UI (CC-029)

Fecha 2026-10-17. **HEAD de código inspeccionado:** `5e14b05c843fd8021881db5ef50a886e4d240a35`. Rama `feat/T-369-ui`. **Resultado: CON BLOQUEANTES (2)**: H02 (parcial) y H04 (parcial). **D01-B fue aprobada por Lautaro073 y está implementada en código**, pero falta el control RED SQL de seguridad.

## Estado de los hallazgos de ronda 1

| ID | Estado | Evidencia y alcance |
|---|---|---|
| H01 | arreglado-sin-verificar | `publication-credits-dialogs.tsx:64-121,182-224,396-438`: Web Crypto digest de payload, `sessionStorage` antes del envío, reusa operationKey ante resultado incierto; borra solo tras resultado definitivo. Tests de remount/refresh incluidos. Limitado a pestaña actual. |
| H02 | **PARCIAL / bloqueante** | `trip-merchant-container.tsx:53-55` ahora muestra `replaceError` al recibir `{ok:false}`, y tests cubren retry/cierre. **No** captura excepciones de transporte de `merchantReportNoShowAction` en línea 43, por lo que el fallo de red no deja un error recuperable en el diálogo. |
| H03 | arreglado-sin-verificar | `admin_list_publication_plans` SQL usa keyset `(sort,id)`, `limit+1`, devuelve cursor y `activeOnly`; `/admin/merchants/plans` usa navegación y selector carga más. 151 planes pasan pgTAP en CI anterior. Falta mutación SQL específica, agrupada en H04 como control faltante. |
| H04 | **PARCIAL / bloqueante** | Migración forward-only `supabase/migrations/20261017200000_t369_admin_list_publication_plans.sql:9-80` define `SECURITY DEFINER`, `search_path`, `assert_admin_aal2` antes de la consulta, `REVOKE` y `GRANT EXECUTE`; `src/features/admin/queries.ts:639-648` usa cliente de sesión sin service role. 29 pgTAP D01-B pasaron en CI anterior. La bitácora reconoce **pendiente el RED real SQL** quitando autorización/ordenación/otorgando SELECT. Un test verde no basta para demostrar que esas aserciones detectan regresiones de autorización. |

## H02: reproducción lógica (no runtime)

En `handleReportNoShow`, `startTransition(async () => { const res = await merchantReportNoShowAction(...); if (res.ok)... else setReplaceError(...) })` no tiene `try/catch`. Si Server Action rechaza por caída de red o fallo de ejecución no encapsulado, el callback lanza, no invoca `setReplaceError`, y el mensaje persistente `role=alert` no aparece. El nuevo test solo simula `mockResolvedValue({ok:false,...})`, no `mockRejectedValue(...)`. Corrección mínima: `try/catch` con error genérico seguro y persistente en diálogo, `finally` si se agrega estado, no repetir operación accidentalmente; test de rechazo y mutación RED eliminando catch.

## H04: control de sensibilidad de tests que falta

La bitácora `docs/tasks/log/T-369.md:314-328,341-342` registra mutación R12 **estática** de `assert_admin_aal2()` y 29 pgTAP verdes, pero declara pendientes las mutaciones sobre SQL ejecutado en Postgres. Requeridas tres observaciones usando la MISMA suite y una DB efímera, sin cambiar aserciones:

1. Quitar `perform app_private.assert_admin_aal2()` de la función **instalada temporalmente en DB descartable** → el acceso no autorizado de usuario con sesión autenticada debe fallar el test por exceder permisos. No aceptar rechazo por sintaxis o timeout como RED.
2. Permitir por mutación temporal `SELECT` directo a `authenticated` → el test de bypass de tabla y privilegios debe fallar; tras revertir → verde.
3. Quitar la condición lexicográfica del cursor o el desempate por `id` → la paginación de 151 planes debe fallar con filas omitidas/duplicadas o orden incorrecto; tras revertir → verde.

Estas son mutaciones de **DB descartable**; jamás aplicarlas a Develop/staging/producción ni commitear mutantes a la PR definitiva. Si no hay posibilidad de ejecutarlas con herramientas actuales, declarar bloqueo de evidencia, sin afirmar que ya se hizo RED.

## CI y límites de la revisión

- Código del primer arreglo en `0963851c` y merge de develop `acfe3e07`, [run 39082622452](https://github.com/cadeApp/cadeApp/actions/runs/39082622452): typecheck, lint, unit, build, audit, bundle-budget, db-tests exitosos; `Files=29, Tests=2764` en db-tests según bitácora/cuerpo de PR. Contratos tipados regenerados y comprobados sin diff en CI. Se inspeccionaron los nuevos pgTAP 151 planes y la migración SQL.
- HEAD `5e14b05`: [run 39083269785](https://github.com/cadeApp/cadeApp/actions/runs/39083269785), en la consulta typecheck, lint, unit, build, audit y bundle-budget success; **db-tests aún IN PROGRESS**. No declarar su resultado verde hasta que termine. `approval-policy` failure por informe pendiente y `e2e-preview` error `BLOCKED / REQUIRES DEVELOP MIGRATION` (nueva migración aún no aplicada a Develop).
- Branch HEAD incorporó develop (base `0488f8a`), sin divergir al último check. La comparación desde commit de revisión de ronda 1 incluye merges de tareas T-370/T-371; la revisión se centró en el diff propio y efectos identificados.
- No se ejecutaron Docker, Supabase local, SQL, pnpm ni tests de componente desde esta sesión. Los GREEN citados provienen de CI y los riesgos de inspección. No modificar código en la revisión.

## Decisiones y dictamen

**D01-B permanece cerrada y correctamente implementada** en el diseño actual. No se necesita decisión comercial ni de arquitectura. **CON BLOQUEANTES (2)** por la ruta de excepción de no-show y la ausencia de RED runtime de SQL que exige el DoD. Agregar solo pruebas/catch/harness para esos dos puntos, sin reescribir backend ni cambios de negocio, y publicar SHA + evidencia para nueva ronda. No aprobar ni mergear.