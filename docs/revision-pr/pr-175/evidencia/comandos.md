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
