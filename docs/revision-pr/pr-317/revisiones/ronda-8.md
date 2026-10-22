# Revisión independiente — PR #317 / T-340 — Ronda 8

**Fecha:** 2026-10-11. **SHA de implementación auditado:** `d5d002b56b2d4bd968d120cd0f8481f09539103e`. PR #317, paso 1/4, `feat/T-340-varias-entregas` → `develop` (base `7cf1a653dfa193f254d41611b47ae65930435b84`; sin commits pendientes de `develop` según comparación).  
**Resultado: SIN BLOQUEANTES TÉCNICOS.** No aprobar ni mergear por cuenta de esta revisión. **Queda trámite manual de aprobación vigente por Lautaro073** (`approval-policy` rojo, razón comprobada en log).

## H15 — verificado y cerrado

**Fuente:** `supabase/tests/integration/t340_concurrency.mjs:884–1048`, `.github/workflows/ci.yml:186–196`, `supabase/tests/t340_multi_drop.sql`, bitácora de sesión `2026-10-11 16:50`.

El autor implementó un modo `--mutation-check` ejecutado **dentro del mismo job `db-tests`** sobre la base Postgres efímera. No modifica migraciones versionadas, tablas de producción, secretos ni dependencias. Se recuperan definiciones originales con `pg_get_functiondef`; las redefiniciones con `CREATE OR REPLACE FUNCTION` se aplican y restauran en `try/finally`; la CI exige un fallo rojo específico y un verde posterior.

**Control real H13:**
- Mutante sobre `public.mark_drop_failed(uuid,text)`: sustituye **una sola** ocurrencia de `v_offer.courier_id is distinct from v_actor_id` por `false`.
- pgTAP bajo función mutada: **exit 1, `Failed test 50: "mark_drop_failed rechaza repartidor no asignado a la oferta aceptada"`**, además de los casos 51 y 53 dependientes.
- Función restaurada a su definición original: pgTAP **exit 0, `Result: PASS`, 77/77**.

**Control real H14:**
- Mutante sobre `public.mark_drop_delivered(uuid)` y `public.mark_drop_failed(uuid,text)`: elimina `FOR UPDATE` **solo** de la lectura de `delivery_requests` en ambas; preserva las lecturas bloqueadas de `delivery_request_drops`. Los dos objetivos deben existir exactamente una vez; de lo contrario falla CI.
- Runner mutado de dos sesiones: **exit 1** por **`Timeout esperando que waiter PID 1631 quede bloqueado por blocker PID 1632 con wait_event_type = 'Lock'`**, en el escenario H14-5.
- Definiciones restauradas y runner de nuevo GREEN: **H08 8/8 + H14 3/3**, exit 0.

**Controles independientes del revisor:** sobre el texto fuente del SHA (sin mutar DB local), se verificaron 14 propiedades del mecanismo H15 y cinco mutaciones adversariales **en memoria**: eliminar mutación productiva H13 o H14, quitar sus asserts RED y quitar restauración H14 hace que el detector se ponga rojo. Se leyó **el log REAL** de Actions, incluidas las líneas de `Failed test 50` y `Timeout`; por primera vez las salidas muestran RED de funciones SQL alteradas y GREEN tras su restauración. La verificación no depende solamente del resumen de la bitácora.

## Alcance y CI exacto

Entre la ronda 7 y la 8 cambiaron **solo cuatro archivos autorizados**: runner `t340_concurrency.mjs`, test pgTAP `t340_multi_drop.sql` (seed repetible), `.github/workflows/ci.yml` (paso nuevo en `db-tests`) y `docs/tasks/log/T-340.md`. No hay nuevo SQL de producto, contratos, app frontend/lectores, dependencias ni tareas futuras.

**CI exacto del código:** GitHub Actions run `38169704109`, `db-tests` job `114559541340`, 2026-10-11:
- Bootstrap: `Files=1, Tests=10, Result: PASS`.
- Suite inicial y suite FINAL tras mutantes: **`Files=21, Tests=1980, Result: PASS`**, 77 pgTAP T340.
- Runner inicial y final: **11/11 escenarios exitosos** (H08 8/8 + H14 3/3).
- Mutaciones: RED H13 específico → GREEN; RED H14 específico → GREEN, arriba desglosados.
- `pnpm db:types --local`, `git diff --exit-code -- src/types/database.types.ts`: sin drift; job exitoso.
- `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` y Vercel Preview Comments ✅. Supabase Preview SKIPPED.
- **`approval-policy` ❌** por mensaje literal del job `114559536674`: **«El PR requiere aprobación vigente de Lautaro073.»** `list_pull_request_reviews` devuelve lista vacía. **Esto es un requisito de aprobación humana, no un error de la implementación ni permiso para cambiar la policy.**

**Limitaciones:** no se corrió Docker/Supabase local por regla expresa; el CI efímero permitió reconstruir las pruebas reales. No se ejecutó `e2e-preview` aquí; el paso 1 es DB y compatibilidad legacy, y el job figura como skipped en esta corrida si aplica. El checkpoint de `develop` y el paso 2 sólo se realizan después de aprobación y merge.

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente, ronda 8

**Resultado: SIN BLOQUEANTES TÉCNICOS.**

Checks propios locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (**CI del SHA auditado:** typecheck/lint/unit/build/audit/bundle-budget ✅, **db-tests ✅ 1980 pgTAP + 11/11 carreras + RED→GREEN real H13/H14**).

**BLOQUEANTES DE CÓDIGO:** ninguno. Hallazgos H01–H15 verificados y cerrados.

**MEJORAS NO BLOQUEANTES:** ninguna necesaria para el paso 1. No ampliar alcance por estilo.  
**REQUISITO MANUAL ANTES DE MERGE:** aprobación vigente de Lautaro073 sobre HEAD actual/post-informe; `approval-policy` debe quedar verde. Si la propia aprobación se invalida con nuevos commits de revisión, obtenerla después de cerrar este informe. No alterar el job para saltear este control.

**No revisado / posterior al merge:** checkpoint `develop`, smoke legacy y coordinación de pasos 2–4. **Sin decisiones de producto pendientes.**
