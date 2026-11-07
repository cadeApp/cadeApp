# Informe de revisión independiente — PR #500 / T-390 · ronda 1

**Fecha:** 2026-10-21 (Argentina).  
**Base:** `develop@3db48fbcf9fdebf58648411f8e312a2d94298af3`.  
**Primer SHA leído:** `fdafd1b02be4369cd566f1acc10558a295aef3f9`.  
**SHA revalidado al cerrar:** `e343f3456f540bfdb8195edb57dbc3c171d3d7c8`.  
**Resultado técnico:** **SIN BLOQUEANTES por inspección**, con H01 corregido por el autor durante la ronda y verificación SQL mutacional independiente aún no ejecutada. No hay aprobación ni merge.

## Lectura previa y alcance

Se leyó desde `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, ficha `docs/tasks/T-390.md` y contrato `docs/contracts/CC-036.md`. Se contrastaron la bitácora, los cuatro archivos modificados, las policies históricas de `offers` y el grant por columnas de CC-026.

Los cuatro archivos de tarea corresponden al alcance autorizado. La migración `20261021200000_cc036_offers_rpc_only.sql` elimina 4 policies de escritura y revoca `INSERT/UPDATE/DELETE/TRUNCATE` a `anon` y `authenticated`. Lectura por RLS y RPC `SECURITY DEFINER` quedan intactas. El `REVOKE UPDATE` de tabla **también** revoca los permisos por columna según documentación PostgreSQL y tests `has_column_privilege`. No se detectó alteración de secrets, RPC, control de precios, contracts TS o service role.

GitHub reportó rama con `behind_by=0`, `ahead_by=4` respecto a `develop` y PR mergeable; **no se ejecutó `git merge-tree` local** por indisponibilidad de acceso del contenedor al repositorio.

## H01 — Una aserción negativa no confirma el estado previo (corregido)

**Severidad:** medio (habría sido bloqueante del DoD). **Patrón:** `P08-control-no-cubre-lo-que-dice`.  
**Archivo inicial:** `supabase/tests/rls_matrix.sql:531-536`.  
**Otro archivo afectado:** `supabase/tests/cc036_offers_rpc_only.sql:167-178`.

En `fdafd1b`, el caso 50 usaba `isnt(message, 'still available')`. La fixture tenía `message = NULL`, por lo que el mismo check seguía verde si alguien cambiaba el mensaje por `'mensaje adulterado'`. Además, el pgTAP nuevo rechazaba el `UPDATE eta_minutes` con `42501`, pero no verificaba el ETA persistido tras el rechazo.

**El autor mejoró el arreglo en `e343f34`:**

1. La fixture ahora da a `offer_c2` el mensaje inicial explícito `'mensaje original c2'`.
2. El caso 50 exige `is(message, 'mensaje original c2')`; ya no permite el falso verde de otro texto.
3. El pgTAP CC-036 comprueba `eta_minutes = 15` tras recuperar `postgres`.
4. `plan(37)` y numeración de casos se ajustaron a la nueva aserción, manteniendo `rls_matrix.sql` en `plan(67)`.

**Evidencia propia:** comparación estática de ambas versiones + mutación semántica JS en memoria: mensaje adulterado difiere del original (el nuevo `is` queda rojo), y ETA `99 !== 15` (el nuevo `is` queda rojo). Las dos aserciones ya están en el SQL real del nuevo SHA. **Limitación:** no se corrió una mutación efectiva dentro de PostgreSQL/pgTAP; se registra el hallazgo como `arreglado-sin-verificar`, no como `arreglado-verificado`. La evidencia y el script independiente están en `../evidencia/comandos.md`.

Esta modificación de fixture es pertinente para afirmar el estado exacto; no cambia reglas RLS, RPC ni negocio.

## CI verificado por logs del proveedor

| SHA / run | Estado | Evidencia |
|---|---|---|
| `f15f9723` / [39701789632](https://github.com/cadeApp/cadeApp/actions/runs/39701789632) | RED esperado sin migración | `cc036`: `Failed 18/36`; `rls_matrix`: `Failed 4/67` |
| `9b9c41e2` / [39702356908](https://github.com/cadeApp/cadeApp/actions/runs/39702356908) | GREEN con migración | `Files=35, Tests=3056, Result: PASS`; ambos pgTAP `ok`, tipos sin diff |
| `fdafd1b` / [39704114188](https://github.com/cadeApp/cadeApp/actions/runs/39704114188) | GREEN | `Files=35, Tests=3056, Result: PASS`; `unit/typecheck/lint/build/audit/bundle-budget` también verdes |
| `e343f34` / [39705997023](https://github.com/cadeApp/cadeApp/actions/runs/39705997023) | `db-tests` en ejecución al escribir, otros checks verdes | No se atribuye GREEN de `db-tests` hasta leer log del SHA exacto |
| `fdafd1b` / [39704239240](https://github.com/cadeApp/cadeApp/actions/runs/39704239240) | `e2e-preview` bloqueado deliberadamente | `BLOCKED / REQUIRES DEVELOP MIGRATION` |

`approval-policy` permanecía rojo por falta del informe de revisión sin bloqueantes. El `Result: FAIL` intermedio en los logs del control de mutación CC026_H11 es el RED esperado; se sigue de GREEN restaurado. El E2E de tres specs `29 passed / 2 flaky` solo está declarado en la bitácora del autor, no se equipara a la suite oficial completa.

**Controles propios locales:** no se ejecutaron `pnpm`, Docker, Supabase o E2E. Se contrastaron logs oficiales y se corrieron verificaciones semánticas en memoria sobre el SQL leído. No inventar ejecuciones.

## D01 aceptada por Lautaro073 — opción A

La PR de migración bloquea legítimamente el `e2e-preview` al usar Preview contra Supabase Develop compartida sin garantía de esquema. Se admite **excepción premerge** de revisión, sin escribir `success` artificial ni cambiar el workflow.

**Obligaciones antes de producción:** integrar/aplicar la migración en staging por el flujo autorizado; correr y comprobar la suite **`e2e-staging` completa sobre el SHA desplegado**; si algo falla, bloquear promoción y corregir. No declarar como realizado lo que falta. Si `e2e-preview` es requerido por las reglas de la rama, la excepción tiene que procesarse por los mecanismos autorizados de GitHub; la decisión D01 por sí sola no satisface ese check.

**Comparación de alternativas:** B (base E2E aislada por PR) mejora pruebas premerge pero requiere infraestructura fuera de tarea; C (migrar Develop anticipadamente) pone en riesgo otras ramas compartidas; A preserva garantías DB y obliga validación en staging. D01 ya no está pendiente.

## NO TOCAR

- Ni nuevas policies ni RPC ni grants adicionales: la migración satisface CC-036 y la concesión por columnas queda revocada.
- No tocar workflows de E2E, fabricar statuses ni añadir tests con mocks/fakes que eviten la ruta real.
- T-408/T-409, producción, secretos y config de repositorio están fuera de esta PR.
- No son necesarios commits de código de la revisión: el autor ya corrigió H01.

## Entrega

Documentación de la revisión en `docs/revision-pr/pr-500/`, separada de código. El commit mueve HEAD y reactiva CI. El SHA inspeccionado para H01 es `e343f34`; **no se extrapolan resultados de CI al nuevo commit documental** ni se pide volver a correr CI *solo por documentación*. La PR queda sin aprobación ni merge.
