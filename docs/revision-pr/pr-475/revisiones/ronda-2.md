# Informe revisar-pr — PR #475 · T-388 / T-389 · ronda 2

**Fecha:** 2026-10-21 · **SHA del autor revisado:** `bc12c2518b3dc29649529913f5d17b3107254c82` · **Base:** develop @ `33b18573ead16f34ebb07e9e0865c00ce52c0229`.
**Resultado de revisión del contenido: SIN BLOQUEANTES DOCUMENTALES.** No es aprobación para merge hasta controles requeridos satisfechos. Sin modificaciones de código funcional.

## Verificaciones de las decisiones, en SHA exacto

- **H01 resuelto:** T-388 permite `src/lib/format/index.ts` y `format.test.ts` existentes, Mis ofertas y tests, ofertas copy/schemas/cards, los tres consumidores de comercio y sus pruebas, consultas y E2E. La fila T-388 de §8 replica esos paths. `src/server/live/t204.ts` permanece habilitado.
- **H02 resuelto:** objetivo y DoD exigen «≈ X km» en lista, historial y detalle de comercio, más feed, hoja y Mis ofertas. `merchant-requests-list.tsx` está permitida.
- **H03 resuelto:** especifica fuente única en `src/lib/format`, `3500` → «≈ 3,5 km», `0` → «Menos de 0,5 km», `null` → «Distancia no calculada», sin cambios SQL. Incluye test y mutación de 0/NULL.
- **H04 resuelto:** DoD exige capturar el `.select()` real de los seis lectores, respetar `route_distance_m` del parent, permitir `delivery_request_drops.approx_distance_m`, no retornar desde mocks columnas no seleccionadas, y mutación de regreso a columna legacy.
- **H05 resuelto:** «Mis ofertas» debe mostrar distancia solo cuando RLS deja ver request; cuando está oculta no afirma «Distancia no calculada». Tests cubren solicitud no visible frente a request visible NULL, sin mostrar datos no autorizados.
- **H06 resuelto:** D05-A expreso: courier matched/in_transit sí, courier delivered no; comercio conserva ventana 24 h. En transit debe aparecer botón pese a no tener cancelación. E2E acepta botón o descendiente desde `elementFromPoint`.

## Comprobación reproducible de especificaciones
Control propio de 14 invariantes: rutas permitidas en ficha y plan, semántica 0 m, RLS/null, proyección SQL, regla D05-A y descendientes de `elementFromPoint`. **967bf1ab: 2/14 PASS; bc12c251: 14/14 PASS.** Ejecutado por el revisor sobre contenidos de GitHub; script completo copiable en [evidencia/comandos.md](../evidencia/comandos.md). No mide runtime ni certifica las pruebas propuestas de la futura PR de implementación.

## Advertencias menores (no bloqueantes)
- En la implementación, al no poder ver la relación por RLS, evitar mostrar barrios inventados por fallbacks `Centro`/`Aguilares` de `getMyOffers`; mostrar un estado explícito y neutro para la solicitud inaccesible. La ficha diferencia correctamente RLS vs NULL; debe guiarse al agente con esta advertencia.
- El control E2E de click debería confirmar que abre el formulario, además de hit-test; surge naturalmente de «clickeable», no requiere nueva ronda documental.
- La definición de 5 min se prueba en el flujo real de oferta y, si comparte selector con toma de precio fijo, comprobar ambos caminos. No es un cambio contractual.

## Checks GitHub del SHA revisado (observados, no inferidos)
- ✅ unit, typecheck, lint, build, audit, bundle-budget; Vercel desplegado.
- ⏳ db-tests en curso al consultarlo.
- ❌ approval-policy por ausencia de informe independiente antes de esta publicación.
- ⚠️ e2e-preview **error/cancelled**: log de ejecución confirma «The operation was canceled» después de 1 prueba Playwright completada; **no demuestra un test rojo funcional**. La compuerta no está verde, debe completarse satisfactoriamente antes de merge. No se forzaron workflows ni se leyeron secretos.

## No tocar
- No modificar `delivery_request_drops.approx_distance_m`, RLS, RPC, migraciones ni tipos generados en T-388.
- No ampliar la ventana D05-A ni habilitar el reporte para courier delivered.
- No aceptar CI verde como sustituto de la revisión independiente ni falsificar mutaciones.

**Veredicto:** Las fichas quedan técnicamente aptas para su implementación futura, sin bloqueantes documentales sobre `bc12c2518b3dc29649529913f5d17b3107254c82`. **No se aprueba ni mergea mientras el gate de checks no esté satisfecho.**
