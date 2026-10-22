# PR #76 — T-113 · Mis solicitudes, ofertas en tiempo real y aceptar oferta

> ✅ **Lista para aceptar · 0 bloqueantes · 8 de 8 cerrados y verificados**  
> Ronda 1 con 6 bloqueantes; Ronda 2 con implementación completa y CI leído por dentro (305 tests en verde).

|                   |                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **PR**            | [#76](https://github.com/cadeApp/cadeApp/pull/76) · `feat/T-113-requests-offers` → `develop` |
| **Tarea / issue** | [`T-113`](../../tasks/T-113.md) · Issue #19                                                  |
| **Autor**         | asako669 (agy)                                                                               |
| **Revisión**      | independiente — no es el agy que implementó                                                  |
| **SHA final**     | `e845ed3` · base `origin/develop` = `b6b5f39` al abrir la revisión                           |
| **Alcance**       | 25 archivos en el diff · **0 fuera** de «Archivos permitidos»                                |

## Rondas

| Ronda | SHA       | Resultado                                           | Informe                               |
| ----- | --------- | --------------------------------------------------- | ------------------------------------- |
| 1     | `d0470aa` | ❌ 6 bloqueantes · 2 mejoras · 0 decisiones         | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2     | `e845ed3` | ✅ **sin bloqueantes · 8/8 cerrados y verificados** | [`ronda-2.md`](revisiones/ronda-2.md) |

## Qué cambió entre rondas

| Aspecto                         | Ronda 1 (`d0470aa`)                                                                   | Ronda 2 (`e845ed3`)                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Código de producción**        | Inexistente (PR en Draft solo con tests preliminares)                                 | Implementado al 100%: `acceptOfferAction`, pantallas C02 (`/merchant/requests`), C04 (`/merchant/requests/[id]`), diálogo C05 y skeletons de carga |
| **Contrato RPC `accept_offer`** | Mock inventaba campos (`matched: true`, `offerId`, `courierId`) y fallaba `typecheck` | Tipado canónico `AcceptOfferResult` (`requestId`, `acceptedOfferId`, `status: 'matched'`, `matchedAt`, `idempotent`)                               |
| **Códigos de error**            | Mock usaba `INVALID_STATE` (inexistente)                                              | Código canónico `INVALID_STATE_TRANSITION` y cobertura ampliada con `it.each` para 5 códigos adicionales                                           |
| **Revalidación de caché**       | Test prometía revalidar pero no afirmaba `revalidatePath`                             | Aserción explícita `expect(revalidatePath).toHaveBeenCalledWith('/merchant/requests')` verificada en rojo y verde                                  |
| **Suscripción Realtime**        | Prop espurio `onRegisterRealtime` que salteaba Supabase                               | Hook `useRequestOffers` con canal real `postgres_changes`, filtro `request_id`, revalidación en focus y cleanup `removeChannel`                    |
| **Entorno de pruebas UI**       | Faltaba `@vitest-environment jsdom` y usaba matchers incompatibles                    | Directiva jsdom configurada, matchers nativos de Vitest y suite adicional para C02                                                                 |
| **CI en GitHub**                | Jobs en rojo por fallos de compilación TS                                             | **8/8 jobs en verde** (305 tests pasando, 0 errores de compilación o lint)                                                                         |

## Lo mejor de la PR

- **Excelente experiencia de usuario en tiempo real:** La suscripción a Supabase Realtime en `useRequestOffers` gestiona limpiamente las ofertas entrantes sin recargar la página, desuscribiéndose adecuadamente en el desmontaje.
- **Diálogo C05 riguroso y accesible:** Muestra el desglose de tarifa acordada, medio de pago y cambio en efectivo, junto con la advertencia de revelación progresiva de datos (D3) y manejo de errores visible en banner (`role="alert"`).
- **Purga total de Stitch (S4):** Ausencia absoluta de calificaciones, estrellas o viajes fantasma; en su lugar se destacan las insignias de documentación (`Licencia verificada`, `Seguro verificado`, `Documentación en revisión`).
- **Respeto estricto del sistema de diseño (D16):** Cumplimiento de la cláusula Anti-12px (piso de 14px `text-sm`) en todas las vistas y métricas de comercio.
