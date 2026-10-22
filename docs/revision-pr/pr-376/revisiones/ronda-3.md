# PR #376 / CC-025 Fase B — Revisión independiente Ronda 3

**Fecha:** 2026-10-16. **SHA código auditado:** `610204b206b952f85d04e93fb8b0adb47220749b`. **Resultado: CON BLOQUEANTES (R01 alto y R02 medio). NO APROBAR / NO MERGEAR.**

## Implementación examinada y hallazgos anteriores
Se inspeccionó todo el diff actual contra develop y los commits desde R2. La integración de B0 mediante merge de develop es real. La nueva Server Action invoca `submit_courier_onboarding_documents` bajo sesión autenticada; eliminó SELECT/INSERT directo de `courier_documents`. SQL B0 valida actor, rol, consentimiento, estado del courier, cada documento e idempotencia en transacción con `couriers FOR UPDATE`. No se mezclaron nuevos SQL/RLS de Fase C en el diff actual.

- **PR376-H01: arreglado-sin-verificar.** Las carreras entre llamadores de la RPC se serializan. CI B0 multisesión comprueba mutación SQL sin FOR UPDATE RED: 8 documentos; restaurado GREEN: 4. La inserción REST legacy con otra ruta continúa posible hasta C; no atribuir unicidad global a B.
- **PR376-H02: arreglado-sin-verificar.** B0 rechaza documento `rejected` aunque coincida el path, en la propia transacción. Unit mocks y pgTAP de la RPC lo respaldan.
- **PR376-H03: arreglado-sin-verificar.** B0 comprueba el conjunto de documentos completo antes de COMMIT, no con un post-SELECT separado. El helper `validateCurrentDocumentSet` quedó exportado y testeado, pero ya no es usado por la action: sus unit tests no son prueba del circuito productivo.

## PR376-R01 — ALTO: E2E Preview real del HEAD final en rojo
**Evidencia exacta:** el commit status `e2e-preview` para `610204b206b952f85d04e93fb8b0adb47220749b` es **failure**, enlazado al [run 38937045004](https://github.com/cadeApp/cadeApp/actions/runs/38937045004). El workflow repository_dispatch vive en la rama default, pero el job e2e-preview hizo checkout explícito de `610204b`, confirmado por log. Corrió 78 tests Chromium: **77 PASS y 1 FAIL**, con dos reintentos también fallidos. Es `e2e/specs/courier-onboarding.spec.ts:330` (Flujo 1 positivo); error `TimeoutError` en línea 446 al esperar la navegación a `/courier/onboarding/status` después de Submit. No se revisó screenshot/trace, por tanto el mensaje exacto de UI no se conoce.

**Causa probable, NO demostrada aún por la traza:** la spec líneas ~368–377 precarga en sessionStorage `e2e/fixtures/{dni_front,dni_back,selfie,avatar}.jpg`, rutas sintéticas que incumplen el prefijo `courier/<uid>/...` ahora exigido tanto por `actions.ts` (líneas 220–229) como SQL B0 (81–98). La comparación del commit E2E anterior `6a85ab3` con el HEAD muestra solamente actualización de bitácora, no cambios funcionales.

**Corrección:** inspeccionar screenshot, `error-context.md` y trace del run para validar causa; arreglar `e2e/specs/courier-onboarding.spec.ts` usando cuatro uploads REALES de imágenes válidas al bucket courier-docs bajo ruta canónica, como el patrón de `e2e/specs/uploads-a11y.spec.ts`. Usar paths realmente persistidos en Storage, observar navegación y datos en DB (4 documentos submitted, paths exactos, vehicle_type registrado) y cleanup aislado. Preservar negativos de DNI repetido y ruta inválida. No bajar validaciones, elevar timeout, mockear redirección ni desactivar el gate. Exigir E2E trusted success de HEAD corregido.

## PR376-R02 — MEDIO: update administrativo tras RPC no repite condición de estado
**Evidencia por análisis:** SQL B0 valida estado `rejected/suspended` con `couriers FOR UPDATE` durante la RPC. Al retornar, su lock ya fue liberado. La Server Action `src/features/courier-onboarding/actions.ts:286–299` hace `adminClient.from('couriers').update(...).eq('profile_id',user.id)` sin filtrar estado ni inspeccionar las filas afectadas. Si un admin suspende/rechaza al courier entre COMMIT de RPC y UPDATE, se podrían registrar `dni_hmac/vehicle_type/vehicle_plate` y devolver éxito indebido. **La carrera es inferida, no ejecutada.** La falta de condición también existía con el antiguo writer; esta revisión expone el TOCTOU.

**Corrección acotada:** repetir condición en el UPDATE: status `pending` o `approved` y `RETURNING profile_id`; aceptar solamente una fila afectada. Con cero filas o error, respuesta segura no-ok. Test unit que simule RPC success seguido de suspensión/cero filas, sin fingir una DB real; positivos pending/approved y negativos rejected/suspended. RED de mutación de producción omitiendo `.in('status',...)` o ignorando retorno 0, con los tests idénticos, y GREEN restaurado. Documentar que el guard mejora estado de courier, no hace transaccional el consentimiento ni los metadatos: una ampliación SQL global requeriría otro contrato y autorización.

## Checks del SHA revisado
- CI [38936922299](https://github.com/cadeApp/cadeApp/actions/runs/38936922299): SUCCESS, **135 suites / 2405 unit tests PASS** y **26 archivos / 2341 pgTAP PASS**; typecheck, lint, build, audit, bundle-budget y approval-policy verdes. Runner B0 dos sesiones y RED 8/GREEN 4 incluidos.
- E2E trusted [38937045004](https://github.com/cadeApp/cadeApp/actions/runs/38937045004): **FAIL** sobre este mismo SHA (77/78). El CI verde no sustituye este check separado.
- Migrate de B0 en develop [38862718299](https://github.com/cadeApp/cadeApp/actions/runs/38862718299) reporta SUCCESS. Este revisor no consultó la DB remota y no certifica su estado.
- Rama contra develop ahead 11/behind 1 al consultar, mergeable mecánico true. Integrar develop mediante merge y revalidar los checks de nuevo HEAD.
- No se corrió Supabase/Docker/Playwright por el revisor ni se ejecutaron mutaciones funcionales propias. Se citan logs reales del CI, sin atribuir sus mutaciones al revisor. No se modificó código de aplicación, no se aprobó ni mergeó ninguna PR; #364/#358 e issue #363 continúan pendientes.

[Prompt para agy](../prompt-agy-ronda-3.md) · [Evidencia](../evidencia/ronda-3.md) · [Hallazgos](../hallazgos.jsonl)