# Informe de revisión independiente — PR #654 / T-428 — Ronda 1

**Fecha:** 2026-11-07 · **Resultado: SIN BLOQUEANTES de implementación (0)**

**PR:** https://github.com/cadeApp/cadeApp/pull/654  
**SHA de implementación auditado:** `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`  
**Base:** `develop` @ `4ae5404ee14651d00ad0c9286f250ba6c5441c49`  
**Decisión del propietario:** **D01=A**. Se valida la fixture corregida en #654; tras el merge manual de T-428, se hará merge de `develop` en #647 y se exigirá el gate de #647.

## Resumen y alcance

Se revisaron los **cuatro archivos** del diff del PR: `e2e/specs/courier-onboarding.spec.ts`, `docs/implementation-plan.md`, `docs/tasks/T-428.md` y `docs/tasks/log/T-428.md`. Los cuatro están en la lista permitida de la ficha **creada en la propia rama**. En `develop` no existía `docs/tasks/T-428.md`; el alcance se contrastó con el [issue #653](https://github.com/cadeApp/cadeApp/issues/653), CC-042 y CC-025, sin fingir que la ficha ya estaba mergeada.

El diff funcional es solo de la fixture en `courier-onboarding.spec.ts:1087-1096,1143`: lee `couriers.active_vehicle_id` del seed, falla explícitamente si falta y agrega `vehicle_id: activeVehicleId` al documento `license` insertado. El resto de documentos personales queda sin vínculo vehicular. Es coherente con `isActiveVehicleDocument` en `src/features/courier-onboarding/queries.ts` y con CC-042: el perfil selecciona licencia/seguro del vehículo activo. No se tocaron RPC, RLS, migraciones, producción, seed global, dependencias ni aserciones; tampoco se añadieron `.skip`, `.only`, reintentos o timeouts.

La prueba mantiene rechazo por RPC real `admin_verify_document`, código de motivo seguro, exclusión de la nota interna centinela, carga PDF, transición a revisión y comprobaciones posteriores. El cambio no reemplaza esas comprobaciones por mocks. **No se encontraron bloqueantes propios de T-428.**

## Evidencia RED → GREEN

- **RED histórico real (no generado por esta revisión):** gates 42277151731, 42287199838 y [42303370007](https://github.com/cadeApp/cadeApp/actions/runs/42303370007), con fallo 3/3 de `courier-onboarding.spec.ts:1056` al buscar `Rechazado / requiere corrección` porque la licencia sembrada no tenía `vehicle_id`. Se conserva como antecedente de la bitácora y del issue #653; no se ejecutó mutación propia.
- **GREEN observado por revisión en el log oficial:** [run 42335963853](https://github.com/cadeApp/cadeApp/actions/runs/42335963853), job `128292871037`, checkout `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc` (líneas de checkout y `git log` del job). Línea de Playwright: `✓ 24 [chromium] › e2e/specs/courier-onboarding.spec.ts:1056:7`, 29,9 s, **sin retry ni skip para ese test**.
- El workflow `e2e-preview` terminó **success** y publicó estado `e2e-preview=success` en el SHA probado. El run se dispara por `workflow_run` y su `head_sha` de evento corresponde a la base; por eso **la evidencia válida del código probado es el checkout explícito y el status aplicado al SHA de la PR**, no el `head_sha` del evento.
- [CI run 42335300787](https://github.com/cadeApp/cadeApp/actions/runs/42335300787) pasó en `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`: `db-tests` (43 archivos, 3.582 tests), `unit` (197 archivos, 3.708 tests), `typecheck`, `lint`, `build`, `audit`, `bundle-budget`; generación de tipos sin diff pendiente.

## Incidencia externa observada: T-407 / #636 (NO bloquea T-428)

En **ese mismo gate**, `e2e/specs/admin-audit-filters.spec.ts:69` falló dos veces por `strict mode violation`: `getByText('Mostrando los eventos de una sola entidad.')` encontró **2 elementos** en `:108`. Pasó en `retry #2`; el resumen real de Chromium es **121 passed, 1 flaky**, y global-settings **7 passed**. Por tanto, **el gate terminó verde pero no fue un pase limpio de todos los tests sin retries**. Este archivo no figura en el diff de #654 y el defecto está documentado en [#636](https://github.com/cadeApp/cadeApp/issues/636), que es **[QA][T-407]**. La issue aparece cerrada pero el flaky sigue reproducido en este run. La ficha de **T-426/#649** se refiere al fallo de notificaciones en `next dev`, así que no debe atribuirse falsamente a T-426 la resolución del flaky de auditoría.

## Estado del control de aprobación

El workflow `approval-policy` del SHA original [falló](https://github.com/cadeApp/cadeApp/actions/runs/42335301066) con `Falta el informe completo de revisar-pr sin bloqueantes.`. Inspección de `.github/workflows/approval-policy.mjs`: exige sección `### Informe de revisión de agy` en **el cuerpo** del PR, no basta el comentario. Este informe debe registrarse allí sin cambiar código; comprobar luego el estado nuevo, sin declarar un verde no observado.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Motivo |
|---|---|
| `license` ahora tiene `vehicle_id` | Es precisamente el contrato CC-042 para licencia del vehículo activo |
| Documentos `dni_front`, `dni_back` y `selfie` no tienen `vehicle_id` | Son personales, no por vehículo |
| Flaky `admin-audit-filters.spec.ts:69` | Defecto ajeno de T-407/#636; no autoriza cambiar el test desde T-428 |
| No existe ficha T-428 en develop | Fue creada en la rama como parte del alcance aprobado en issue #653; no afirmar que existía en base |

## Checklist y límites

- [x] Diff, lista de archivos, contratos CC-042/CC-025, bitácora, issue #653 y evidencia de CI/E2E consultados por GitHub.
- [x] SHA del checkout E2E contrastado con SHA de implementación y status `e2e-preview`.
- [x] Cero aserciones eliminadas o debilitadas en el diff; cero cambios funcionales fuera de fixture.
- [x] D01=A documentada, y dependencia secuencial con #647 establecida.
- [ ] Ejecución **local propia** de `pnpm typecheck && pnpm lint && pnpm test` y mutación adversarial: **no ejecutadas** (sin clon ni ambiente de CI en esta revisión). Los resultados mencionados son de GitHub Actions, inspeccionados por el revisor.
- [ ] `node docs/revision-pr/analizar.mjs`: no ejecutado en esta sesión por falta de clon local; `hallazgos.jsonl` vacío es compatible con el script, que filtra líneas vacías.
- [ ] Aprobación/merge: reservados a Lautaro073. No se ejecutaron.

**Resultado de revisión de código: SIN BLOQUEANTES.** No se oculta el flaky ajeno ni se afirma ejecución independiente local. El commit de documentación posterior **moverá HEAD**, pero el SHA verificado seguirá siendo `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`. No pedir nuevo E2E por documentación sin cambios funcionales.
