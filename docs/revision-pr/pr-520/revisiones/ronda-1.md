# Informe de revisión independiente — PR #520 / T-411 — Ronda 1

**Fecha:** 2026-10-22
**Head funcional inspeccionado:** `c8e546c0afe5db7ea9b036e8a732671660bbe6d9` (antes del commit de esta revisión)
**Base:** `develop` @ `93fc6153dad23d19ce04d0bc67d39a2d9992be1c`
**Contrato:** CC-038, propuesta aún en PR #519
**Resultado:** **CON BLOQUEANTES (1)** de integración; **sin defectos funcionales demostrados** en la inspección estática del diff.
**Decisión de Lautaro073:** **D01=A**, merge de #519 primero y después **merge de origin/develop en #520**, sin rebase.
**Permisos:** no aprobamos ni mergeamos esta PR; no tocamos código de producción.

## Ámbito y alcance

Se revisaron 19 archivos modificados y la compatibilidad entre `src/domain/rpc-contracts.ts`, el fake, wrapper, formulario, pgTAP, E2E y la migración. La rama cambió el HEAD de `3a33aff` a `c8e546c` mientras se revisaba: el último commit solo modifica la ficha y la bitácora por H03. Las pruebas de código en `3a33aff` son válidas para el código no alterado en `c8e546c`, pero **no se presentan como ejecución de tests sobre el nuevo SHA**.

No se levantó Supabase ni Docker; no se invocaron secretos ni endpoints remotos de datos. No fue posible clonar el repo desde este contenedor (sin DNS hacia github.com): la revisión de código es por GitHub y evidencia de CI. Sin repositorio local no se puede afirmar una ejecución propia de mutaciones.

## H01 — BLOQUEANTE de integración: contrato/documentación deben preceder

**Ubicación:** `docs/tasks/T-411.md:3` y `docs/contracts/CC-038.md`.
**Evidencia:** [ANÁLISIS + GitHub] La ficha y el CC no están aún en `develop`: PR documental #519 abierta, HEAD `6aa2785`, mientras #520 contiene la misma propuesta y cambia la ficha. El campo «Dependencias (mergeadas en develop)» no refleja la situación actual.

**Resolución D01=A:** revisión y merge de PR #519 primero. Después `git fetch origin`, `git switch feat/T-411-plan-code`, `git merge origin/develop` (sin rebase). Resolver el conflicto de `docs/tasks/T-411.md` tomando como referencia la ficha aprobada desde `develop`, y reintroducir únicamente la ampliación H03 ya autorizada. Comprobar `git merge-tree --write-tree origin/develop HEAD` sin conflictos; no promover ni aprobar #520 hasta entonces.

## H02 — EVIDENCIA DE CI CONFIRMADA: RED de la PR aislada #521

**Ubicación:** `docs/tasks/log/T-411.md` y tests asociados al CC-038.
**Evidencia directa de CI:**
- PR #521, SHA `744bc708421d9383adcc443d7bcb77cb2744c387`, job **119947923443** (sin migración): `cc038_publication_plan_code.sql` falla porque `app_private.publication_plan_code_base(text)` no existe. `plan(30)` pero se ejecuta **solo 1 aserción**, luego `Bad plan`. El runner informa `Failed 30/30 subtests`, que **no significa que 30 aserciones hayan corrido**. Las otras 36 suites de 37 quedan verdes, y el total del job es `Files=37, Tests=3102, Result: FAIL`. Es un RED válido para la ausencia de la migración.
- PR #520, SHA `3a33aff`, job **119947807622**: `CC038 RED: AssertionError «E8 altas de plan con el mismo nombre: las dos altas responden sin error»`, después `CC038 GREEN tras restaurar: base y base-2`; al final pgTAP `Files=37, Tests=3131, Result: PASS`. Se trata de la **batería del autor**, no independiente.
- PR #521, SHA `d7e1de3fd83cd5d180ef6df6c7bde27fd4fce713`, job **119954909638**: quita solo el advisory lock. Las 37 suites pgTAP pasan (`Files=37, Tests=3131, Result: PASS`). Luego el runner multisesión termina con `AssertionError [ERR_ASSERTION]: E8 altas de plan con el mismo nombre: las dos altas responden sin error`, y el job falla. El log también contiene fallas de mutaciones esperadas en otras suites y errores de descarga Docker al inicio que se resolvieron antes de ejecutar pruebas; la última falla atribuible a la mutación CC-038 es E8. La PR #521 ya está cerrada sin merge.

**Estado:** evidencia CI revisada y atribuida al control E8; no requiere que el autor la vuelva a ejecutar. No se integra la PR mutante. La batería distinta y propia del revisor propuesta en `evidencia/comandos.md` **no pudo ejecutarse** y no se registra falsamente como `verificado_en_sha`. Esa limitación queda explícita, pero el RED de la implementación ausente y el RED sin lock están documentados.

## H03 — ACEPTADO / DOCUMENTADO: ampliación de alcance

**Ubicación:** `docs/tasks/T-411.md:36` y `:48`.
**Evidencia:** [INSPECCIÓN] Commit `c8e546c` agregó explícitamente `runMutationChecks` y el resultado de `adminUpsertPublicationPlanRpc` en `actions.test.ts` a «Archivos permitidos», por decisión de Lautaro073. No exige reescribir el código; conservar estos permisos tras el merge de develop.

## Qué funciona / no modificar sin nueva evidencia

- `admin_upsert_publication_plan` mantiene firma y controles `security definer`, `search_path` y `assert_admin_aal2()`; el wrapper manda `p_code: null`.
- En la migración, `pg_advisory_xact_lock` protege la generación; `code` no se actualiza al editar. La interfaz elimina «Código» pero la tabla sigue exhibiéndolo.
- pgTAP cubre código derivado, sufijos, accesos al helper y auditoría. El fake usa el mismo mapa de caracteres. La cobertura CI de la PR es verde respecto del código funcional.
- No hay fundamento para eliminar `p_code` de la firma, generar códigos en cliente o quitar la protección de unicidad.

## CI con alcance exacto

| Fuente / SHA | Resultado leído | Límite |
|---|---|---|
| `unit` en `3a33aff`, job 119947807578 | 165 archivos, 3261 tests, PASS | No prueba PostgreSQL real |
| `db-tests` en `3a33aff`, job 119947807622 | 37 archivos / 3131 tests PASS; E8 mutación RED→GREEN | Batería del autor; no prueba revisión independiente |
| Primer RED #521 `744bc70` | Suite CC-038 aborta en primer helper faltante; otras 36 suites ok | No son 30 fallos individuales |
| Segundo RED #521 `d7e1de3` | E8 AssertionError tras pgTAP 37/3131 PASS; job FAIL | Evidencia por log de CI del autor, no mutación propia |
| `e2e-preview` | BLOCKED / REQUIRES DEVELOP MIGRATION | Comportamiento esperado mientras la migración no está desplegada en Develop |
| `approval-policy` | Fallo por informe independiente ausente | Este commit y comentario aportan la ronda; no equivalen a aprobación técnica |

## Comprobación de entregables

- Carpeta de revisión: `docs/revision-pr/pr-520/`.
- `hallazgos.jsonl`: H01 abierto; H02 con RED acreditado por log y sin mutación propia; H03 aceptado.
- La evidencia RED del autor se distingue de la verificación independiente.
- No se exigirá un nuevo CI verde **solamente** por escribir los archivos de revisión/bitácora.

## NO TOCAR

No corregir código de producción sin un defecto confirmado; no cambiar `src/types/database.types.ts`; no alterar otras suites, mocks o aserciones para fabricar verdes. La PR #521 es **REVIEW ONLY / NEVER MERGE**. No tocar `docs/revision-pr/**` desde el agente autor.

## Límites de verificación

No se ejecutaron pruebas locales, ni mutaciones propias, ni E2E local en este entorno. Esta ronda **no autoriza merge**. Se debe revalidar el nuevo HEAD funcional después de integrar #519 y confirmar que no se agregaron cambios fuera de alcance.
