# Revisión independiente — PR #361 / T-364 — Ronda 1

- **Fecha:** 2026-10-15
- **Autor:** asako669 (P2)
- **Rama:** `feat/T-364-cancelar-desde-mis-solicitudes` → `develop`
- **HEAD efectivamente inspeccionado:** `5d1be4bc129e96a4ba16e493ef355206ee74c44e`
- **Base informada por GitHub:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`
- **Estado:** Draft, primera publicación RED, **CON BLOQUEANTES (4 hallazgos pendientes)**
- **Método:** inspección estática de diff, ficha en develop, bitácora, issue #352, actions, UI y contratos actuales. No se pudo clonar/ejecutar por falta de acceso de red desde el contenedor. **Ningún test, job ni mutación se presenta como verificado por esta revisión**.
- **Decisiones 🔵:** ninguna identificada en esta ronda. Las alternativas de implementación son técnicas dentro del alcance autorizado.

## Hallazgos

### PR361-H01 — BLOQUEANTE · Funcionalidad todavía ausente
**Archivo:** `src/features/requests/components/merchant-requests-list.test.tsx:334` · [ANÁLISIS].

El diff del SHA inspeccionado modifica solo la bitácora y el test. `MerchantRequestsList` sigue sin botón, confirmación ni invocación; tampoco hay E2E de la acción desde el listado. La propia PR reporta cinco pruebas RED intencionales. **Este estado no es aprobable ni mergeable**; es un primer commit de TDD, no evidencia de defecto en una implementación inexistente.

**Arreglo recomendado:** reutilizar `merchantCancelTripAction({requestId,reason})` en `src/features/trips/actions.ts` (ya valida sesión, rol merchant, `merchantCancelTripSchema`, y delega a `callRequestRpc(...,'cancel_request',...)`) y `TripCancelDialog` (ya implementa motivo + dos pasos). No crear `cancelMerchantRequestAction` duplicada ni otra copia completa de diálogo, salvo justificación verificable. Añadir `revalidatePath('/merchant/dashboard')` y `revalidatePath('/merchant/history')` tras éxito, conservando los paths ya revalidados. Conservar control de doble clic, excepciones de red, feedback accesible, `router.refresh()` tras respuesta y estado real como autoridad. E2E con UI real en Preview + PostgreSQL Develop y actor ajeno rechazado.

### PR361-H02 — BLOQUEANTE · Oráculo de refresh contaminado
**Archivo:** `src/features/requests/components/merchant-requests-list.test.tsx:492` · [ANÁLISIS].

`mockRefresh` se define globalmente en la línea 10 y no hay limpieza por test. El caso de éxito en L460 llama a `mockRefresh` y el de error en L492 solo verifica `toHaveBeenCalled()`. Si en el error se omitiera `router.refresh()`, la última aserción podría seguir GREEN por la llamada acumulada del caso anterior.

**Arreglo:** `beforeEach(() => { vi.clearAllMocks(); })` y `toHaveBeenCalledTimes(1)` en cada escenario; comprobar además que doble confirmación causa una sola RPC. **Mutación RED a exigir:** quitar temporalmente `router.refresh()` solo del camino de error y demostrar que falla el caso de carrera, restaurándolo después.

### PR361-H03 — BLOQUEANTE · El mock de fallo no respeta la action real
**Archivo:** `src/features/requests/components/merchant-requests-list.test.tsx:467` · [ANÁLISIS].

El stub retorna `{ok:false,error:'INVALID_STATE_TRANSITION'}` pero `ActionResult` usa `{ok:false,code:'INVALID_STATE_TRANSITION'}` (ver `src/domain/errors.ts` y `src/features/trips/actions.ts`). El riesgo es implementar la UI contra un objeto inventado y aprobar pruebas que no ejercen la forma productiva.

**Arreglo:** tipar el mock con la firma/retorno de la action real (o mockear `merchantCancelTripAction` conservando el tipo), usar `code` y distinguir `REQUEST_EXPIRED`, `INVALID_STATE_TRANSITION`, auth/no-permiso y fallo de red. **Mutación RED:** devolver `INVALID_STATE_TRANSITION` real y alterar solo su rama del mapper; debe fallar el mensaje esperado.

### PR361-H04 — BLOQUEANTE · Publicada vencida, expectativa incorrecta
**Archivo:** `src/features/requests/components/merchant-requests-list.test.tsx:351` · [ANÁLISIS].

La solicitud `published` del nuevo test tiene `expiresAt` del 24/09/2026 y la prueba se revisa el 15/10/2026. El backend diferencia `published` vencida y responde `REQUEST_EXPIRED`. El test hoy exige un botón que el servidor no podría ejecutar con éxito. Además `getMerchantRequests` lee el status persistido: una fila puede seguir figurando `published` tras vencer (expiración perezosa).

**Arreglo:** congelar el reloj en tests y modelar una `published` vigente, una `published` ya vencida, una `matched` (cancelable para merchant), y `in_transit/delivered/cancelled/expired` (no cancelables). La UI puede ocultar cancelar en `published` vencida sin dar por válido el reloj del navegador como control de seguridad; backend sigue siendo autoridad. **Mutación RED:** tratar una `published` vencida como habilitada y verificar que falla el test de visibilidad.

## NO TOCAR — hallazgos falsos descartados
- `matched` sí es cancelable por merchant según la transición `cancel_request`; `in_transit` solo para admin con condiciones adicionales. No excluir `matched` por parecer “ya asignada”.
- No hace falta crear una RPC, policy, migración ni contrato compartido nuevo: `merchantCancelTripAction` y `TripCancelDialog` ya existen.
- El test del 15/10 en RED **es intencional** en este Draft. No maquillar ese rojo deshabilitando aserciones; completar la funcionalidad para obtener GREEN genuino.

## Checks y límites de evidencia
- Autor: typecheck ✅, lint ✅, cinco tests RED (declarado en bitácora y PR, **no reproducido aquí**).
- Revisión: inspección del SHA `5d1be4bc129e96a4ba16e493ef355206ee74c44e`; sin `pnpm`, CI, E2E, mutaciones ni logs db-tests ejecutados; por estar bloqueada la ronda, se pospone la evaluación de CI a la siguiente.
- GitHub informa `mergeable=true`, que no implica cumplimiento del DoD.
- Diff y alcance: solo dos archivos, ambos permitidos por ficha. No hay desvío de contrato ni de dependencias en el diff presente.

## Pendiente para próxima ronda
1. Autor implementa y documenta RED→GREEN genuino, E2E Preview + oráculo SQL real, permiso ajeno y carreras.
2. Revisión independiente reproduce la evidencia, corre controles y batería **propia** de mutaciones sobre nuevo HEAD.
3. Evaluar CI por SHA, revisar rutas revalidadas, feedback y status/TTL; luego determinar si se puede mergear.
