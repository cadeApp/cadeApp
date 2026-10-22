# Informe independiente — PR #384 / T-357 — Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/384
**Fecha (Argentina):** 2026-10-17
**SHA del código inspeccionado:** `e873539624dbb454f987df5a1e9014baece825d3`
**Base actual:** `develop` (GitHub: `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6`, 1 commit adelante del PR)
**Resultado:** **CON UN BLOQUEANTE RESIDUAL (H04) — NO MERGEAR TODAVÍA.**

## Qué cambió desde R2 (bf1577e4)

Cuatro commits de autor, todos limitados a cuatro archivos permitidos:
- `c1502bad`: matriz E2E ampliada y tests unitarios de patente tradicional.
- `d9755a16`: bitácora con SHA de sesión.
- `75493f17`: corrección de selector Playwright para evitar colisión de strict mode; usa `label:has(input[value="..."])`.
- `e8735396`: bitácora con SHA reciente.

Se comprobó que el autor **no modificó** `docs/revision-pr/pr-384/**` desde R2. La PR mantiene `mergeable=true` / `mergeable_state=clean` según GitHub. `develop` avanzó un commit que modifica otras áreas (T-363, trips/map, offers; **sin intersección con los cuatro archivos modificados desde R2**). La rama está 1 commit detrás; no se ejecutó `git merge-tree` local por ausencia de clone, y **no se hicieron cambios a develop**.

## Comprobación real de CI y E2E (NO solo labels verdes)

**CI del SHA e8735396:** https://github.com/cadeApp/cadeApp/actions/runs/38994401631
- `unit`: PASS; **136/136 Test Files, 2527/2527 Tests** (verificado directamente en log del job `117283805471`).
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `db-tests`: PASS.
- `db-tests` ejecutó PgTAP: **Files=26, Tests=2341, Result: PASS**; se observaron fallas RED deliberadas de ensayos de mutación SQL seguidas de restauraciones GREEN, y el job finalizó con éxito. No atribuir esos ensayos de otras tareas a T-357.
- `approval-policy` PASS; Vercel deployment SUCCESS.

**E2E Preview:** https://github.com/cadeApp/cadeApp/actions/runs/38994460490 ; job `117283860571`:
- **82/82 Chromium + 3/3 global-settings PASS** (0 fallos).
- El log confirma explícitamente que se ejecutaron y pasaron los dos tests T-357: flujo positivo `e2e/specs/courier-onboarding.spec.ts:812` (28,1 s) y modo incompleto con `?mode=edit` en `:997` (13,6 s).
- Run asociado por `e2e-preview: success` al SHA `e8735396`; no es una simple declaración del agy.
- El selector radio de tipo de vehículo ya no provoca strict mode; esa corrección del autor es adecuada.

## Estado de cada hallazgo

| ID | Estado R3 | Evidencia / residual |
|---|---|---|
| H01 ALTO | **arreglado-sin-verificar** | Servidor exige `vehicle_type` previo y estado permitido; E2E `?mode=edit` comprueba la UI y DB con marcador null. **El E2E no invoca la Server Action maliciosa como ese postulante**. Unit lo cubre con mocks; falta prueba independiente real y mutación runtime. |
| H02 ALTO | **arreglado-sin-verificar** | Schema de edición estricto; action sin `upsert`; E2E verifica ausencia de tarjetas y snapshot `courier_documents` igual antes/después de 3 cambios. Prueba unit rechaza payload documental ajeno. Falta mutación runtime propia del revisor. |
| H03 MEDIO | **arreglado-sin-verificar** | `update` protegido por actor, `vehicle_type IS NOT NULL` y estado; `.select('profile_id').maybeSingle()` y error si 0 filas. Unit prueba resultado nulo, pero **sin carrera real DB ni mutación runtime independiente**. |
| H04 ALTO | **ABIERTO — BLOQUEANTE** | Mejoró considerablemente: flujo moto (AB 123 CD) → auto (ELA 666) → bici → a pie, rechazo visual de patente inválida, persistencia en perfil + DB + reload, conservación `approved`, documentos inalterados, y negativo UI de `?mode=edit`. **Falta el viaje y pruebas adversariales directas detalladas abajo.** |
| H05 MEDIO | **arreglado-sin-verificar** | `courierError` de `maybeSingle` ya no se trata como ausencia de legajo; unit positivo. Falta mutación runtime independiente. |

### H04 — La vista de viaje está implementada, pero el requisito NO está probado de punta a punta

**Evidencia [ANÁLISIS, SHA e8735396]:**
- La ficha `docs/tasks/T-357.md`, leída de `develop`, exige: «cambiar tipo y guardar → recargar → valor persistido en perfil **y vista de viaje**».
- `src/features/trips/queries.ts:78-79` proyecta `vehicleType` y `vehiclePlate` desde `getTripDetailsServer`.
- `src/features/trips/components/trip-merchant-view.tsx:154-158` efectivamente presenta tipo y patente al comercio.
- `src/features/trips/queries.test.ts` y `components.test.tsx` prueban aspectos aislados del mapeo/renderizado.
- El nuevo E2E `courier-onboarding.spec.ts:812-995` verifica solo el **perfil** y DB; no se navega al viaje del comercio tras guardar. La bitácora reconoce expresamente «pendiente: fixture de staging no incluye viaje activo asignado a este courier» y el body del PR dejó el ítem sin ✓.

**Conclusión rigurosa:** no hay evidencia de un *bug funcional* en la vista de viaje; sí hay un **DoD incumplido por falta de prueba integrada**. No confundir esas dos afirmaciones.

**Arreglo/test exigido:** crear caso E2E segregado con solicitud realmente `matched` o `in_transit` y courier asignado, apoyándose en el fixture/helper de `e2e/specs/main-flow.spec.ts` o de `request-states.spec.ts`. Cambiar tipo/patente desde el perfil, abrir/recargar `/trips/[id]` autenticado **como comercio dueño**, verificar texto y patente actualizados; además contrastar query autorizada `get_trip_details` contra datos reales. No tocar `src/features/trips/**` salvo que se encuentre fallo nuevo y se solicite CC/reconciliación de alcance.

### H04 residual — servidor, actor ajeno y RED→GREEN

- `courier-onboarding.spec.ts:997-1039` comprueba UI de alta con query maliciosa y DB nula, **pero nunca intenta `updateCourierVehicleAction` como ese actor**; no demuestra la guarda del servidor ante invocación directa.
- No se observó E2E de sesión de otro courier que intente cambiar el vehículo de otro; el action no acepta `courierId` de cliente y filtra por `auth.user.id`, lo que favorece la seguridad **por inspección**, pero no reemplaza la prueba adversarial exigida por la ficha.
- No se reprodujo una mutación **runtime independiente** que deje rojo un test del nuevo flujo. El revisor ejecutó solo una batería **ESTÁTICA** de 7 mutaciones sobre la estructura de aserciones del E2E; no la denomina proof runtime ni completa `verificado_en_sha`.

## Mejora no bloqueante (calidad del E2E)

El snapshot de `courier_documents` de `:825-828` y `:989-995` compara `kind, storage_path, status` sin clave `id`, campo `is_current` ni `order` explícito. En este run fue verde y la action no escribe docs. Para una comparación estricta y estable puede añadirse `id,is_current` y ordenar por ID, manteniendo cero diferencias. **No usar este refinamiento para reemplazar H04.**

## NO TOCAR

- Decisión **1-A**: editar **mantiene** `status=approved`; no enviar a nueva aprobación.
- Decisión **2-A**: edición solo tipo/patente; docs separados vía CC-025/T-356.
- D9: licencia y seguro opcionales.
- No cambiar RLS, SQL, RPC, tipos, `src/domain/**`, `src/ui/**`, tests ni reglas CI para maquillar un verde.

## Estado final y próxima ronda

**1 bloqueante H04 aún abierto**, 4 arreglados pendientes de verificación independiente runtime. Todos los checks exigidos del SHA de código revisado están verdes. No se aprueba ni se mergea a `develop`. Se solicita una corrección acotada del E2E y prueba adversarial con evidencia reproducible; no hay decisiones arquitectónicas nuevas para el dueño.
