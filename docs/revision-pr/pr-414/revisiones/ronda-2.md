# Ronda 2 — PR #414 / CC-031 (T-355) — 2026-10-18

**Informe revisar-pr — CC-031 / T-355 — revisión independiente · ronda 2**  
**Resultado: SIN BLOQUEANTES (0).** Se verificaron los 2 bloqueantes de la ronda 1 y su mejora documental. Queda 1 mejora nueva, no bloqueante, en el cuerpo de la PR.  
**SHA de código revisado:** `426d83877b7f5a4a83e4375abf5ab1d0bc19489b` (posterior al commit documental de ronda 1 y al addendum de CC-031).  
**Base:** `develop` `1958c9aba18543c233a8809385adb65adfd023f1`; PR #414 Draft y abierta al momento de la revisión.

## Resolución de los hallazgos anteriores

### H01 — RED→GREEN con la MISMA aserción, verificado mediante CI

**Archivo:** `supabase/tests/cc031_courier_display_name_guard.sql:41-51,143-157`; runner `supabase/tests/integration/cc031_profile_concurrency.mjs` (`runPgTapHarness`).  
**Estado:** **ARREGLADO-VERIFICADO** en SHA `426d83877b7f5a4a83e4375abf5ab1d0bc19489b` mediante logs y fuente inspeccionados.

El bloque con `isnt()` ahora se declara correctamente «prueba positiva de bypass deliberado» y se conserva como prueba adicional; no se lo toma por un RED independiente. El runner nuevo ejecuta exactamente la **suite original** contra la base de CI:
- Baseline: `Files=1, Tests=49, exit 0, Result: PASS`.
- Mutación: `ALTER TABLE public.profiles DISABLE TRIGGER guard_courier_display_name_update`; **misma suite, exit 1, Result: FAIL**. Incluye fallo **test 1**, `GREEN: direct courier name update rejected with exact non-sensitive error`, además de fallos de integridad relacionados.
- Restauración del trigger en `finally`: `Files=1, Tests=49, exit 0, Result: PASS`.
- El job restaura trigger y después ejecuta la suite completa, `Files=30, Tests=2815, Result: PASS`.

**Precisión de autoría:** la ejecución se realizó en el **runner de GitHub CI**, no por este revisor en su máquina. El revisor contrastó el código y cada salida del job `117603036050`. Esa evidencia objetiva cubre el control solicitado y queda anclada al SHA indicado.

### H02 — concurrencia real multisesión, verificada mediante CI

**Archivos:** `supabase/tests/integration/cc031_profile_concurrency.mjs`, `.github/workflows/ci.yml:235-236`.  
**Estado:** **ARREGLADO-VERIFICADO** en SHA `426d83877b7f5a4a83e4375abf5ab1d0bc19489b`.

El runner inicia **dos procesos independientes de psql** por caso, registra PID, consulta `pg_locks` + `pg_stat_activity.wait_event_type='Lock'`, exige bloqueo antes del commit y comprueba resultado persistido:

1. **A, courier phone vs nombre:** S1 guarda teléfono y retiene lock; S2 intenta cambiar `display_name`, espera y obtiene `42501/COURIER_DISPLAY_NAME_IMMUTABLE`; nombre inalterado, teléfono persistido. Log `06:16:53` GREEN.
2. **B, admin vs teléfono:** tras corrección administrativa bajo lock, actualización del teléfono no revierte el nombre. Log `06:16:54` GREEN.
3. **C, revocación de consentimiento vs teléfono:** S2 queda bloqueado y al reanudar recibe `42501 new row violates row-level security policy for table "profiles"`; consentimiento revocado y teléfono anterior intactos. Log `06:16:54` GREEN.
4. **Mutación independiente de A:** con trigger deshabilitado, S2 **sí sobrescribe** el nombre (RED en su invariante); tras restaurar trigger, mismo caso vuelve a GREEN. Log `06:16:54–55`.

La invocación nueva es **una sola línea de ejecución** añadida al job `db-tests` (sin editar thresholds, jobs, secretos o dependencias). Las rutas de integración y workflow fueron permitidas expresamente por el addendum de alcance de CC-031. Los tests antiguos de una sola conexión ahora se describen como **secuenciales**, sin hacerlos pasar por carreras.

### H03 — estado del contrato aclarado

**Archivo:** `docs/contracts/CC-031.md`.  
**Estado:** **ARREGLADO-VERIFICADO por inspección documental** (no hay runtime que validar).

El estado «NO IMPLEMENTADO» se identifica como **histórico de PR #413**. El nuevo encabezado declara PR #414 con implementación en rama, todavía **pendiente de merge/despliegue**, y E2E de T-355 todavía pendiente. No se inventó aprobación de un revisor ni despliegue en Supabase Develop.

## Nuevo hallazgo: mejora NO BLOQUEANTE

**PR414-H04 · BAJO · cuerpo de PR #414, líneas 21, 36, 58.** La descripción original sigue mostrando SHA `44285a896...`, «Sin modificaciones a workflows» y el informe inicial como si fuera la evidencia vigente; contradice el HEAD `426d83877b7f5a4a83e4375abf5ab1d0bc19489b` y la línea nueva de `.github/workflows/ci.yml`. **Arreglo mínimo:** actualizar cuerpo de PR con SHA y run actuales, mención del test de integración, y enlace al informe independiente de ronda 2. No requiere commit de código, mutación ni nuevo CI por sí solo.

## CI y alcance exactos

- **SHA:** `426d83877b7f5a4a83e4375abf5ab1d0bc19489b` · **GitHub Actions run:** [39103034249](https://github.com/cadeApp/cadeApp/actions/runs/39103034249) · **db-tests job:** [117603036050](https://github.com/cadeApp/cadeApp/actions/runs/39103034249/job/117603036050). `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests`, `approval-policy`: **SUCCESS**.
- **pgTAP final:** `Files=30, Tests=2815, Result: PASS`. `Vercel`: READY. `e2e-preview`: **ERROR/BLOCKED** porque el nuevo trigger aún no se aplica en Supabase Develop, escenario explícito para este CC; esto **no es E2E exitoso** y debe verificarse al continuar T-355.
- **Logs de otros tests con FAIL temporal:** pertenecen a controles de mutación deliberados T-340, CC-030, T-369, etc. Una señal `[H08/H14] Timeout...` en el mutante de T-340 fue aceptada como RED **de esa otra mutación**, y luego se verificó su GREEN `11/11 OK`; no es un fallo del escenario CC-031 ni un error oculto de la suite final.
- **Alcance total PR:** `.github/workflows/ci.yml`, `docs/contracts/CC-031.md`, migración CC-031, pgTAP CC-031, `supabase/tests/integration/cc031_profile_concurrency.mjs`, `supabase/tests/rls_coordinates.sql` y la documentación de revisión `docs/revision-pr/pr-414/**`. La adición de integración/workflow está autorizada expresamente por el addendum de CC-031. **No cambios de producción distintos de la migración nueva**, ni modificación de SQL histórico.
- **Mergeability:** GitHub informa `mergeable=true` al SHA revisado. No se ejecutó `git merge-tree` desde el contenedor (sin checkout Git), ni pgTAP local adicional; **la verificación funcional citada es la ejecutada en CI**, contrastada por este revisor.
- **Seguridad:** no se aprobó, no se mergeó, no se aplicó SQL remoto, no se iniciaron comandos Supabase administrativos.

## Veredicto

**SIN BLOQUEANTES TÉCNICOS de CC-031 en esta ronda**, según el diff, diseño y evidencia de CI inspeccionados. La única mejora es dejar el body al día (H04). El autor puede sacar la PR de Draft para revisión/merge ordinario **sin forzar ni omitir protecciones de GitHub**. Tras merge, verificar la migración aplicada por CI/entorno autorizado y retomar PR #410 con sus propias correcciones y E2E. Esta revisión **no autoriza** afirmar que T-355 está terminada ni que la migración ya está desplegada en Develop.
