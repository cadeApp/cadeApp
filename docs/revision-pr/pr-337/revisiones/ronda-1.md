# PR #337 — Ronda 1 de revisión independiente

**Fecha:** 2026-10-14 (zona America/Argentina/Tucuman); ejecución del CI durante 2026-10-15 UTC. **SHA de código revisado:** `a3c88ee3591b5ca6d5461dce5e96d21912941e5d`. **Base:** `develop@fbb6e5052a6473a0f7063e60a711b4fa452835f3`. **Autor PR:** Lautaro073. **Issue propio:** #336; relación contextual T-340.

**DICTAMEN: CON BLOQUEANTE DOCUMENTAL (1).** El cambio funcional satisface por inspección los requisitos de la regresión. Sin hallazgos funcionales o de seguridad demostrados. Esta ronda no aprueba ni mergea.

## Qué se verificó
- **Fichas y alcance:** leído `docs/tasks/T-340.md` desde `develop` y el issue de hotfix #336, que autoriza de manera independiente la **migración nueva**, **prueba pgTAP nueva** y tipos generados. Los cinco archivos de la PR corresponden a la solución de #336. No se altera un contrato existente ni una migración aplicada; ningún cambio a `docs/revision-pr/**` precedía al informe de esta revisión.
- **`src/features/admin/queries.ts`:** desaparecen `delivery_requests ( count )` y `.eq('delivery_requests.status', 'delivered')` del `select` de merchants; la página visible mantiene `limit(pageSize + 1)` y cursor `lt(profile_id)`. Se invoca exactamente una RPC con los IDs visibles, usando `createClient()`, sin `service_role`, con validación Zod estricta de `merchant_id` y `delivered_count` y propagación de errores.
- **`supabase/migrations/20261014180000_admin_merchant_delivered_counts.sql`:** función `STABLE SECURITY DEFINER`, `search_path = public, pg_temp`, `perform app_private.assert_admin_aal2()` antes de ejecutar la consulta, límite de 50 identificadores, rechazo de `NULL`, agregación solo de `dr.status = 'delivered'` con cero si no tiene entregadas. `REVOKE ALL ... PUBLIC, anon, authenticated` seguido de `GRANT EXECUTE ... authenticated`. No añade ningún `GRANT SELECT` de `delivery_requests`.
- **Pruebas:** `src/features/admin/queries.test.ts` ya no exige el embed roto; comprueba la llamada única, página vacía, paginación, errores y rechazo de PII adicional. La pgTAP nueva contiene 28 aserciones reales de privilegios, conteo, actores y privacidad.

## Evidencia independiente mediante GitHub Actions
- [CI green run 38664397611](https://github.com/cadeApp/cadeApp/actions/runs/38664397611) del SHA `a3c88ee3`: `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` **SUCCESS**. `unit` job 116192853547: **129 archivos / 2159 tests PASS**. `db-tests` job 116192853626: `admin_merchant_delivered_counts.sql .. ok`; **Files=22, Tests=2205, Result: PASS**, incluye generación de tipos `--local` y `git diff --exit-code -- src/types/database.types.ts` sin drift.
- [Mutación filtro PR #338](https://github.com/cadeApp/cadeApp/pull/338) cerrada sin merge, run 38664433423, job 116192969060: **RED, Tests=28 Failed=3 (6-8)** al eliminar `and dr.status = 'delivered'`.
- [Mutación guard PR #339](https://github.com/cadeApp/cadeApp/pull/339) cerrada sin merge, run 38664437244, job 116192980350: **RED, Tests=28 Failed=4 (19-22)** al eliminar `perform app_private.assert_admin_aal2();`.
- **Identidad de la suite:** comprobado blob SHA `a2ce1c86c080d0794f7af3669db22b9faadc3645` en las tres ramas #337/#338/#339: los mutantes no alteraron los tests.
- `approval-policy` del SHA funcional: **FAIL** por ausencia de informe independiente sin bloqueantes, coherente con esta revisión. Supabase Preview está omitido en PR. No hay E2E con cuenta admin AAL2 desplegada en staging.

## PR337-H01 — Falta sesión final de autor en bitácora (BLOQUEANTE DE PROCESO)
**Archivo:** `docs/tasks/log/T-340.md`. **Estado:** [ANÁLISIS], abierto.
**Diagnóstico:** La PR #337 aporta implementación, pruebas y CI, pero no toca la bitácora. El archivo en el propio HEAD de la PR termina en una sesión previa de escritor multi-drop; no documenta el hotfix #336 ni sus ejecuciones. La entrada `34558568` anterior es el **diagnóstico del problema** en otra línea de trabajo, no la constancia de implementación de esta PR. El cuerpo de la PR es evidencia útil, pero no reemplaza la sesión de cierre de la bitácora exigida por el método de revisión.
**Arreglo exacto:** agregar sin sobrescribir historial una entrada final `#336 / PR #337` en `docs/tasks/log/T-340.md`: Hecho (RPC + query admin + tests + tipos), Pruebas (SHA/runs/RED→GREEN precisos y limitación del revisor), Falta (migrar y validar en staging con admin AAL2), Último commit. No afirmar que la ruta se ha probado contra staging. Solo esa bitácora; no alterar SQL, permisos o tests.
**Prueba:** `git diff origin/develop...HEAD --name-only` debe listar la bitácora después del nuevo commit; verificar que la entrada está presente y contiene hechos comprobables.

## Limitaciones y NO TOCAR
- Sin clon local por falta de conectividad Git desde el entorno de revisión: **no** se ejecutaron `pnpm`, Docker, Supabase local, ni mutaciones del revisor. Los resultados reflejan los logs auténticos del CI del SHA exacto, no una ejecución independiente local.
- No ejecutar ninguna mutación real en Supabase remoto, no levantar Docker local según instrucciones, no ampliar grants ni usar `service_role`.
- **No es bloqueante previo al merge:** faltan la migración de Develop/Staging y una visita admin AAL2 a `/admin/merchants`, que son gates **posteriores** a un merge autorizado. Mantener #336 abierto hasta cumplirlos.
- **No exigir cambio:** el contador es de **solicitudes** entregadas, no de drops individuales; el issue #336 lo define expresamente.
- No se identificaron decisiones de producto/arquitectura pendientes para Lautaro073.
