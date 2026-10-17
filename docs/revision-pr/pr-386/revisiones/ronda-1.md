# Informe de revisión independiente — T-363 / PR #386 — Ronda 1

**Fecha:** 2026-10-16. **Código leído:** `20671da159f9ff0caf83c88abc623f2998ced954`. **develop:** `01054b148e9c11eda1358e591abc6e0b82a5af94`.
**Resultado:** **CON BLOQUEANTES (2)**. Decisiones tomadas antes de cerrar: **1-C, 2-A**.

## Método y alcance

Leídos `AGENTS.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `README.md`, `.agents/skills/revisar-pr/SKILL.md`, la ficha `docs/tasks/T-363.md` **desde develop**, la bitácora del HEAD, comentarios y diff. Repasadas las lecciones AG-37/P08/AG-92. El scope de los 18 archivos coincide con la ampliación de T-363 autorizada el 16/10/2026; no hay cambios de RLS, SQL, dominio ni src/ui. El HEAD remoto de la rama y la PR coinciden antes del commit del revisor. No existen reportes independientes previos en `pr-386`.

**Limitación:** GitHub no resuelve DNS desde el contenedor del revisor. La revisión usa GitHub conectado y los logs reales de CI; no se ejecutaron `pnpm`, `git merge-tree`, mutaciones de código ni pruebas E2E directamente por este revisor. Las inferencias matemáticas están rotuladas como tales; ningún hallazgo figura `verificado-runtime` ni con `verificado_en_sha`.

## Hallazgos

### PR386-H01 — BLOQUEANTE (alto): enlace de Google Maps excede límites móviles

**Archivo:** `src/features/trips/route-points.ts:98–106`; helper `src/features/trips/maps.ts`.
**Detección:** ANÁLISIS + especificación pública del proveedor.

`buildTripRoutePlan` arma un único enlace: para 5 entregas, `drops.slice(0,-1)` produce **4 waypoints**. La documentación oficial de Google Maps URLs admite **máximo 3 en navegadores móviles** y URLs de **máximo 2048 caracteres**. Por lo tanto no se garantiza navegar todas las paradas desde el móvil; las direcciones escritas largas (hasta 200 caracteres) también pueden superar el límite una vez codificadas. Fuente: https://developers.google.com/maps/documentation/urls/get-started.

**Decisión 1-C:** dividir en tramos contiguos en orden de `position`. Cada tramo con origen, destino, como máximo 3 waypoints y URL completa de ≤2048; el final del tramo N es el origen del N+1. Preservar todo drop con coordenadas válidas o su dirección textual, incluso puntos intermedios sin pin. Si una URL de dos puntos es demasiado larga, mostrar instrucciones manuales, nunca truncar u omitir silenciosamente. Un tramo mantiene el enlace convencional; varios muestran `Abrir tramo X de Y`. Hacerlo solo dentro de `src/features/trips/**`, reusando el helper canónico.

**Pruebas requeridas:** 1, 4, 5 y 8 entregas, orden desordenado en entrada, entrega intermedia sin coordenadas, continuidad exacta, límites por URL, direcciones acentuadas largas y fallback no navegable. RED propio del autor: volver a construir una sola URL para 5 entregas y comprobar que la aserción de máximo 3 rompe; luego omitir un drop intermedio y confirmar que rompe la aserción de cobertura. Cada mutación se restaura; no se adultera el test para obtener GREEN.

### PR386-H02 — BLOQUEANTE DoD (medio): todos los pines pueden estar montados pero no visibles

**Archivo:** `src/features/trips/components/trip-route-map.tsx:218–242`.
**Detección:** ANÁLISIS estático + cálculo geográfico, sin reproducción en navegador.

`GoogleMap` recibe `center={mapCenter}` (promedio) y `defaultZoom={14}`, sin `fitBounds`; la altura del canvas es `h-48` (192 px). El rango válido de Aguilares va de latitud -27.48 a -27.38 (≈11 km). A zoom 14 y latitud -27.43, una pantalla de 192 px cubre solo ≈0.0146° de latitud, muy por debajo de 0.10°. Un mapa puede tener los componentes marcadores presentes pero fuera de la pantalla. Es una limitación heredada de T-117, relevante para el DoD que promete pines visibles.

**Arreglo:** incorporar un ajustador de cámara, preferentemente usando `useMap()` de la dependencia ya instalada y `map.fitBounds(bounds, padding)` tras cargar el mapa y cuando cambie el recorrido. Bounds calculados exclusivamente desde las coordenadas válidas de todos los puntos; cambiar `center` controlado a `defaultCenter` si impide sostener el ajuste. Cubrir puntos coincidentes con margen mínimo/zoom máximo; evitar efectos en loop y respetar fallback.

**Pruebas:** mock que afirme bounds y la llamada real a `fitBounds` para 2 y 5 puntos, extremos del rango, rerender con otro drop, iguales coordenadas y fallback sin SDK. RED: suprimir `fitBounds` y exigir fallo de la aserción positiva; no alcanza contar 2 Marker en DOM. Si es posible, ampliar el E2E para verificar la cámara o todos los pines visibles.

## Decisión D01 — RESUELTA (2-A), sin bloqueo adicional

Lautaro073 confirma la excepción de **D15 del plan maestro**: el actor autorizado post-match puede abrir voluntariamente Google Maps con las coordenadas o direcciones necesarias para el recorrido. Es solo un enlace externo de navegación del viaje autorizado; **no autoriza** URLs internas, analytics, logs, push, telemetría, acceso antes del match ni al courier no asignado. La regla raíz de PII continúa vigente fuera de esta excepción. Registrar la decisión en la bitácora, sin editar `AGENTS.md` desde esta tarea. Reejecutar E2E de privacidad.

## Comprobaciones y evidencia de autor

- Las funciones de distancia SSR y live devolvieron `null` cuando no existe distancia y la UI muestra `Distancia no calculada`: diseño coherente con el DoD.
- Las coordenadas se validan con límites del dominio, el fallback identifica los puntos ausentes y, sin Map ID, se usa `Marker` clásico.
- Feed prematch sin direcciones privadas nuevas; la E2E T-363 utiliza datos ficticios, pública una solicitud por RPC y acepta con actores autenticados.
- CI **HEAD 20671da**: run `38962593100`, jobs `unit`, `typecheck`, `lint`, `build`, `audit`, `db-tests`, `bundle-budget` SUCCESS. Log db-tests: `Files=26, Tests=2341, Result: PASS`; sus fallos intermedios corresponden a mutaciones deliberadas de otros tests.
- E2E Preview documentado sobre **SHA anterior ea1854f5**, run `38957275905`: 80 chromium + 3 global-settings PASS. **No afirmar E2E exact-HEAD**. Las mutaciones M1–M11 de la bitácora son del **autor**, no la batería del revisor.
- `approval-policy` FAIL hasta publicar el informe; no constituye aprobación. `bundle-budget` SUCCESS con advertencias de `/trips/[id]=224 kB` y `/merchant/requests/[id]=192 kB` (>180); no se atribuye regresión a T-363 sin comparar el baseline.

## NO TOCAR / falsos positivos

- Los archivos de `src/features/offers/**` y live están expresamente autorizados por la ficha leída desde develop.
- `Marker` clásico sin Map ID es correcto; no pedir instalar otro proveedor.
- Mostrar `Distancia no calculada` con null es lo correcto, no un bug.
- Dirección privada post-match y navegación autorizada no equivalen a fuga prematch.

## Integración pendiente

PR #385 continúa abierta: revierte solo la ficha/bitácora que llegaron equivocadamente a develop. No mergear #386 sin resolver primero ese revert y sincronizar con `git merge origin/develop` (no rebase), conservando la ampliación válida de la ficha y la bitácora de T-363. `develop` recibió además PR #368/T-354 en `01054b1`; no cambió la ficha T-363. El merge-tree real queda sin verificar por falta de clon.

**Estado final de la ronda:** 2 hallazgos ABIERTOS, decisiones cerradas, **no aprobar / no mergear**. El autor recibe un prompt de archivos cerrados con implementación y pruebas exactas. Se exige nueva ronda independiente, no declaración de auto-verificado.
