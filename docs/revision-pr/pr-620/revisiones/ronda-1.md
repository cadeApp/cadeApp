# Informe revisar-pr — T-423 — 2026-11-05 — ronda 1

**Revisado:** `d8180d88e01088691b75f05a3a3be4d19d2d1b9a`; base `7809c3991767bd1770b1e5d3d1f945ac38c34463`. **Resultado: CON BLOQUEANTES (5)**. PR Draft. No aprobación ni merge.

**Fuentes leídas antes del diff:** `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md`, ficha `docs/tasks/T-423.md` desde `develop`, CC-045, bitácora y conversación de PR. El cambio de la ficha en la rama se comparó: solo amplía «Archivos permitidos» con `src/ui/map-geocode.ts`. `docs/implementation-plan.md` se sincronizó. **D04: aceptado**, porque los helpers puros se reexportan desde `map.tsx` según CC-045 y evitan un import estático de Maps al cargar formularios. No se modifica el DoD, esquema ni dependencias.

**Lo implementado bien por inspección:** `country:'AR'`, `bounds` con cardinales correctos, verificación local Aguilares, `RANGE_INTERPOLATED` aproximado, búsqueda en ambos formularios, avisos inline, E2E sobre contactos privados y publicación sin pin. Son hechos de código, no pruebas independientes ejecutadas. Issue #619 documenta pendiente legal antes del rollout real.

## BLOQUEANTES

### PR620-H01 (alto) — transición a pin null sin invalidación
`src/ui/map.tsx` ~L337–360. En efecto de `value/defaultZoneCenter`, `if(next===null){lastIncomingCoordsRef.current=null;return}` no incrementa `selectionEpochRef`. Si un pedido A está pendiente y el usuario borra el pin externo, la respuesta `found(B)` puede resucitarlo (en ausencia de centro o si el fallback no permite detectar el borrado). El botón «Quitar ubicación» del comercio es una ruta real. **Fix:** rastrear transición del `value` crudo, incluido A→null, distinguida de eco de `onChange`; invalidar la época sin alterar comportamiento de cámara cuando no procede. **Test RED:** `MapPicker` controlado A, petición id1, `rerender(value=null)`, resolver B; cero `onChange`/cámara y pin ausente. Repetir con `defaultZoneCenter=A`. **Mutación:** quitar invalidación del borrado.

### PR620-H02 (alto) — Promise superviviente y request repetida al reabrir
`src/ui/map.tsx` ~L125–159 y `src/features/requests/components/create-request-form.tsx` ~L102–162, L299–370. `MapGeocoder` hace `pending.then(...).then(onOutcome)` sin cleanup. Ocultar el mapa desmonta la instancia pero el callback puede invocar aún el `onChangeRef` anterior y pisar un GPS manual posterior. Además `geocodeRequest` no se limpia tras resultado/manual/ocultar; al reabrir se remonta Geocoder y consulta otra vez el mismo id (costo y posible pin reescrito). **Fix:** bandera `active` en effect con cleanup; cancelar petición en DropCard al ocultar, fijar manual/GPS y al finalizar resultado; al cancelar liberar `geocoding` y limpiar eventual aviso; mantener identificador monotónico de nueva búsqueda incluso si `geocodeRequest=null`. **Tests RED:** promesa resuelta tras `unmount` no llama callbacks; búsqueda A, fijar B, ocultar/reabrir no dispara consulta nueva; ocultar durante A, GPS B, resolver A conserva B. **Mutación:** quitar cleanup / cancelación al cerrar.

### PR620-H03 (alto) — dirección visible distinta del pedido pendiente
`create-request-form.tsx` ~L125, L278–292 (dirección y barrio) y `onboarding-form.tsx` ~L122–154, L419–426. Tras buscar A, la dirección o barrio puede cambiar a B mientras Google responde. Ese cambio no invalida solicitud ni cancela resultado, por lo que se aplica un pin A a un texto B. Enviar con Enter puede guardar par inconsistente. **Fix:** invalidar request al cambiar dirección o barrio, despejar aviso/buscando; antes de aplicar found comparar la `query` resuelta con `buildGeocodeQuery` vigente, además del `id`; no conservar silenciosamente coordenadas autoderivadas obsoletas, sí preservar pin manual. **Tests RED:** en cada formulario, A→B antes de resolver A, `found(A)` no cambia coordenadas ni deja aviso de A; probar barrio y envío. **Mutación:** quitar guardia query-vigente.

### PR620-H04 (medio) — biblioteca no disponible o promesa congelada
`src/ui/map.tsx` ~L125–160. `useMapsLibrary('geocoding')===null` retorna sin respuesta si el loader principal ya está listo; Promise sin resolución tampoco tiene plazo. Los botones quedan en `geocoding=true` sin aviso ni reintento. Fallo real del proveedor **no demostrado**; es un camino plausible que viola la degradación exigida. **Fix D06:** timeout razonable por `id`, responder `unavailable` una sola vez, permitir reintentar e ignorar resoluciones tardías; limpiar timer on unmount. **Test RED:** mock de biblioteca `null` y Promise pendiente, reloj falso, avance del timeout, se observa un solo `unavailable` y botón habilitado. **Mutación:** retirar timeout.

### PR620-H05 (medio) — query vacía no finaliza
`src/ui/map.tsx` ~L137 y ~L396; `src/ui/map.test.tsx` tiene test «query vacía no consulta ni responde». CC-045 ordena «query vacía ... no consulta a Google; **finalizar el pedido sin dejar al formulario esperando**». Implementación y prueba hacen lo contrario. Aunque los formularios filtren vacío, `MapPicker` es contrato compartido. **Fix D05:** `not_found` terminal una vez sin Geocoder, con y sin key. **Test RED:** exigir `onGeocodeResult({status:'not_found'},request)`; cero consultas. **Mutación:** restituir `return` silencioso.

## MEJORA

### PR620-H06 (bajo) — suposición sobre ZERO_RESULTS
`src/ui/map.tsx` ~L151 usa `error.code`; el mock de Google solo rechaza con `{code:'ZERO_RESULTS'}`. Documentación de Google garantiza el estado, no un shape de error. Es **riesgo no confirmado**. Mejor usar `fulfillOnZeroResults:true` y comprobar `results:[]`, o callback con `status` documentado; test realista sin adulterar mock. Referencia: https://developers.google.com/maps/documentation/javascript/geocoding. No bloquear exclusivamente por H06.

## Decisiones técnicas comparadas

- **D04 helper:** A importar `map.tsx` directamente (importa librería pesada), B separar helpers puros y reexportar (menor acoplamiento), C nuevo paquete compartido (sobreingeniería). **B**, ya documentada en ficha; beneficio de bundle es cualitativo, sin cifra medida.
- **D05 vacío:** A silencio (viola contrato), B `not_found` terminal (sencillo y coherente), C `unavailable` (confunde query inválida con Google caído). **B**. Cambiar si se añade tipo explícito `invalid_query`.
- **D06 concurrencia:** A solo id (no cubre desmontaje), B cleanup + cancelación por cambio + timeout (verificable con temporizadores falsos), C store global (más complejo). **B**, sin dependencias nuevas.

## Verificaciones y límites
- Revisión del diff y comentarios: sí, vía API GitHub, 15 archivos.
- `git merge-tree`, `pnpm typecheck/lint/test` local, test RED propio y reproducción M1–M11 del autor: **no ejecutados** (sin clon accesible, ni conexión Git desde contenedor). No afirmar verificado-runtime.
- En la consulta de CI sobre el SHA `d8180d88`, `typecheck`, `lint`, `unit`, `build` y `bundle-budget` figuraban success; `db-tests` seguía in_progress. No se comprobó `e2e-preview`. Sus resultados futuros no se infieren.
- La bitácora **declara** 72/72 map, 35/35 requests, 36/36 onboarding y M1–M11 RED. No se verificaron de modo independiente. La ronda sigue bloqueada aun con CI verde.

**Cierre:** el agente corrige H01–H05, aporta pruebas RED→GREEN reales y SHA pusheado; segunda ronda independiente comprueba nuevo código. Ningún cambio en `docs/revision-pr/**` por el autor. No repetir CI solo por este commit documental. Issue #619 antes del rollout con datos reales.
