# Ronda 1 — PR #175 / T-323

**Fecha:** 2026-10-01  
**SHA funcional:** `465b506ada84633bccfaf4657f8bd3bd51b7efff`  
**Base:** `7a1bb4b9facfaed4df724c977f1fa4db383f9dbb`  
**Resultado:** **CON BLOQUEANTES (3)**

## Sincronización, alcance y proceso

- PR Draft, mergeable.
- `develop...HEAD`: 3 commits, 0 behind.
- Cambios: `docs/tasks/log/T-323.md`, `src/ui/map{,.test}.tsx`, `src/features/merchants/components/onboarding-form{,.test}.tsx`.
- Todos los paths están autorizados por la ficha T-323 vigente en develop.
- No hay cambios del autor en `docs/revision-pr/pr-175/**`.
- No hay comentarios previos en la PR.

## Enumeración de clase antes de reportar

### Estado de coordenadas / error en MerchantOnboardingForm

Se enumeraron todos los productores de `coordsError` y todos los datos que deciden el bloqueo:
- geolocation no disponible → `geoNotSupported`;
- GPS dentro → lat/lng válidos + error null;
- GPS fuera → `mapOutOfAguilares` + **lat/lng null**;
- fallo GPS → `geoErrorFallback`;
- pin del mapa → lat/lng + error null;
- submit con coordenadas finales fuera → `mapOutOfAguilares`;
- botón → `isOutOfAguilares`.

El único estado que mezcla presentación y control es `coordsError === mapOutOfAguilares`; de ahí salen H01 y su variante de error stale tras corregir datos.

### Ownership de window.gm_authFailure

Se enumeraron:
1. sin handler previo;
2. un handler previo y un MapPicker;
3. dos MapPicker con cleanup LIFO;
4. dos MapPicker con cleanup no-LIFO;
5. un tercero que reemplaza el global después del mount.

El test agregado cubre solo (2). El patrón de restore incondicional falla en (4) y puede clobber ownership en (5).

## Hallazgos

### PR175-H01 — ALTO — fallback manual bloqueado por error stale

En `onboarding-form.tsx:89-93`, cuando el GPS devuelve una posición fuera de Aguilares se descartan explícitamente las coordenadas:

```ts
setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);
setValue('defaultPickupLat', null, ...);
setValue('defaultPickupLng', null, ...);
```

Pero `isOutOfAguilares` queda en `true` solo por el texto del error (`72-76`) y el botón queda disabled (`405`).

Esto contradice el objetivo de T-323: sin coordenadas válidas el usuario debe poder continuar con dirección manual cuando el mapa/GPS no sirve. También deja una segunda variante stale: si `onSubmit` detecta un centroide inválido y luego el usuario corrige la zona, `coordsError` no se limpia desde el select y el botón puede quedar bloqueado aun con datos ya válidos.

**RED independiente:** `/tmp/pr175_logic_check.mjs` reproduce la misma transición y falla:

```text
state_after_outside_gps= { coordsError: 'Ubicación fuera de Aguilares', lat: null, lng: null }
current_isOutOfAguilares= true
AssertionError: manual fallback must not remain blocked after invalid GPS coordinates were discarded
```

Además el test nuevo `onboarding-form.test.tsx:343-370` protege el comportamiento equivocado: dice “solo bloquea ... si coordenadas explícitamente fuera”, pero espera disabled después de que la propia acción dejó ambas coordenadas en null.

### PR175-H02 — MEDIO — ownership inseguro de gm_authFailure

`map.tsx:136-153` implementa un stack implícito: cada instancia guarda el handler anterior, instala uno nuevo y en cleanup restaura el capturado.

Con dos instancias A/B, si A se desmonta antes que B, A restaura su handler previo y borra el handler de B aunque B siga montado.

**RED independiente:** `/tmp/pr175_gm_handler_check.mjs`:

```text
calls_after_non_lifo_unmount= []
AssertionError: the remaining MapPicker B must still receive gm_authFailure
```

El test `map.test.tsx:267-274` solo verifica una instancia con handler previo. No prueba ciclo de vida concurrente.

La corrección debe usar ownership/subscripción real (por ejemplo, un bridge global único + Set de listeners) en vez de wrappers encadenados por instancia.

### PR175-H03 — MEDIO — evidencia RED sobredeclarada

El body marca como cumplido: “Tests RED antes del arreglo cubren key vacía, APIProvider.onError, APILoadingStatus.FAILED, offline...”.

Sin embargo esos tests ya existían sin cambios en `develop` y estaban verdes antes de T-323. Los RED nuevos de esta tarea son los que la propia bitácora enumera: fallback por `gm_authFailure` y submit antes bloqueado por `coordsError`.

No hay problema en conservar los casos T-116 como regresión; el problema es etiquetarlos como RED nuevo.

## CI exact-head

Run `36940382708` sobre `465b506ada84633bccfaf4657f8bd3bd51b7efff`:

```text
typecheck       success
lint            success
unit            success — 110 files / 1587 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success
/merchant/onboarding 147 kB — OK
/merchant/requests/new 163 kB — OK
```

El verde no detecta H01 porque la prueba nueva afirma el resultado incorrecto, ni H02 porque el test de cleanup solo cubre una instancia.

## Conclusión

No mergear todavía. Corregir H01/H02, ajustar evidencia H03 y revalidar con mutaciones nuevas de la revisión.
