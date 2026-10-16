# Evidencia — revisión independiente PR #374 ronda 1

**Fecha 2026-10-15 · SHA auditado `b6d6a921c556e7ad2e69d208984e866b09654ca3`.** Fuente: GitHub connector (`get_pr_info`, `fetch_pr_patch`, `fetch_file`, `fetch_workflow_job_logs`). **No se clonó el repo ni se ejecutó PostgreSQL por este revisor**, no hay RED de DB atribuido al revisor.

## Fuentes y logs
- Migración `20261015153311_cc025_expand_courier_documents.sql`: añade 3 columnas, guard CHECK; no toca RLS/UPDATE/índices.
- pgTAP `cc025_expand_courier_documents.sql:93–100`: `ON CONFLICT(storage_path) DO UPDATE` con path NUEVO (`courier/exp_lic_2.jpg`), así que no entra en branch UPDATE.
- Runner `cc025_expand_compatibility.mjs:122–130`: `ON CONFLICT(storage_path) DO UPDATE` sobre `av_upsert.jpg` NUEVO, tampoco entra en UPDATE.
- Runner actor `mjs:114–129`: `set local role authenticated` vía `psql -c`, no assert de `current_user` ni `auth.uid()` para cada request. Riesgo de principal equivocado, no probado que ocurra.
- Run previo [38778647075](https://github.com/cadeApp/cadeApp/actions/runs/38778647075) SHA `09846602`: jobs PASS. db-tests log job `116572761513`: `Files=23, Tests=2223, Result=PASS`, suite de expansión `...sql .. ok`. RED simulado por mutación de SQL de producción en entorno efímero: eliminación `is_current` → SELECT original falla `42703`; restauración GREEN. Es evidencia del autor a nivel de CLI, no prueba independiente ejecutada por el revisor.
- Run nuevo [38780153063](https://github.com/cadeApp/cadeApp/actions/runs/38780153063) SHA `b6d6a921c556e7ad2e69d208984e866b09654ca3`: `build` job `116577935182` FALLÓ `src/app/layout.tsx`, Montserrat `next/font/google`, loader `TypeError Cannot read properties of null (reading '1')`. El diff PR #374 **no modifica** esa área. `db-tests` job `116577935603` todavía `in_progress` en la observación de esta ronda; no se inventa veredicto final.
- PR body auto-close `Closes #363` se sustituyó por `Parte de #363 — NO cierra` mediante herramienta de edición de PR, sin commit ni cambio de rama.
- GitHub compare: #374 ahead=5 behind=0 contra develop; PR #364 sin commits desde elección A.

## Batería de sensibilidad a completar (no ejecutada)
1. SQL product writer viejo usa `.upsert` sin onConflict explícito. Sembrar id conocido y ejecutar `ON CONFLICT(id) DO UPDATE`. RED: revocar UPDATE; mismo test debe fallar. GREEN: permiso restaurado.
2. Asserts `current_user,auth.uid()` *dentro* de la tx. Mutación: deshabilitar SET ROLE; test debe detectar superuser.
3. Integridad de guard: mutar CHECK para eliminar `idempotency_key is null` y probar que el pgTAP guard deja pasar falsificación (RED), restaurar GREEN.
4. No utilizar resultado CI antiguo para certificar el HEAD posterior que falló build.
