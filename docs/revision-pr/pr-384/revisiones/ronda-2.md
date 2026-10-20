# Informe de revisión — PR #384 / T-357 — Ronda 2

**Fecha:** 2026-10-16 (hora Argentina). **SHA del código revisado:** `fddaca33a97445290aba2cb3f0f1feac5500aa43`. **Base:** `develop` @ `cc7fb54bf24b33f00d06801025bae7f07429e9e4`. **Estado: NO MERGEAR TODAVÍA.**

## Metodología y conflicto resuelto

Al comenzar este turno, la PR mantenía HEAD `0c5288c` y GitHub `mergeable=false` porque `develop` había cambiado cinco archivos: `actions.ts`, `actions.test.ts`, `components.test.tsx`, `courier-profile-view.tsx` y `e2e/specs/courier-onboarding.spec.ts`.

Se preparó merge de tres vías usando como ancestro `81e5ca6`, `develop` `cc7fb54b` y PR `0c5288c`. Se conciliaron los imports en `actions.ts` y `actions.test.ts` y se integraron los hunks no superpuestos de los demás; se construyó un merge commit con **dos padres** en `96dcc44bae66491d9223727863a2b633b95466ef`, se movió únicamente la rama de PR y se comprobó vía GitHub que está 0 commits detrás de develop y `mergeable=true`. **No hubo push a develop ni rebase ni force-push.**

El revisor implementó correcciones (no se deben presentar como verificación independiente de otra persona): aplicación `828b7ab1`, tests `fddaca33`. Las pruebas de mutación propias aquí son de **inspección estática**, no un runtime independiente; ese límite se conserva para decidir merge.

## H01 — Alta incompleta no puede usar la edición

**Estado: arreglado-sin-verificar**, riesgo original alto.
- En `updateCourierVehicleAction`, lectura real de `vehicle_type`, falla ante null y ante `rejected`/`suspended`; se repite la condición de estado y `vehicle_type IS NOT NULL` en el UPDATE.
- La página deja de considerar `?mode=edit` una autorización.
- Nuevos tests unitarios prueban ausencia del marcador, estados no aptos y query maliciosa; unit run pasó, pero no se ejecutó una mutación runtime independiente sobre esos tests.
- Verificar E2E o PostgREST con courier real `vehicle_type:null` y constatar 0 escrituras en DB, sin introducir ni usar service role en action.

## H02 — Edición documental al margen de CC-025

**Estado: arreglado-sin-verificar**, riesgo original alto.
- El esquema de edición es estricto y solo acepta `vehicleType` y `vehiclePlate`.
- `updateCourierVehicleAction` ya no llama a `courier_documents`.
- Las tarjetas de licencia/seguro permanecen en **alta** cuando son opcionales conforme D9, no en edición; no se altera el flujo de RPC del onboarding de CC-025 procedente de develop.
- Unit tests rechazan payload `documents` y no ofrecen tarjetas en edición; en espera de cobertura E2E y mutación runtime.

## H03 — Éxito con cero filas actualizadas

**Estado: arreglado-sin-verificar**, riesgo original medio.
- UPDATE filtra por actor, `vehicle_type IS NOT NULL`, estado permitido, exige `.select('profile_id').maybeSingle()` y compara `profile_id` con la sesión.
- Casos unitarios distinguen `error` (INTERNAL_ERROR) y `data:null` (NOT_FOUND), con mock PostgREST de cadena explícita.
- Falta reproducción runtime independiente para carrera / UPDATE cero filas bajo RLS; no es legítimo llamarlo verificado únicamente con el mock.

## H04 — E2E/DoD completo todavía no demostrado

**Estado: ABIERTO (BLOQUEANTE alto).**
- El seed E2E del caso T-357 verifica `error` y 1 fila. Después de `moto→bike`, se recarga el perfil y se consulta el registro con admin para comprobar `bike`, patente null y `approved`. Es una **mejora real** respecto de R1.
- Falta probar flujo completo `walk`, `moto`, `car`, patente vieja/Mercosur válida e inválida, mutación ajena, estados y ausencia de efectos en `courier_documents`, y proyección del vehículo en vista de viaje/comercio si aplica la fixture de viaje.
- `e2e-preview` para `fddaca33` estaba **pending**, no PASS, al documentar ronda 2. No confundir build/Vercel con ejecución Playwright.
- Falta bitácora actualizada: la descripción de PR y `docs/tasks/log/T-357.md` hablan de documentación opcional en edición y marcan el DoD entero como logrado, ambas afirmaciones ya no corresponden al HEAD.

## H05 — Error de lectura de couriers no equivale a ausencia

**Estado: arreglado-sin-verificar**, riesgo original medio.
- La página ahora recoge `courierError` y arroja error para el error boundary; `vehicle_type:null` sin error sigue siendo alta normal.
- Caso unitario añadido y verde en CI; sin mutación runtime independiente.

## NO TOCAR — decisiones y protección vigente

- **1-A**: editar vehículo **no modifica** `couriers.status` ni quita la aprobación por sí solo.
- **2-A**: documentos solo mediante flujo de T-356/CC-025, no `upsert` directo al editar vehículo.
- D9: licencia y seguro son opcionales. No crear restricciones de motor no contempladas.
- No tocar contratos, SQL, migraciones, RLS, `src/domain/**`, `src/ui/**`, configuraciones de CI ni secretos para forzar el merge.

## CI del SHA inspeccionado

- `unit`: PASS **136 archivos / 2494 tests** — https://github.com/cadeApp/cadeApp/actions/runs/38984427873/job/117252659968
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: PASS del mismo SHA.
- `approval-policy`: PASS. Vercel: deployment SUCCESS.
- `db-tests`: **in progress** al registrar (no afirmar PASS); no se ejecutaron PgTAP en local.
- `e2e-preview`: **pending**, run https://github.com/cadeApp/cadeApp/actions/runs/38984524393 (no afirmar PASS).
- Mutaciones independientes: 10 pruebas estructurales GREEN original / RED al eliminar el texto del control, ejecutadas in-memory sobre las fuentes de GitHub; instrumento estático, **no demuestra seguridad funcional** (evidencia/ronda-2.md).

## Salida y siguiente paso

**NO APROBAR NI MERGEAR**, porque H04 sigue abierto, faltan resultados E2E y evidencia independiente RED→GREEN runtime. Resolver primero el test real y ejecutar cobertura, y actualizar la bitácora con resultados verificables. El commit de la revisión mueve el HEAD y hace ejecutar CI nuevamente; los SHA citados se refieren al código antes de la documentación de R2.
