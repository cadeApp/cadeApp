# Revisión independiente — PR #374 / CC-025 fase A — Ronda 2

**Fecha:** 2026-10-15 · **SHA de implementación auditado:** `f8d338af2c72c64ffe8ccdead0d032c4700ff92d` · **PR:** https://github.com/cadeApp/cadeApp/pull/374.

## Dictamen: SIN BLOQUEANTES para la fase A — APTO PARA MERGE TRAS GATES DEL SHA NUEVO

La rama incorpora efectivamente un único commit correctivo desde la ronda 1. El alcance es la migración **EXPAND**, no el cambio completo CC-025. Se conservan la decisión A (expand→app→contract) y las decisiones previas del usuario. No se aprobó ni mergeó nada por el revisor. El merge debe ser ejecutado/autorizado por Lautaro073 y la secuencia de despliegues en cada ambiente continúa con gates manuales.

## Hallazgos H01–H03 revisados

### PR374-H01 — Resuelto por código + CI, sin mutación funcional independiente del revisor

**Archivo:** `supabase/tests/cc025_expand_courier_documents.sql`, `supabase/tests/integration/cc025_expand_compatibility.mjs`.

La suite dejó de usar `ON CONFLICT(storage_path)` sobre una fila inexistente como único proxy. Ahora usa `ON CONFLICT(id) DO UPDATE` con un ID nuevo para verificar inserción y **repite el mismo ID** para forzar colisión real. La política `courier_documents_write_admin` preexistente niega la rama UPDATE al courier con **42501**, sin alterar el `storage_path`; se afirma que queda una sola fila. Es correcto que el writer viejo sólo use la rama INSERT porque el código actual `actions.ts` llama `.upsert(documentEntries)` sin ID explícito y la columna ID tiene default UUID. Los tests y contrato ya distinguen claramente este caso, sin afirmar que puede actualizar filas existentes.

La integración `--mutation-check` revoca **UPDATE** en la base efímera: el viejo UPSERT sobre ID nuevo falla con 42501 (RED), restaura `GRANT UPDATE` y vuelve a pasar (GREEN). El job db-tests ejecutó efectivamente ambos controles en [run 38784606824](https://github.com/cadeApp/cadeApp/actions/runs/38784606824). La ejecución es del CI del implementador, no una mutación funcional corrida por este revisor.

### PR374-H02 — Resuelto por código + CI, sin mutación funcional independiente del revisor

El runner implementa `runSqlWithAuth` / `runSqlExpectingErrorWithAuth` con `BEGIN`, `SET LOCAL ROLE authenticated`, JWT `request.jwt.claims` y `DO` que comprueba `current_user='authenticated'` y `auth.uid()=courierId` **dentro de la transacción**, antes de escribir. La nueva prueba negativa confirma que un actor ajeno obtiene 42501 y no inserta filas. También se añadieron aserciones de `current_user` y `auth.uid()` a pgTAP. El log CI deja constancia de esos GREEN.

### PR374-H03 — Gate corregido; CI más reciente completamente verde

El fallo `next/font/google` de SHA anterior no está presente en SHA `f8d338af2c72c64ffe8ccdead0d032c4700ff92d`: [run 38784606824](https://github.com/cadeApp/cadeApp/actions/runs/38784606824) completó **SUCCESS** en `build` y el resto de los siete jobs. La falla anterior no se atribuye a la migración ni se justifican cambios fuera de alcance. El nuevo HEAD confirma compilación. No hubo una reproducción independiente del fallo original en esta sesión.

## Evidencia del SHA auditado (no extrapolada)
| Check | Resultado |
|---|---|
| typecheck, lint, build, audit, bundle-budget | SUCCESS |
| unit | **133 suites / 2328 tests PASS** |
| db-tests | **Files=23, Tests=2229, Result: PASS** |
| cc025_expand_compatibility.mjs | INSERT/UPSERT sin colisión, colisión 42501 bajo RLS, actor ajeno 42501, guard 23514: PASS |
| mutaciones efímeras | omisión de `is_current` produce 42703; revocación UPDATE produce 42501, restauración GREEN (visto en CI) |
| approval-policy | SUCCESS sobre SHA funcional |
| mergeabilidad técnica | compare base develop ahead 8 / behind 0; GitHub API mergeable=true, mergeable_state=unstable al consultar (no equivale a aprobación) |

No se levantó Docker/Supabase local por decisión del usuario, no se escribieron bases remotas, ni se ejecutó una nueva batería de mutaciones SQL por este revisor. La prueba está **fundamentada en código inspeccionado y CI real**, pero los tres `verificado_en_sha` se mantienen `null`, estado `arreglado-sin-verificar`; no equivale a falta de test del autor. Se ejecutó una batería **independiente estática** sobre fuente del HEAD remoto con 11/11 predicados de expansión, permisos, conflicto y JWT; mutación textual en memoria del guard idempotency_key cambió el predicado de GREEN→RED. Este detector estático **no** equivale a mutación funcional de PostgreSQL.

## Comprobación del alcance completo
Diff `develop...cc/CC-025-expand-courier-documents`: 3 columnas nuevas + CHECK temporal; **sin** `REVOKE UPDATE`, nuevos índices únicos, backfill ni RLS restrictiva de fase C. Tipos y tests correspondientes, runner, workflow aditivo, contrato de tres fases y bitácora. Los entregables independientes de `docs/revision-pr/pr-374/**` están separados. `develop` define que los cambios de contrato requieren un CC separado: esta PR es fase A del CC-025 ya aprobado por Lautaro073, no implementación general de T-356. **No cerrar #363 al mergear**. El body ya fue corregido en ronda 1 a "Parte de #363", y sus conteos de CI se actualizaron por agy a 23/2229.

## Gate antes del merge y continuidad obligatoria
1. Este commit de revisión mueve el HEAD y dispara nuevo CI. Exigir **checks verdes en el HEAD final**, no solamente el código `f8d338af2c72c64ffe8ccdead0d032c4700ff92d`. Si `next/font` falla de nuevo, resolver ese gate antes de fusionar; no deshabilitarlo.
2. Lautaro073 puede mergear **solo PR #374** a develop cuando quede verde, sin mergear #364 ni #358. La migración expansiva deberá estar realmente aplicada en el ambiente objetivo antes de pasar a fase B.
3. Después del merge y aplicación de A, preparar PR B desde develop actualizado, portar el writer `.insert()` seguro y verificar compatibilidad con DB expandida. **No comenzar fase C / REVOKE hasta B efectivamente desplegada/validada en cada ambiente objetivo**. No promocionar A+B+C de golpe a staging o producción.
4. Para staging/producción y cualquier ejecución real de migración, mantener autorización explícita de release y evidencia de SHA/versión de app; el hecho de mergear develop puede activar `migrate.yml` automáticamente. Coordinación humana obligatoria cuando se autorice.

**Conclusión:** sin bloqueantes nuevos ni decisiones de producto pendientes. No es aprobación formal ni ejecución de merge; cierre de ronda 2 favorable limitado a la fase A.