# PR #620 — T-423 · Ronda 2 — 2026-11-05

**Resultado: CON BLOQUEANTES (2 nuevos)**; no aprobado, no mergeado.
**SHA funcional revisado:** `9ec83512491515463beabf3627efc886b5068f83` (padre `a5a5ce8d1d8d8eebccab4038bfeec465369153c0`). Contrato/ficha desde `develop`, sin cambios nuevos de alcance respecto de R1.

## Contraste de R1 (H01–H06)

**Arreglados por inspección, todavía SIN verificación independiente de mutaciones:**
- **H01:** `MapPicker` agrega `previousValueRef` y aumenta `selectionEpochRef` para `A→null`, incluso si `defaultZoneCenter` coincide con A. Dos tests nuevos.
- **H02:** `MapGeocoder` protege su Promise con `active` y cleanup. `DropCard` y `MerchantOnboardingForm` cancelan al cambiar/ocultar/mover/GPS y al terminar; contador independiente monotónico de IDs. Tests de unmount/cancelación.
- **H03:** ambos formularios invalidan al editar dirección o barrio y descartan coordenadas derivadas previamente, con protección de pin manual. En requests hay test de submit B sin coords A. **Falta ampliar los bordes A→B→A y la UI con centroide nulo (abajo).**
- **H04:** timeout `GEOCODE_TIMEOUT_MS=10_000`, con test de biblioteca ausente, Promise colgada y resultado tardío ignorado.
- **H05:** query `trim()===''` responde `not_found` sin construir Geocoder; test actualizado.
- **H06:** `fulfillOnZeroResults:true` y tratamiento de `results:[]` como `not_found`. El test de la opción y el de resultado están presentes.

D04–D06 se mantuvieron. La bitácora sesión 2 reconoce que el RED del código original **no fue reproducido**, sino que R1–R11 fueron mutaciones temporales sobre el arreglo (R11 inicialmente quedó verde, se añadió caso y luego quedó rojo). Se reconoce esta corrección de control del agente; no confundir con ejecución del revisor.

## NUEVOS BLOQUEANTES

### PR620-H07 — medio — Deduplicación queda activa después de borrar pin geocodificado
**Fuente exacta:** `src/features/requests/components/create-request-form.tsx` líneas ~132–159; la misma secuencia está en `src/features/merchants/components/onboarding-form.tsx` líneas ~135–162.

**Secuencia completa:**
1. Escribir dirección A y buscarla: `lastGeocodeQueryRef=A`, `pinFromGeocodeRef=true`, pin A.
2. Editar a B: `handleGeocodeQueryInput(B)` pone `pinFromGeocodeRef=false` y coords `null`, **pero conserva `lastGeocodeQueryRef=A`** (si no hay otra petición pendiente).
3. Sin salir del campo, deshacer la edición y volver exactamente a A. Al salir, `requestGeocode(false)` retorna por `query === lastGeocodeQueryRef.current`, aunque ya **no existe pin**. El comercio queda sin la ubicación automática que antes había obtenido. El botón explícito sigue existiendo, pero el objetivo de búsqueda automática en blur queda incumplido.

**Prueba que lo pondría en rojo (no ejecutada aquí):** en las DOS suites de formularios, `blur(A)→found(pinA)→change(B)→change(A)→blur(A)`, verificar que se emite una **nueva** petición `id=2` para A, se vuelve a recibir `found` y el pin vuelve; proteger el comportamiento del pin manual sin búsqueda extra.

**Decisión D07 (autónoma):** A, resetear `lastGeocodeQueryRef.current = ''` cuando se invalida y borra el pin geocodificado: simple y testable, con posible consulta adicional solo si el texto se revierte. B, conservar un caché de query y coordenadas para restaurar el pin: evita consulta, pero agrega complejidad de sincronización y datos sensibles en memoria. C, no borrar el pin hasta blur: transitoriamente asocia coords A con dirección B y complica el guardado. **Elijo A**, porque preserva la invariante de datos coherentes sin un segundo estado histórico del pin. Reconsiderar si la cuota medida muestra un impacto material. **Mutación RED:** eliminar solo ese reset y demostrar que el test de reversión falla.

### PR620-H08 — medio — El pin visual viejo subsiste cuando se borran las coordenadas y no hay centroide
**Fuente exacta:** `src/ui/map.tsx` ~L324 (activeCoords), ~L362–366 (rama `next===null` retorna), ~L436 (`showMarkerWhenEmpty` verdadero), ~L688/L704 (marcador sigue en activeCoords). `src/features/requests/queries.ts` líneas ~77–78 y `merchants/queries.ts` ~21–22 declaran centroide como `number | null`.

**Secuencia:** un mapa controlado recibe `value=A` tras geocodificar; el formulario cambia de dirección y elimina las coordenadas (`value=null`), con `defaultZoneCenter=null` porque la zona carece de centroide. El efecto `if(next===null){lastIncomingCoordsRef.current=null;return}` **no actualiza `activeCoords`**, y el marcador sigue en A si `showMarkerWhenEmpty=true` (valor por defecto en entregas y alta). El formulario guarda null, pero el mapa enseña A: estado visual contradictorio. No se afirma que ocurra con todos los barrios; es un caso permitido por los tipos.

**Prueba RED propuesta:** en `src/ui/map.test.tsx` render controlado `value=A`, `defaultZoneCenter=null`, `showMarkerWhenEmpty=true`; luego `rerender(value=null)`, esperar que marcador pase a `AGUILARES_CENTER` sin `onChange`, sin persistencia de lat/lng y sin volver a mostrar A. Integración requests: zona con `centroidLat/centroidLng=null`, `found(A)`, editar dirección y comprobar `dropLat/dropLng=null` y posición visual neutral.

**Decisión D08 (autónoma):** A, ocultar siempre el marcador si no hay coordenadas: elimina confusión pero cambia la UX anterior de un marcador base seleccionable. B, resetear `activeCoords` a `defaultZoneCenter ?? AGUILARES_CENTER` solo ante borrado externo real, sin disparar `onChange`; conserva mapa usable e invariantes. C, forzar un centroide en esquema: migración fuera de alcance y afecta otras tareas. **Elijo B**, con guardas contra bucles y tests de cámara existentes. **Mutación RED:** eliminar el reset de la rama `next===null`.

## Checks y evidencia contrastada
- Commit 9ec8351 solo altera rutas permitidas de T-423 y bitácora; el autor no escribió `docs/revision-pr/**`. Ficha T-423 en la rama sigue con la ampliación D04 aceptada, sin alteraciones nuevas. GitHub reporta PR mergeable.
- **Job unit del SHA exacto:** log de GitHub Actions `127542208269` muestra `Test Files 193 passed (193)` y `Tests 3617 passed (3617)`. Typecheck, lint, audit, build y bundle-budget successful. db-tests estaba in_progress; `e2e-preview` sin corrida comprobada.
- `approval-policy` del SHA 9ec8351 falla por mensaje «Falta el informe completo de revisar-pr sin bloqueantes». Con 2 nuevos bloqueantes es coherente que no apruebe.
- **Sin clon local:** no se ejecutó Vitest, mutaciones propias, ni `git merge-tree --write-tree` desde este revisor. El log de R1–R11 pertenece al agente y no es evidencia independiente. El modelo mínimo de las condiciones, separado de la app, figura en comandos.md. No se debe poner `verificado_en_sha` para H01–H06.

## Cierre y acciones
- Agente corrige H07–H08 en ruta permitida, con tests RED→GREEN reales y mutación RED independiente de R1–R11; prepara SHA nuevo y bitácora. Tercera ronda revalida los ocho hallazgos.
- Un CI verde adicional **solo por este commit de documentación** no es requisito; el SHA funcional corregido sí debe pasar los gates pertinentes y E2E.
- Antes de rollout con destinatarios reales: issue #619 requiere decisión legal/humana. No mergear desde esta revisión.
