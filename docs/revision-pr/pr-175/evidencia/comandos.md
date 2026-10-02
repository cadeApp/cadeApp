# Evidencia — PR #175 / T-323

## Ronda 1

SHA funcional: `465b506ada84633bccfaf4657f8bd3bd51b7efff`  
develop: `7a1bb4b9facfaed4df724c977f1fa4db383f9dbb`

### Estado de rama

```text
ahead_by: 3
behind_by: 0
mergeable: true
changed_files: 5
```

No hay archivos fuera de la ficha ni modificaciones del autor a `docs/revision-pr/pr-175/**`.

### Reproducción del estado previo declarado por el autor

Inspección de `1ac8f7486e775fc2b6ffc4732cd25d98a917076f`:

```text
start_has_gm_authFailure=false
start_submit_disables_on_any_coordsError=true
start_has_new_isOutOfAguilares=false
```

Esto reproduce por inspección la precondición de los dos RED residuales. No se ejecutó Vitest sobre el start SHA en el entorno de revisión porque no hay clon local montado.

### Harness independiente H01

Archivo ejecutado en `/tmp/pr175_logic_check.mjs`:

```js
import assert from 'node:assert/strict';

const mapOut = 'Ubicación fuera de Aguilares';
function isWithin(lat,lng){
  return lat>=-27.455 && lat<=-27.410 && lng>=-65.640 && lng<=-65.595;
}
function currentIsOut({coordsError,lat,lng}){
  return coordsError===mapOut ||
    (lat!=null && lng!=null && !isWithin(lat,lng));
}

let state={coordsError:null,lat:null,lng:null};
const gps={lat:-26.83,lng:-65.20};
if(!isWithin(gps.lat,gps.lng)){
  state.coordsError=mapOut;
  state.lat=null;
  state.lng=null;
}

console.log('state_after_outside_gps=', state);
console.log('current_isOutOfAguilares=', currentIsOut(state));
assert.equal(
  currentIsOut(state),
  false,
  'manual fallback must not remain blocked after invalid GPS coordinates were discarded'
);
```

Salida:

```text
state_after_outside_gps= { coordsError: 'Ubicación fuera de Aguilares', lat: null, lng: null }
current_isOutOfAguilares= true
AssertionError: manual fallback must not remain blocked after invalid GPS coordinates were discarded
```

### Harness independiente H02

Archivo ejecutado en `/tmp/pr175_gm_handler_check.mjs`:

```js
import assert from 'node:assert/strict';

let gm;
const calls=[];
function mount(name){
  const previous=gm;
  const handler=()=>{
    calls.push(name);
    if(typeof previous==='function') previous();
  };
  gm=handler;
  return ()=>{ gm=previous; };
}

const cleanupA=mount('A');
const cleanupB=mount('B');
cleanupA();
calls.length=0;
gm?.();

console.log('calls_after_non_lifo_unmount=', calls);
assert.deepEqual(
  calls,
  ['B'],
  'the remaining MapPicker B must still receive gm_authFailure'
);
```

Salida:

```text
calls_after_non_lifo_unmount= []
AssertionError: the remaining MapPicker B must still receive gm_authFailure
```

### H03 — comparación de cobertura heredada

En `develop` ya existen sin cambios los tests de:
- `APILoadingStatus.FAILED`;
- `APIProvider.onError`;
- API key vacía;
- offline inicial;
- transición online/offline.

Por eso son cobertura de regresión heredada de T-116, no RED nuevos de T-323.

### CI exact-head 36940382708

```text
Test Files 110 passed (110)
Tests      1587 passed (1587)

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding      147 kB  OK
/merchant/requests/new    163 kB  OK
```

Nota: el job bundle-budget sigue mostrando warnings preexistentes en rutas admin y `/design-system`; no pertenecen al diff de T-323.

## Ronda 2

SHA funcional revisado: `04133f01d6a1b42142336ce3bd97db20a2bbd98e`  
develop vigente tras decisión P1: `1457072a7cac1ae9e2a8a92abe9253d45b745082`.

### Cambios desde Ronda 1

```text
ce4b014 fix(merchants): derive map blocking from effective coords and use shared auth bridge [T-323]
04133f0 docs(T-323): session log
```

El autor no tocó `docs/revision-pr/pr-175/**`.

### Harness independiente H01/H02

Ejecutado:

```bash
node /tmp/pr175_r2_harness.mjs
```

Salida:

```text
H01_PASS current=false, mutation_caught=true
H02_PASS non_lifo=[B,external], external_restored=true
H02_MUTATION_CAUGHT=true
```

El harness:
- verifica que coords descartadas no bloqueen el fallback;
- verifica que reintroducir el string stale sí sea detectado;
- verifica dos listeners con unmount no-LIFO y restauración del externo;
- verifica que el patrón antiguo de stack por instancia sea detectado.

### H03

Inspección del body actual y bitácora: la evidencia quedó separada en cobertura heredada GREEN vs RED nuevos T-323.

### CI exact-head 36942523962

```text
typecheck success
lint success
build success
audit success
bundle-budget success
Test Files 110 passed (110)
Tests 1593 passed (1593)
db-tests Files=13, Tests=1614, Result: PASS
/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
```

### H04 — comprobación contra ficha vigente

PR #176 fue mergeada a develop como `1457072a7cac1ae9e2a8a92abe9253d45b745082`.

La inspección del HEAD funcional aún encuentra:

```text
onCameraChanged={handleCameraChange}
onChangeRef.current?.(rounded) dentro de handleCameraChange
center={activeCoords}
data-testid="map-crosshair"
data-testid="map-fine-adjustment"
data-testid="map-coords-badge"
```

La ficha vigente exige que esos tres primeros dejen de formar un loop de persistencia y que los tres controles visuales sean reemplazados por pin draggable/click con UI no intrusiva.

Estado de rama tras #176:

```text
ahead_by=6
behind_by=3
status=diverged
```

## Ronda 3

SHA funcional: `8a6c8846fe59105f6eac968f3f0e8508297bdc79`.

### Estado

```text
develop: 1457072a7cac1ae9e2a8a92abe9253d45b745082
ahead_by: 10
behind_by: 0
mergeable: true
```

El autor no modificó la carpeta de revisión de PR #175 después de Ronda 2.

### Harness independiente

```bash
node /tmp/pr175_r3_harness.mjs
```

Salida:

```text
H04_PASS camera=0 drag=1 click=1
H04_MUT_CAMERA_CAUGHT=true
H04_MUT_DRAG_CAUGHT=true
H04_MUT_CLICK_CAUGHT=true
H05_MAP_ID_CONTRACT_CAUGHT=true
```

### Contrato oficial usado para H05

La documentación de `@vis.gl/react-google-maps` indica para `AdvancedMarker` que solo puede usarse en mapas que utilizan cloud-based map styling, por lo que el componente `Map` debe tener `mapId`.

Contrato local:
- `src/lib/env.public.ts`: `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` optional/default `''`;
- `.env.example`: “ID de Mapa opcional”;
- `src/ui/map.tsx`: `mapId = ... || undefined`, pero `AdvancedMarker` se renderiza sin condición;
- `src/ui/map.test.tsx`: el mock de AdvancedMarker no modela la precondición de mapId.

### CI exact-head 36945662064

```text
Test Files 110 passed (110)
Tests      1593 passed (1593)

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
```

## Ronda 4

SHA funcional revisado: `8ae06d83cf89d3b50988316af54c29fdbee27a42`  
develop: `1457072a7cac1ae9e2a8a92abe9253d45b745082`.

### H05 — fallback de Marker

Comparación adversarial R3 → R4:

```text
H05_OLD_RED_PROPERTY=true
H05_CURRENT_GREEN_PROPERTY=true
H05_CONTROL_EXERCISES_BOTH_VARIANTS=true
```

Interpretación:
- R3 renderizaba `AdvancedMarker` incondicionalmente y no tenía rama `Marker`.
- R4 contiene `{mapId ? <AdvancedMarker ...> : <Marker ...>}`.
- `map.test.tsx` captura separadamente props de ambas variantes y ejerce `onDragEnd`, `disabled` y click/tap.

### H06 — drift contra CC-011

Chequeo independiente limitado al cuerpo ejecutable de `handleCameraChange` para evitar el falso positivo de su comentario explicativo:

```text
EXECUTABLE_CAMERA_BLOCK:
const handleCameraChange = React.useCallback(
    (_ev: MapCameraChangedEvent) => {
    },
    []
  );

ccControlled=true
curControlled=false
curDefault=true
ccCameraPersist=true
curCameraPersist=false
ccCrosshair=true
curCrosshair=false
ccDpad=true
curDpad=false
suiteCc=true
suiteOpposite=true
CC011_DRIFT_CAUGHT=true
```

Fuentes cruzadas:
- `AGENTS.md §1.4`: `src/ui/**` requiere contract-change.
- `CC-011 §4`: center controlado, cameraChanged→onChange, crosshair y D-pad.
- `src/ui/map.tsx@8ae06d8`: comportamiento opuesto por decisión P1.
- PR #176: solo documentación de tarea/plan/revisión; no crea ni reemplaza un CC.
- No existe rama `cc/CC-014-*` al momento de R4.

### CI exact-head 36947374673

```text
Test Files 110 passed (110)
Tests      1597 passed (1597)

db-tests:
Files=13, Tests=1614
Result: PASS

typecheck success
lint success
build success
audit success
bundle-budget success

/merchant/onboarding 147 kB OK
/merchant/requests/new 163 kB OK
/design-system 184 kB — warning preexistente
```

El job db-tests tuvo reintentos por rate-limit de Docker Hub durante el arranque, pero finalmente ejecutó la base y terminó con `Files=13, Tests=1614, Result: PASS`.

### Decisiones P1 de R4

```text
1-A — mantener UX nueva y formalizar CC-014 separado antes de cerrar T-323.
2-A — validación visual real como gate de promoción develop → staging; no bloquea #175 antes del merge.
```

`.github/workflows/deploy.yml` confirma que el deploy estable de staging se dispara únicamente tras un workflow de migración completado por `push` a la rama `staging`; las feature branches no despliegan allí.
