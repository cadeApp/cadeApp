# Revisión independiente — PR #461 / T-379 — ronda 1

**Fecha:** 2026-10-20  
**PR:** https://github.com/cadeApp/cadeApp/pull/461  
**Head funcional revisado:** `246c9d2e41fbe7a7bc838827e528c2701500f73b`  
**Base:** `develop` @ `cf2fbe13ab7ee8348b4805dadccef5416abb9265`  
**Revisor:** ChatGPT, revisión independiente por inspección del diff y cotejo de evidencia oficial; **no** autor del código ni de los tests.

## Informe revisar-pr

**Resultado: SIN BLOQUEANTES confirmados (0).** Queda pendiente el gate E2E oficial previo al merge, no una nueva modificación de código. El resultado se limita al SHA citado y a los controles efectivamente consultados.

| Control | Evidencia | Estado |
|---|---|---|
| `unit` | Run CI #39470528570; `Test Files 152 passed (152)` y `Tests 3004 passed (3004)` | PASS |
| `typecheck`, `lint` | GitHub checks en el mismo SHA | PASS |
| `build`, `audit`, `bundle-budget` | GitHub checks en el mismo SHA | PASS |
| `db-tests` | Job 118793094630; log `Files=34, Tests=3019`, `Result: PASS`; `git diff --exit-code -- src/types/database.types.ts` | PASS |
| Vercel | Preview desplegado según comentario del bot | READY |
| `approval-policy` | Falló antes de publicar el informe independiente | PENDIENTE NUEVO CHECK |
| `e2e-preview` | Cancelado/omitido durante las rondas por decisión operativa de Lautaro073 | PENDIENTE GATE FINAL |
| E2E local | Bitácora: RED en `develop` y GREEN en Preview, `8 passed`, `1 flaky` que aprobó tras reintento con `CI=true` | **DECLARADO POR AUTOR**, no reproducido independientemente |

## Alcance: decisión ratificada

Comparé `docs/tasks/T-379.md` en `develop` y en el SHA revisado. La PR incorporó dos archivos a «Archivos permitidos», y Lautaro073 decidió expresamente la **opción A** el 2026-10-20:

1. `src/features/offers/components/notify-resilience.test.tsx`: únicamente `requestStatus: 'published'` en un fixture necesario para preservar el campo obligatorio del contrato de salida `CourierOfferItem`.
2. `e2e/pages/trip.page.ts`: únicamente `TripPage.tripHeader`, que ahora contempla `Viaje en curso` y `Viaje finalizado` para no perder el badge global de «Entregado».

**Clasificación:** ampliación aceptada por el responsable, no desvío bloqueante. Está argumentada en «Notas para quien retome» de la ficha de la rama y no modifica esquema, RPC, RLS ni `src/domain/**` o `src/ui/**`.

## Inspección del comportamiento

- `getMyOffers` conserva la consulta y suma `delivery_requests.status`; lo interpreta con `deliveryRequestStatusSchema.safeParse`, devolviendo `null` si el embed no es visible o el dato es inválido.
- `CourierOfferItem.status` pasa a `OfferStatus`, cubriendo `pending`, `accepted`, `rejected`, `withdrawn`, `expired` y `cancelled`.
- `isActiveTrip` solo ubica en «Aceptadas» `accepted + matched/in_transit`. `delivered` queda en «Otras» con «Entregado» y enlace al viaje; `cancelled` o `null` no ofrecen enlace; la oferta no aceptada usa su propio estado.
- `TripCourierView` y `TripMerchantView` emiten «Viaje finalizado» cuando `isDelivered`.
- Las pruebas nuevas sí contienen aserciones sobre la matriz y la navegación, además de comparaciones de conteos. `main-flow.spec.ts` exige, después de entregar, título finalizado, «Aceptadas (0)» y la tarjeta de «Otras».

**Alcance de la validación:** inspección del código y del test; Vitest en CI pasó en el SHA revisado. No se corrió una batería independiente de mutaciones ni E2E local desde este entorno por falta de un clon instalable/conectividad GitHub. Las ocho mutaciones de la bitácora son **declaraciones del autor**, no verificaciones atribuidas a esta ronda. Dejé un harness autónomo para reproducción posterior en [evidencia/comandos.md](../evidencia/comandos.md).

## OBS-01 — zonas genéricas en solicitud no visible por RLS

**No bloqueante; preexistente y fuera de T-379.** Cuando la solicitud embebida es `null`, `getMyOffers` usa `'Centro'` y `'Aguilares'` como zonas de respaldo. Eso puede aparentar un origen/destino conocido donde el dato no es visible. Es comportamiento anterior a esta PR, no introducido por el campo de estado, y **no se modifica ni exige corregir para mergear T-379**. Una tarea futura podría distinguir «dato no disponible» de zonas reales, cuidando no revelar datos protegidos.

## NO TOCAR — hipótesis descartadas

- **No** cambiar `mark_delivered` ni el estado de la oferta: el contrato indica que el viaje terminado conserva `offers.status = accepted`; por eso se usa `delivery_requests.status`.
- **No** convertir `requestStatus` en opcional para evitar el fixture: se ratificó corregir solo ese fixture.
- **No** devolver `null` a «Aceptadas» ni crear enlace a viaje para estado no visible: contradice la matriz decidida.
- **No** tratar las fallas de Playwright previas al paso T-379 como regresiones verificadas de T-379: solo se informaron en la bitácora y se requiere evidencia específica para atribuirlas.

## Cierre operativo

- **BLOQUEANTES:** ninguno confirmado.
- **MEJORAS exigidas en esta ronda:** ninguna.
- **DECISIONES pendientes:** ninguna. La opción A fue resuelta por Lautaro073.
- **Manual antes del merge:** verificar resultado del último CI con `e2e-preview` y `approval-policy` en el HEAD final; no aceptar un CI rojo ni sustituir el gate por el E2E local.
- **No aprobada ni mergeada** por el revisor.

**Advertencia de trazabilidad:** este informe registra controles del SHA `246c9d2e41fbe7a7bc838827e528c2701500f73b`; el propio commit documental posterior mueve el HEAD y no convierte los controles anteriores en ejecuciones nuevas.
