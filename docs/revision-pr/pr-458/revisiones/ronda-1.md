# Revisión independiente · PR #458 / T-380 · Ronda 1

**Fecha:** 2026-10-20  
**Revisado:** `961d6ea6555f42193fec806d2d216adbee2c6893` · base `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`  
**Resultado:** **CON BLOQUEANTES (2)** · sin decisiones de producto pendientes.  
**Método:** inspección del diff completo, ficha y CC desde `develop`, bitácora de la PR, pruebas, estado y logs oficiales de CI. No se ejecutaron Vitest ni mutaciones locales desde un clon: el entorno de revisión carecía de repositorio local y su red no resolvía GitHub; no se atribuye verificación en runtime a esta revisión.

## Validaciones y alcance

- 10 archivos cambiados, todos dentro de **Archivos permitidos** en `docs/tasks/T-380.md`.
- Comparación contra la ficha de `develop`: solo se actualizó el estado de la dependencia T-385, aplicada, y la explicación de la elección de copy; no se amplió el DoD ni el alcance.
- CC-034 y PR #455: contrato y RPC ya están mergeados en `develop`. El código de esta PR no modifica migraciones, dominio, tipos ni wrappers.
- La Server Action usa `requireAdminAal2`, el cliente de sesión de ese guard, `adminReinstateCourierRpc`, mapea códigos con `err(rpcResult.code)`, revalida lista y detalle, y preserva `idempotent`.
- La vista separa las decisiones iniciales de `reactivate/reconsider`, informa el estado de disponibilidad, muestra `role="alert"` ante errores, y añade guard síncrona contra dos envíos.
- El E2E verifica suspensión/reactivación con MFA, audit_log, `available = false`, y feed tras activar disponibilidad; no modifica la base desde esta revisión.
- La PR está en Draft y es mergeable técnicamente. No se aprueba ni mergea.

## Evidencia de CI ajena, inspeccionada

- **SHA de código:** `11f626b52362692f3e6734784158d98f6b9ac0ff`. CI [39436669439](https://github.com/cadeApp/cadeApp/actions/runs/39436669439): unit, lint, typecheck, build, audit, db-tests y bundle-budget con conclusión `success`.
- Log `unit`: `Test Files 151 passed (151)`; `Tests 2964 passed (2964)`. Hay ruido de jsdom en el log pero el resumen final fue verde.
- Log `db-tests`: la ejecución incluye mutaciones negativas intencionales `Result: FAIL` seguidas de restauraciones `Result: PASS`; terminó con `Files=33, Tests=2959, Result: PASS` y `git diff --exit-code -- src/types/database.types.ts`.
- E2E [39436812843](https://github.com/cadeApp/cadeApp/actions/runs/39436812843): `admin-courier-reinstate.spec.ts:80:7` pasó `(44.8s)`; gate `92 passed` y `6 passed`.
- `bundle-budget` concluyó success pero reporta **advertencias advisory** sobre rutas existentes, incluida `/admin/applicants/[id] = 248 kB` contra 180 kB. No se demostró incremento atribuible a T-380: no se inventa comparación con línea base ni se clasifica como regresión de esta PR.
- HEAD `961d6ea6555f42193fec806d2d216adbee2c6893` solo añade una actualización documental de la bitácora sobre el SHA de código, confirmada con `compare_commits`. No se exige repetir los checks por ese commit documental.

## BLOQUEANTES

### PR458-H01 — Prueba de doble envío dependiente de reloj

**Archivo:** `src/features/admin/components/applicant-detail-view.test.tsx:514`  
**Categoría:** test-coverage · **Severidad:** medio · **Patrón:** P08-control-no-cubre-lo-que-dice · **Origen:** agente.

El test `dos envíos seguidos del formulario (clic y Enter) no duplican la llamada` lanza el segundo `fireEvent.submit(form)` y después espera `setTimeout(resolve, 50)` antes de contar llamadas. Es un *sleep* real, expresamente prohibido por la skill `revisar-pr`, y observa una ventana arbitraria en lugar de esperar que se procese determinísticamente el segundo evento.

**Corrección:** eliminar el temporizador fijo, usar `act(async () => { fireEvent.submit(form); })` (importar `act` de Testing Library) para procesar las microtareas/actualizaciones de ese envío, y afirmar exactamente 1 llamada mientras la promesa de la acción sigue pendiente. Luego resolver la promesa y exigir `router.refresh` una sola vez. **Prueba RED auténtica:** quitar temporalmente `decisionInFlight.current` como guarda dentro de `onDecisionSubmit` y mostrar que falla `toHaveBeenCalledTimes(1)`; restaurar el código original sin alterar expectations y comprobar GREEN. Guardar comando y resumen real en la bitácora; no fabricar resultados.

**Evidencia independiente:** inspección exacta de la línea y del contexto, sin ejecución local. `verificado_en_sha = null`.

### PR458-H02 — No está conservada la evidencia reproducible de M1–M8

**Archivo:** `docs/tasks/log/T-380.md`, sección **Pruebas**, mutaciones M1–M8.  
**Categoría:** test-coverage · **Severidad:** medio · **Patrón:** P15-entregable-declarado-pero-no-ejecutable · **Origen:** agente.

La bitácora enumera ocho mutaciones, el número de fallos y una frase del caso afectado, pero atribuye el script a un scratchpad sin commit y no conserva el parche/inyección exactos, comando ejecutado ni las líneas resumen RED **y GREEN para cada mutación**. Así no es posible reproducir lo que afirma, como pide `T-380.md` en «Regla de pruebas». No se afirma que los resultados sean falsos; falta trazabilidad.

**Corrección:** en la misma bitácora, aportar por cada M1–M8: archivo/símbolo y reemplazo exacto aplicado temporalmente, comando, aserción que falla por la propiedad esperada, `Test Files/Tests` reales en RED, y los reales en GREEN tras restauración. Se pueden registrar comandos/scripts temporales `/tmp` sin incorporarlos al PR. Si no existe esa evidencia, volver a correrla con controles intactos y mutación recuperable desde memoria (sin `git checkout`, sin alterar tests para forzar rojo). Prohibido completar cifras inventadas o atribuir verificación independiente al autor.

**Evidencia independiente:** inspección de la bitácora y de la descripción; las ocho mutaciones no se pudieron reproducir en este entorno. `verificado_en_sha = null`.

## MEJORAS

Ninguna exigida en esta ronda. El cierre vía Escape/backdrop durante una petición en curso podría permitir cerrar el diálogo y reabrir uno nuevo antes de la resolución; se deja como riesgo para comprobar, no como defecto demostrado ni bloqueante de T-380.

## No revisado / límites

No se usó Supabase remoto, Docker, secretos, ni Vercel con credenciales; no hubo pruebas locales ni mutación del código desde esta revisión. La carpeta `pr-458` es evidencia documental de una revisión **por inspección + CI del autor**, no una certificación runtime independiente. No se editaron archivos funcionales.

**Acción siguiente:** ejecutar el prompt de corrección adjunto en la PR, actualizar bitácora y subir; después nueva ronda independiente. No merge ni approve.
