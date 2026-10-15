# Revisión independiente — PR #361 / T-364 — Ronda 2

**Fecha:** 2026-10-15 · **Autor:** asako669 (P2) · **SHA revisado:** `f397c21b39f04de03d32615aedbdbaa8a9cbe559` · **Base:** develop @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b` · **Estado:** CON BLOQUEANTES (H05–H09) y una mejora (H10).

## Método y estado de evidencia

- Leí ficha T-364 **en develop**, el cuerpo, comentario de solicitud de ronda 2, bitácora, cambios del SHA, contratos de dominio y SQL vigentes.
- GitHub CI del SHA revisado: **lint, typecheck, build, unit, db-tests, audit y bundle-budget en verde**. Log unit: **129 archivos / 2174 tests PASS**. Log pgTAP: **22 archivos / 2205 tests, Result: PASS**. Vercel Preview figura desplegado.
- El PR agrega un caso nuevo llamado E2E T-364, pero **NO navega la UI**. No encontré una corrida verificable del escenario UI real en Preview/Develop.
- El contenedor no puede resolver github.com por git, por lo que la revisión ha sido **inspección estática + inspección directa de logs CI**, no ejecución local. Las mutaciones independientes quedan pendientes para la siguiente ronda. Todos los hallazgos nuevos son `analisis`, no `verificado-runtime`.
- **Sin decisiones 🔵:** los bloqueos tienen solución dentro de los archivos permitidos; no requieren alterar RPC, RLS, ficha ni dependencias.

## Resolución de los hallazgos de ronda 1

| ID | Estado actual | Evidencia |
|---|---|---|
| H01 | Parcial | Ya existe botón, diálogo, action y RPC; **falta E2E real UI** y corregir fallas funcionales relacionadas |
| H02 | Arreglado por inspección, sin mutación independiente | `vi.clearAllMocks()`, `mockRefresh.toHaveBeenCalledTimes(1)` |
| H03 | Arreglado por inspección, sin mutación independiente | Error usa `{ok:false,code}`; el doble de éxito es aún incompleto (H09) |
| H04 | Arreglado por inspección, sin mutación independiente | Predicado incluye `expiresAt > Date.now()` y casos vigentes/vencidos |

## Bloqueantes nuevos

### PR361-H05 · ALTO · E2E ausente pese a figurar completado
**Archivo:** `e2e/specs/request-states.spec.ts:824` · [ANÁLISIS].

El caso agregado opera por `merchantClient.rpc('cancel_request')` y `courierClient.rpc('cancel_request')` sin `page.goto`, `loginAsMerchant`, botón `Cancelar`, segundo paso del diálogo, contador de activas ni historial. Además el rechazo verifica el rol `courier`, no la propiedad ante **otro merchant**. El SQL de propiedad ya existe, pero la nueva prueba no lo ejerce. El DoD exige **E2E desde el listado**; la PR no puede cerrarse con un test RPC duplicado.

**Corrección:** dentro del mismo spec, E2E con usuario merchant de fixture, navegar a `/merchant/dashboard`, cancelar por UI hasta segunda confirmación, comprobar contador/listado/historial y oráculo DB. Usar otro usuario **merchant** legítimo sobre request ajena y verificar `UNAUTHORIZED_ACTOR` + DB intacta. Correr en Preview+Develop. Prueba RED: desactivar localmente el handler del botón en test permitido (sin desplegar código inseguro) y verificar que el E2E falla.

### PR361-H06 · ALTO · Segundo uso del diálogo puede saltarse la primera confirmación
**Archivos:** `merchant-request-cancel-dialog.tsx:37` y `merchant-requests-list.tsx:101-110` · [ANÁLISIS].

`step` y `reason` se reinician solo en `resetAndClose()` de `onOpenChange(false)`, mientras la cancelación exitosa/fallida se cierra cambiando `open` directamente desde el padre. Al reabrir el mismo diálogo controlado, React conserva el estado local: `step===2`, `reason` previo. La siguiente solicitud podría abrir directamente la confirmación final.

**Corrección:** sincronizar reset con la transición `open: true -> false` en el diálogo (o desmontarlo/remontarlo con identidad de solicitud); test de **dos cancelaciones consecutivas**: tras éxito o error, reabrir otra solicitud y exigir paso 1, sin motivo seleccionado y botón Continuar deshabilitado. Mutación RED: quitar la sincronización.

### PR361-H07 · ALTO · Doble confirmación no protegida sincrónicamente
**Archivo:** `merchant-requests-list.tsx:93` · [ANÁLISIS].

`handleConfirmCancel` inicia `startTransition` por cada llamada. `isPending` se usa en el botón del diálogo, pero **no** como guarda sincrónica; dos eventos antes de la nueva renderización pueden enviar dos RPC. No hay test de doble clic pendiente.

**Corrección:** `useRef(false)` de solicitud en curso; si true, return; fijarlo **antes** del `startTransition`, restablecerlo en `finally`; deshabilitar apertura de otra solicitud durante pending. Test con `Promise` diferida y dos confirmaciones inmediatas, `toHaveBeenCalledTimes(1)`; mutación RED: remover la guarda.

### PR361-H08 · ALTO · Errores de red no controlados
**Archivo:** `merchant-requests-list.tsx:96` · [ANÁLISIS].

No existe `try/catch` en el `await onCancel(...) / cancelMerchantRequestAction(...)`. Una promesa rechazada (red, error en Auth/cliente, Server Action) elude notificaciones y recuperación. No hay test `mockRejectedValue`.

**Corrección:** `try/catch/finally` alrededor del await dentro de la transición; `notify.error` diferenciado para excepción/red, `router.refresh()` en rechazo o resolución cuando sea necesario, sin representar cancelación exitosa. `finally` libera la guarda. Test `mockRejectedValue(new Error(...))` verifica feedback y ausencia de éxito. Mutación RED: eliminar catch o su notificación.

### PR361-H09 · ALTO · Oráculos de UI no verifican su contrato real
**Archivo:** `merchant-requests-list.test.tsx:483` · [ANÁLISIS].

La prop inyectable se tipa `ActionResult<unknown>` y el test construye `{ok:true,data:{status:'cancelled'}}`, imposible como respuesta válida de la RPC productiva (faltan `requestId` y `cancelledAt`). Tampoco el test comprueba que, sin prop `onCancel`, se llame a la action real. La aserción del mensaje compara `getDomainErrorMessage` contra sí mismo a través del código bajo prueba: una mutación del mapeo no lo pondría RED.

**Corrección:** tipar `onCancel` con `ActionResult<RpcOutput<'cancel_request'>,DomainErrorCode>` o retirar DI y mockear específicamente `cancelMerchantRequestAction`. Usar ID UUID y payload de éxito completos; agregar prueba sin inyección que verifique la invocación de esa action; aserciones con literal esperado estable del mensaje. Mutaciones RED propias: suprimir la invocación de action y cambiar el mapeo del error por una frase distinta.

## Mejora no bloqueante

### PR361-H10 · BAJO · Touch targets del listado
**Archivo:** `merchant-requests-list.tsx:248` · [ANÁLISIS].

Los dos enlaces/botones del listado usan `min-h-[44px]`, pero el cuerpo de la PR declara >=48px. Homogeneizar a `min-h-12` (48px) y verificar que no se apilen sin separación adecuada en móvil.

## Arquitectura y alcance
- Los 16 archivos cambiados del PR están dentro de los globs de la ficha, incluidos `src/features/requests/**`. No hay desvío de ficha, CC, RLS ni migraciones.
- El autor se apartó del prompt anterior al crear action y diálogo nuevos. Existe justificación plausible para un diálogo local por el guard de boundaries, **pero duplicar la autenticación/validación/RPC de `merchantCancelTripAction` introduce dos rutas de mantenimiento**. Evitar nuevo refactor que exija tocar archivos fuera de ficha; como mejora, estudiar una delegación limpia desde `cancelMerchantRequestAction` a la action canónica, respetando el lint. No se declara vulnerabilidad solo por duplicación.
- H05–H09 permanecen abiertos por análisis. El color verde de CI no los cierra.

## Siguiente ronda
El autor corrige los hallazgos con pruebas GREEN–mutación RED–GREEN auténticas; la revisión independiente reproduce los cambios, E2E Preview/Develop y controles en el nuevo SHA antes de considerar merge. **No aprobar ni mergear** ahora.
